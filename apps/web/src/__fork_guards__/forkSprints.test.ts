// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-sprints`.
 * A sprint is a bot tagged `sprint`: bot machinery, its own Sidebar section, no mascot, never
 * self-scheduled, owner messages steer. Each turn is told its library's file names; threads own
 * their PRs short of merging and save outputs to the library.
 */

import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { FORK_BOT_THREAD_TAG, FORK_BOT_WORK_TAG_PREFIX } from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import { filterSidebarV2VisibleThreads } from "../components/Sidebar.logic";
import { isPetalThread, listSidebarBots } from "../custom/bots/botThreads";
import { botThreadsPanelBotId } from "../custom/bots/botWork";
import { sidebarV2CardKind } from "../custom/bots/SidebarV2BotCardBody";
import { SPRINT_CONTEXT_DIRECTORY } from "../custom/sprints/sprintContextFiles";
import { SPRINT_PANEL_TABS } from "../custom/sprints/sprintPanelState";
import {
  SPRINT_PROJECTS_FILE,
  SPRINT_RULES_VERSION,
  sprintRulesRefresh,
  sprintSeedFiles,
} from "../custom/sprints/sprintSeedFiles";
import {
  FORK_SPRINT_TAG,
  listSidebarSprints,
  parseSprintGoal,
  SPRINT_MEMORY_FILE,
  SPRINT_OWNER_EDITS_DIRECTORY,
  SPRINT_PLAN_FILE,
} from "../custom/sprints/sprintThreads";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function tagged(id: string, tags: ReadonlyArray<string>): Thread {
  const thread = makeThreadFixture({ id: id as Thread["id"] });
  return { ...thread, source: { ...thread.source, tags } };
}

const petal = tagged("petal", [FORK_BOT_THREAD_TAG]);
const sprint = tagged("sprint", [FORK_BOT_THREAD_TAG, FORK_SPRINT_TAG]);
const sprintWork = tagged("sprint-fix", [`${FORK_BOT_WORK_TAG_PREFIX}sprint`]);
// A subagent inherits `sprint` without `bot`: it is the sprint's helper, never a sprint.
const sprintSubagent = tagged("sprint-sub", [FORK_SPRINT_TAG]);

const identity = {
  name: "Composer redesign",
  threadId: "sprint",
  projectId: "project-test",
  projectTitle: "no3ycode",
  projectRoot: "/repo",
  folderPath: "/scratch/sprints/composer-redesign-sprint",
};
const otherProjects = [{ id: "project-docs", title: "Docs", root: "/docs" }];
const seeded = sprintSeedFiles({
  ...identity,
  goal: "Redesign the composer for Flat Glass",
  otherProjects,
  threadModel: { instanceId: "claudeAgent", model: "claude-opus-5-5" } as never,
  today: "2026-11-27",
});
const seededFile = (path: string) =>
  seeded.find((file) => file.relativePath === path)?.contents ?? "";

/** A temp folder holding `files`, with the turn hook from its `.claude/settings.json`. */
function sprintFolder(files: ReadonlyArray<{ relativePath: string; contents: string }>) {
  const folder = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "sprint-hook-"));
  const write = (relativePath: string, contents: string) => {
    NodeFS.mkdirSync(NodePath.dirname(NodePath.join(folder, relativePath)), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(folder, relativePath), contents);
  };
  for (const file of files) write(file.relativePath, file.contents);
  const runTurnHook = () => {
    const settings = JSON.parse(
      NodeFS.readFileSync(NodePath.join(folder, ".claude/settings.json"), "utf8"),
    );
    return NodeChildProcess.execFileSync(
      "/bin/sh",
      ["-c", settings.hooks.UserPromptSubmit[0].hooks[0].command],
      { env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: folder }, encoding: "utf8" },
    );
  };
  return { folder, write, runTurnHook };
}

// The generated files for `seeded`'s sprint, pinned to the rules version they ship as.
const PINNED_RULES = {
  version: 7,
  sha256: "efc1849ba164b088f72b60fbc86a8ff01627babd4ae37c33ad7c87435942dd41",
};

describe("fork guard: fork-sprints", () => {
  it("lists sprints in their own section and Petals in theirs", () => {
    const threads = [petal, sprint, sprintSubagent];
    expect(listSidebarSprints(threads).map((thread) => thread.id)).toEqual(["sprint"]);
    expect(listSidebarBots(threads).map((thread) => thread.id)).toEqual(["petal"]);
    expect(isPetalThread(sprint.source)).toBe(false);
    expect(sidebarV2CardKind(sprint.source, "card")).toBe("card");
    expect(sidebarV2CardKind(sprint.source, "compact")).toBe("compact");
  });

  it("keeps a sprint and its work off the thread list, in its Threads panel", () => {
    const mine = makeThreadFixture({ id: "mine" as Thread["id"] });
    const visible = filterSidebarV2VisibleThreads([mine, sprint, sprintWork], null, new Set());
    expect(visible.map((thread) => thread.id)).toEqual(["mine"]);
    expect(botThreadsPanelBotId(sprintWork, sprint)).toBe("sprint");
    expect(botThreadsPanelBotId(sprint, null)).toBe("sprint");
  });

  it("seeds a reactive sprint whose goal reads back from PLAN.md", () => {
    const rules = seededFile("CLAUDE.md");
    expect(rules).toContain("Your turns are short");
    expect(rules).toContain("You only act when asked");
    expect(rules).toContain("Do not create scheduled tasks");
    expect(rules).toContain("project-test");
    expect(parseSprintGoal(seededFile(SPRINT_PLAN_FILE))).toBe(
      "Redesign the composer for Flat Glass",
    );
    // No job, no digest: those are a Petal's.
    expect(seeded.map((file) => file.relativePath)).not.toContain("JOB.md");
    expect(seeded.map((file) => file.relativePath)).not.toContain("DIGEST.md");
  });

  it("tells the sprint about its context files on every turn", () => {
    expect(seededFile("CLAUDE.md")).toContain(`${SPRINT_CONTEXT_DIRECTORY}/\` in this folder`);
    const settings = JSON.parse(seededFile(".claude/settings.json"));
    const turnHook: string = settings.hooks.UserPromptSubmit[0].hooks[0].command;
    expect(turnHook).toContain("Now:");
    expect(turnHook).toContain(`$CLAUDE_PROJECT_DIR/${SPRINT_CONTEXT_DIRECTORY}`);
    expect(readSibling("../custom/sprints/SprintPanel.tsx")).toContain("<SprintPanelTabStrip");
  });

  it("shares one instructions file and one memory with its threads, and shows it their changes once", () => {
    // CREW.md is what the server adds to each launched thread, so the sprint imports that same file.
    expect(seededFile("CLAUDE.md")).toContain("\n@CREW.md\n");
    expect(seededFile("CREW.md")).toContain(
      `/scratch/sprints/composer-redesign-sprint/${SPRINT_MEMORY_FILE}`,
    );
    expect(seeded.map((file) => file.relativePath)).toContain(SPRINT_MEMORY_FILE);

    const { folder, write, runTurnHook: run } = sprintFolder(seeded);
    try {
      write("context/spec.md", "spec");
      write(`${SPRINT_OWNER_EDITS_DIRECTORY}/CREW.md`, "");
      const first = run();
      expect(first).toContain("Library files:\nspec.md");
      expect(first).toContain("Your owner changed CREW.md. It now reads:\n# Instructions");
      expect(first).toContain("MEMORY.md changed. It now reads:\n# Memory");
      // Shown once: the marker goes with it, and memory is shown again only when it changes.
      const second = run();
      expect(second).not.toContain("Your owner changed");
      expect(second).not.toContain("MEMORY.md changed");
      NodeFS.appendFileSync(NodePath.join(folder, SPRINT_MEMORY_FILE), "- 2026-11-27: Use pnpm.\n");
      expect(run()).toContain("- 2026-11-27: Use pnpm.");
    } finally {
      NodeFS.rmSync(folder, { recursive: true, force: true });
    }
  });

  it("has threads own their pull requests, short of merging, and save outputs to the library", () => {
    const crew = seededFile("CREW.md");
    expect(crew).toContain("watch_pull_request");
    expect(crew).toContain("Never merge a pull request");
    expect(crew).toContain("/scratch/sprints/composer-redesign-sprint/context");
    expect(seededFile("CLAUDE.md")).toContain("Merging waits for your owner's approval");
  });

  it("names the other projects the sprint touches in a file its rules import", () => {
    expect(seededFile("CLAUDE.md")).toContain(`\n@${SPRINT_PROJECTS_FILE}\n`);
    expect(seededFile(SPRINT_PROJECTS_FILE)).toContain("- Docs (id `project-docs`, at `/docs`)");
    // Only Claude Code expands the import; other providers read the files AGENTS.md names.
    expect(seededFile("AGENTS.md")).toContain(SPRINT_PROJECTS_FILE);
  });

  it("pins the generated rules to their version", () => {
    const { rules, replace } = sprintRulesRefresh(identity, otherProjects);
    const generated = [{ relativePath: "CLAUDE.md", contents: rules }, ...replace];
    const hash = NodeCrypto.createHash("sha256");
    for (const file of generated) hash.update(`${file.relativePath}\n${file.contents}\n`);
    expect(
      { version: SPRINT_RULES_VERSION, sha256: hash.digest("hex") },
      "A sprint's generated files changed. Raise SPRINT_RULES_VERSION in custom/sprints/sprintSeedFiles.ts so existing sprints get the new text (refreshSprintRules), then pin the new version and hash in PINNED_RULES here.",
    ).toEqual(PINNED_RULES);
  });

  it("brings older sprints' rules up to date from the sidebar", () => {
    expect(readSibling("../components/Sidebar.tsx")).toContain(
      "useRefreshSprintRules(sprintThreads, projectByKey);",
    );
  });

  it("has Pull requests and Library tabs, and binary library files reach the disk", () => {
    expect(SPRINT_PANEL_TABS.map((tab) => tab.label)).toEqual(
      expect.arrayContaining(["Pull requests", "Library"]),
    );
    expect(readSibling("../custom/sprints/useAddSprintContext.ts")).toContain(
      "encoding: file.encoding",
    );
    expect(readSibling("../../../server/src/workspace/WorkspaceFileSystem.ts")).toContain(
      'Buffer.from(input.contents, "base64")',
    );
  });

  it("offers starter prompts in an empty sprint", () => {
    expect(readSibling("../custom/bots/BotMascot.tsx")).toContain("<SprintEmptyConversation");
  });

  it("lets the owner pick the sprint's model in the dialog", () => {
    const dialog = readSibling("../custom/sprints/SidebarV2SprintsSection.tsx");
    expect(dialog).toContain("<SprintModelPicker");
    expect(dialog).toContain("useSprintModelChoices(");
    expect(readSibling("../custom/sprints/useSprintModelChoices.ts")).toContain(
      "withoutPromptInjectedLevels",
    );
  });

  it("keeps a sprint's header to details and its threads", () => {
    const chatView = readSibling("../components/ChatView.tsx");
    expect(chatView).toContain("showTerminalControl={false}");
    expect(chatView).toContain("(forkSprintRef === null || splitPane.split) &&");
    expect(chatView).toContain("paneActions={forkSprintRef === null}");
  });

  it("opens a sprint's threads in its own panel, keeping the sprint on screen", () => {
    const panel = readSibling("../custom/sprints/SprintPanel.tsx");
    expect(panel).toContain("<SprintChildConversation");
    expect(panel).toContain("openInSprintPanel(props.sprintRef, ref)");
    // Transcript rows and thread links reach the panel through the host the sprint's timeline gets.
    expect(readSibling("../custom/sprints/sprintThreadHost.tsx")).toContain(
      "openThread: (ref) => openInSprintPanel(sprintRef, ref),",
    );
    expect(readSibling("../components/ThreadContextChip.tsx")).toContain(
      "forkThreadHost?.openThread({ environmentId, threadId }) === true",
    );
    expect(readSibling("../custom/threadLaunchCards/ForkThreadLaunchCards.tsx")).toContain(
      "if (host?.openThread(threadRef) === true) return;",
    );
    const chatView = readSibling("../components/ChatView.tsx");
    expect(chatView).toContain("parentPanel={sideChatParentPanel}");
    expect(chatView).toContain(
      "forkThreadHost={forkSprintRef === null ? null : sprintThreadHost(forkSprintRef)}",
    );
  });

  it("keeps sprint code out of the Petal panel, the thread cards and thread links", () => {
    expect(readSibling("../custom/bots/BotThreadsPanel.tsx")).not.toContain("../sprints/");
    for (const file of [
      "../custom/threadLaunchCards/ForkThreadLaunchCards.tsx",
      "../custom/threadLaunchCards/ForkThreadRequestCard.tsx",
      "../custom/threadLaunchCards/threadLaunch.logic.ts",
      "../components/ThreadContextChip.tsx",
    ]) {
      expect(readSibling(file)).not.toMatch(/sprints\//);
    }
  });

  it("steers what the owner sends into a sprint's running turn", () => {
    const composer = readSibling("../components/chat/ChatComposer.tsx");
    expect(composer).toMatch(/forkIsSprint \|\|/);
  });

  it("draws the Sprints section and tags a new sprint `sprint` before `bot`", () => {
    expect(readSibling("../components/Sidebar.tsx")).toContain("<SidebarV2SprintsRow");
    expect(readSibling("../custom/sprints/useCreateSprint.ts")).toContain(
      "[FORK_SPRINT_TAG, FORK_BOT_THREAD_TAG]",
    );
  });
});
