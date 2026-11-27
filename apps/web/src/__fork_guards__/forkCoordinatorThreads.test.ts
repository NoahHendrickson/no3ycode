// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-coordinator-threads`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { ThreadId } from "@t3tools/contracts";
import { FORK_BOT_THREAD_TAG } from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import {
  canStartCoordinating,
  coordinatorMenuItems,
  coordinatorMenuTurnsOn,
  coordinatorMessage,
  FORK_COORDINATOR_TAG,
  isCoordinatorMenuId,
} from "../custom/coordinator/coordinatorThreads";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const root = { rootThreadId: ThreadId.make("t"), parentThreadId: null, relationshipToParent: null };

describe("fork guard: fork-coordinator-threads", () => {
  it("switches a listed thread on and off, and never a Petal or a subagent", () => {
    const [on] = coordinatorMenuItems({ tags: [], lineage: root }, true);
    expect(on?.label).toBe("Make coordinator");
    expect(on !== undefined && coordinatorMenuTurnsOn(on.id)).toBe(true);
    const [off] = coordinatorMenuItems({ tags: [FORK_COORDINATOR_TAG], lineage: root }, true);
    expect(off?.label).toBe("Stop coordinating");
    expect(off !== undefined && coordinatorMenuTurnsOn(off.id)).toBe(false);
    expect(coordinatorMenuItems({ tags: [FORK_BOT_THREAD_TAG], lineage: root }, true)).toEqual([]);
    const subagent = {
      ...root,
      parentThreadId: ThreadId.make("p"),
      relationshipToParent: "subagent" as const,
    };
    expect(coordinatorMenuItems({ tags: [], lineage: subagent }, true)).toEqual([]);
    expect(isCoordinatorMenuId("pin")).toBe(false);
    // `/coordinate` applies exactly where the menu offers "Make coordinator".
    expect(canStartCoordinating({ tags: [], lineage: root })).toBe(true);
    expect(canStartCoordinating({ tags: [FORK_COORDINATOR_TAG], lineage: root })).toBe(false);
    expect(canStartCoordinating({ tags: [FORK_BOT_THREAD_TAG], lineage: root })).toBe(false);
    expect(canStartCoordinating({ tags: [], lineage: subagent })).toBe(false);
    expect(canStartCoordinating({ tags: [], lineage: { ...root, sideChat: true } })).toBe(false);
  });

  it("starts a new thread as a coordinator from the draft's toggle, rules before the task", () => {
    const composer = read("../components/chat/ChatComposer.tsx");
    expect(composer).toContain("const forkCoordinator = useCoordinatorComposer({");
    expect(composer).toContain("<CoordinatorDraftToggle");
    // Only a send in flight disables it: a draft with no project yet has no operate scope.
    expect(composer).toMatch(/<CoordinatorDraftToggle[^>]*disabled=\{isSendBusy\}/u);
    // The generic CheckboxPill, in the composer card's own surface, natively drawn where the card is.
    const toggle = read("../custom/coordinator/CoordinatorDraftToggle.tsx");
    expect(toggle).toContain("<CheckboxPill");
    expect(toggle).toContain("data-fork-coordinator-toggle");
    expect(toggle).toContain("icon={WorkflowSquare10Icon}");
    const pill = read("../custom/CheckboxPill.tsx");
    expect(pill).toContain("<label");
    expect(pill).toContain('variant="contrast"');
    expect(read("../custom/CheckboxPill.css")).toMatch(
      /\[data-fork-checkbox-pill\] \{[^}]*color: var\(--basic-text-strong, var\(--foreground\)\);/u,
    );
    expect(read("../custom/forkDraftLiquidGlass.ts")).toContain(
      '"[data-fork-coordinator-toggle]",',
    );
    expect(read("../custom/ComposerShell.css")).toMatch(
      /\[data-fork-coordinator-toggle\] \{\s*background: var\(--fork-composer-vessel-bg\);/u,
    );
    const send = read("../components/chat/useComposerSend.ts");
    expect(send).toContain("const forkStartOwnerTurn = useCoordinatorDraftStart(");
    expect(send).toContain("const startPromise = forkStartOwnerTurn({");
    const draft = read("../custom/coordinator/coordinatorDraft.ts");
    expect(draft).toContain("const rules = await startTurn(turns.rules);");
    expect(draft).toContain("return startTurn(turns.task);");
  });

  it("offers /coordinate in the composer where it can apply", () => {
    expect(read("../composer-logic.ts")).toContain('| "coordinate"');
    const items = read("../components/chat/useComposerMenuItems.ts");
    expect(items).toContain("...(coordinateAvailable");
    expect(items).toContain('command: "coordinate"');
    const composer = read("../components/chat/ChatComposer.tsx");
    expect(composer).toContain("coordinateAvailable: forkCoordinator.commandAvailable,");
    expect(composer).toContain('if (item.command === "coordinate") {');
    expect(composer).toContain("forkCoordinator.runCommand();");
  });

  it("offers the switch in the sidebar's thread menu and the chat header's", () => {
    for (const path of ["../components/Sidebar.tsx", "../hooks/useThreadActionMenu.ts"]) {
      const source = read(path);
      expect(source).toContain("...coordinatorMenuItems(");
      expect(source).toContain("if (isCoordinatorMenuId(clicked.value)) {");
    }
  });

  it("keeps the standing rules short, with no model rule", () => {
    const rules = coordinatorMessage(true);
    expect(rules).toContain("`delegate_task`");
    expect(rules).toContain("never wait on a child");
    expect(rules).toContain("scopes don't overlap");
    expect(rules).toContain("never restate the question");
    expect(rules).not.toMatch(/model/i);
    expect(rules.length).toBeLessThan(800);
  });

  it("shows the coordinator's own panel, a child opening inside it, on itself and its children", () => {
    const chatView = read("../components/ChatView.tsx");
    expect(chatView).toContain("forkBotThreadsIsCoordinator ? (");
    expect(chatView).toContain("<CoordinatorPanel");
    expect(chatView).toContain("coordinatorThreadHost(forkCoordinatorRef)");
    const panel = read("../custom/coordinator/CoordinatorPanel.tsx");
    expect(panel).toContain("const child = onCoordinatorPage ? openChild : null;");
    expect(panel).toContain("<BotThreadsChildConversation");
    expect(panel).toContain("<BotThreadsChildHeading");
    expect(read("../custom/coordinator/coordinatorThreadHost.tsx")).toContain(
      "openThread: (ref) => openBotThreadsChild(coordinatorRef, ref),",
    );
  });

  it("answers a delegated child's question on its card where the host answers inline", () => {
    const row = read("../components/chat/TimelineWorkEntryRow.tsx");
    expect(row).toContain(
      'item?.type === "notification" && forkHost !== null ? forkDelegatedQuestionOf(item) : null;',
    );
  });
});
