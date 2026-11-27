import { describe, expect, it } from "vite-plus/test";

import { previousRulesFile } from "../refreshFolderRules";
import { refreshSprintRules } from "./refreshSprintRules";
import { SPRINT_RULES_MARKER, sprintSeedFiles } from "./sprintSeedFiles";

function folder(initial: Record<string, string>, failOn?: string) {
  const files = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    files,
    writes,
    io: {
      read: async (path: string) => files.get(path) ?? null,
      write: async (path: string, contents: string) => {
        if (path === failOn) throw new Error("denied");
        writes.push(path);
        files.set(path, contents);
      },
    },
  };
}

const sprint = {
  name: "Composer redesign",
  threadId: "thread-sprint",
  projectId: "project-test",
  projectTitle: "no3ycode",
  projectRoot: "/repo",
  folderPath: "/scratch/sprints/composer-redesign-thread-sprint",
};
const docs = { id: "project-docs", title: "Docs (v2)", root: "/docs" };

const current = new Map(
  sprintSeedFiles({
    ...sprint,
    otherProjects: [docs],
    goal: "",
    threadModel: null,
    today: "2026-11-27",
  }).map((file) => [file.relativePath, file.contents]),
);
const GENERATED = [
  "CLAUDE.md",
  "AGENTS.md",
  ".claude/settings.json",
  ".claude/compact-instructions.md",
];

// What a version 5 sprint's owner and sprint wrote.
const OWNED = {
  "PLAN.md": "# Plan\n\nGoal: Ship it\n\nPace: keep going\n",
  "STATE.md": "# State\n\n## Open\n\n- a thread\n",
  "CREW.md": "# Instructions\n\n- Run a sol loop.\n",
  "MEMORY.md": "# Memory\n\n- 2026-11-27: Use pnpm.\n",
  "ANSWERS.md": '# Answers\n\n- 2026-11-27 10:00: Fix (t:r): OK? → "Yes"\n',
  "PROJECTS.md": "# Other projects\n\n- Marketing (id `project-site`, at `/site`)\n",
  "context/spec.md": "the spec",
};
const OLD_RULES =
  "<!-- sprint-rules: 5 -->\n# Composer redesign\n\n## Other projects\n\n- Docs (v2) (id `project-docs`, at `/docs`)\n";

describe("refreshSprintRules", () => {
  it("replaces an old sprint's generated files and never touches what it and its owner wrote", async () => {
    const old = folder({ ...OWNED, "CLAUDE.md": OLD_RULES, "AGENTS.md": "old pointer" });
    expect(await refreshSprintRules(old.io, sprint)).toBe(true);
    for (const [path, contents] of Object.entries(OWNED))
      expect(old.files.get(path)).toBe(contents);
    for (const path of GENERATED) expect(old.files.get(path)).toBe(current.get(path));
    expect(old.files.get(previousRulesFile(5))).toBe(OLD_RULES);
    expect(old.writes.at(-1)).toBe("CLAUDE.md");

    // Current rules: nothing to do.
    const writes = old.writes.length;
    expect(await refreshSprintRules(old.io, sprint)).toBe(false);
    expect(old.writes).toHaveLength(writes);
  });

  it("moves the projects a version 5 CLAUDE.md listed into PROJECTS.md, and adds only missing files", async () => {
    const old = folder({ "CLAUDE.md": OLD_RULES, "PLAN.md": OWNED["PLAN.md"] });
    await refreshSprintRules(old.io, sprint);
    expect(old.files.get("PROJECTS.md")).toBe(current.get("PROJECTS.md"));
    expect(old.files.get("PLAN.md")).toBe(OWNED["PLAN.md"]);
    expect(old.files.get("MEMORY.md")).toBe(current.get("MEMORY.md"));
  });

  it("counts rules without a marker as the oldest version", async () => {
    const old = folder({ "CLAUDE.md": "# Composer redesign\n\nOld rules." });
    expect(await refreshSprintRules(old.io, sprint)).toBe(true);
    expect(old.files.get(previousRulesFile(1))).toBe("# Composer redesign\n\nOld rules.");
    expect(old.files.get("CLAUDE.md")?.startsWith(SPRINT_RULES_MARKER)).toBe(true);
  });

  it("leaves CLAUDE.md old when a write fails, so the next attempt starts over", async () => {
    const old = folder({ "CLAUDE.md": OLD_RULES }, ".claude/settings.json");
    await expect(refreshSprintRules(old.io, sprint)).rejects.toThrow("denied");
    expect(old.files.get("CLAUDE.md")).toBe(OLD_RULES);
  });

  it("leaves rules a newer client wrote alone, so clients never roll each other back", async () => {
    const newer = folder({ "CLAUDE.md": "<!-- sprint-rules: 99 -->\n# Composer redesign\n" });
    expect(await refreshSprintRules(newer.io, sprint)).toBe(false);
    expect(newer.writes).toEqual([]);
  });

  it("leaves a folder with no CLAUDE.md alone: its sprint is still being created", async () => {
    // Creation seeds after the thread is made and tagged, so a refresh then must not race it.
    const seeding = folder({ "PLAN.md": OWNED["PLAN.md"] });
    expect(await refreshSprintRules(seeding.io, sprint)).toBe(false);
    expect(seeding.writes).toEqual([]);
  });
});
