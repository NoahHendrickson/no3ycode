// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-coordinator-threads`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { ThreadId } from "@t3tools/contracts";
import {
  FORK_BOT_THREAD_TAG,
  FORK_COORDINATOR_TAG,
  isForkCoordinatorThread,
} from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import { filterSidebarV2VisibleThreads } from "../components/Sidebar.logic";
import {
  canStartCoordinating,
  COORDINATOR_MENU_ID,
  COORDINATOR_START_MESSAGE,
  coordinatorChildInputs,
  coordinatorMenuItems,
  listSidebarCoordinators,
} from "../custom/coordinator/coordinatorThreads";
import { makeThreadFixture } from "../test-fixtures";
import type { Thread } from "../types";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const root = { rootThreadId: ThreadId.make("t"), parentThreadId: null, relationshipToParent: null };

describe("fork guard: fork-coordinator-threads", () => {
  it("switches a listed thread on and off, and never a Petal or a subagent", () => {
    // One item; picking it flips the thread (useCoordinatorMenuPick), so only the label differs.
    const [on] = coordinatorMenuItems({ tags: [], lineage: root }, true);
    expect(on?.id).toBe(COORDINATOR_MENU_ID);
    expect(on?.label).toBe("Make coordinator");
    const [off] = coordinatorMenuItems({ tags: [FORK_COORDINATOR_TAG], lineage: root }, true);
    expect(off?.id).toBe(COORDINATOR_MENU_ID);
    expect(off?.label).toBe("Stop coordinating");
    expect(coordinatorMenuItems({ tags: [FORK_BOT_THREAD_TAG], lineage: root }, true)).toEqual([]);
    const subagent = {
      ...root,
      parentThreadId: ThreadId.make("p"),
      relationshipToParent: "subagent" as const,
    };
    expect(coordinatorMenuItems({ tags: [], lineage: subagent }, true)).toEqual([]);
    // An older delegated child carries the tag; it is no coordinator, nor is a tagged side chat.
    const tags = [FORK_COORDINATOR_TAG];
    expect(isForkCoordinatorThread({ tags, lineage: root })).toBe(true);
    expect(isForkCoordinatorThread({ tags, lineage: subagent })).toBe(false);
    expect(isForkCoordinatorThread({ tags, lineage: { ...root, sideChat: true } })).toBe(false);
    expect(isForkCoordinatorThread({ tags: [...tags, FORK_BOT_THREAD_TAG], lineage: root })).toBe(
      false,
    );
    // `/coordinate` applies exactly where the menu offers "Make coordinator".
    expect(canStartCoordinating({ tags: [], lineage: root })).toBe(true);
    expect(canStartCoordinating({ tags: [FORK_COORDINATOR_TAG], lineage: root })).toBe(false);
    expect(canStartCoordinating({ tags: [FORK_BOT_THREAD_TAG], lineage: root })).toBe(false);
    expect(canStartCoordinating({ tags: [], lineage: subagent })).toBe(false);
    expect(canStartCoordinating({ tags: [], lineage: { ...root, sideChat: true } })).toBe(false);
  });

  it("lists coordinators in their own sidebar section, never in the thread groups", () => {
    const thread = (id: string, tags: ReadonlyArray<string>, archivedAt: string | null = null) => {
      const base = makeThreadFixture({ id: id as Thread["id"] });
      return { ...base, archivedAt, source: { ...base.source, tags } };
    };
    const plain = thread("plain", []);
    const coordinator = thread("coordinator", [FORK_COORDINATOR_TAG]);
    const archived = thread("archived", [FORK_COORDINATOR_TAG], "2026-11-27T00:00:00.000Z");
    const petal = thread("petal", [FORK_BOT_THREAD_TAG, FORK_COORDINATOR_TAG]);
    const threads = [plain, coordinator, archived, petal];
    expect(listSidebarCoordinators(threads).map((row) => row.id)).toEqual(["coordinator"]);
    expect(filterSidebarV2VisibleThreads(threads, null, new Set()).map((row) => row.id)).toEqual([
      "plain",
    ]);
    // "Stop coordinating" drops the tag: it leaves the section and is back among the threads.
    const stopped = { ...coordinator, source: { ...coordinator.source, tags: [] } };
    expect(listSidebarCoordinators([plain, stopped])).toEqual([]);
    expect(
      filterSidebarV2VisibleThreads([plain, stopped], null, new Set()).map((row) => row.id),
    ).toEqual(["plain", "coordinator"]);

    const sidebar = read("../components/Sidebar.tsx");
    expect(sidebar).toContain("<SidebarV2CoordinatorsRow");
    expect(sidebar).toContain("coordinatorThreads.length === 0 ? null : (");
    expect(sidebar).toContain('toggleListSectionCollapsed("coordinators")');
    expect(read("../custom/coordinator/SidebarV2CoordinatorsSection.tsx")).toContain(
      'label="Coordinators"',
    );
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
    expect(draft).toContain("const rules = await steps.startTurn(turns.rules);");
    // An untagged thread gets no task: the composer keeps it in the draft.
    expect(draft).toContain('if (tagged._tag !== "Success") return tagged;');
    expect(draft).toContain("const task = await steps.startTurn(turns.task);");
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
      expect(source).toContain("pickCoordinatorMenuItem(clicked.value, thread, ");
    }
    expect(read("../custom/coordinator/useSetCoordinator.ts")).toContain(
      "if (canOperate()) void setCoordinator(thread, !isForkCoordinatorThread(thread.source));",
    );
    for (const path of ["../components/Sidebar.tsx", "../hooks/useThreadActionMenu.ts"]) {
      expect(read(path)).toContain("const pickCoordinatorMenuItem = useCoordinatorMenuPick();");
    }
  });

  it("drops a coordinator's child question from the timeline's end, its card being inline", () => {
    const child = (
      id: string,
      pending: { readonly approval?: boolean; readonly question?: boolean },
      lineage: { readonly parentThreadId?: ThreadId; readonly sideChat?: boolean } = {},
    ) => ({
      id,
      hasPendingApprovals: pending.approval === true,
      hasPendingUserInput: pending.question === true,
      lineage: {
        ...root,
        parentThreadId: ThreadId.make("coordinator"),
        relationshipToParent: "subagent" as const,
        ...lineage,
      },
    });
    const delegated = "thread:delegated-task:";
    const children = [
      child(`${delegated}question`, { question: true }),
      child(`${delegated}approval`, { approval: true }),
      child(`${delegated}both`, { approval: true, question: true }),
      // No inline card for these: each keeps its line.
      child(`${delegated}side`, { question: true }, { sideChat: true }),
      child(`${delegated}nested`, { question: true }, { parentThreadId: ThreadId.make("child") }),
      child("thread:provider:claude:native", { question: true }),
    ];
    expect(coordinatorChildInputs("coordinator", children).map((entry) => entry.id)).toEqual([
      `${delegated}approval`,
      `${delegated}both`,
      `${delegated}side`,
      `${delegated}nested`,
      "thread:provider:claude:native",
    ]);
    expect(read("../components/chat/useThreadLifecycle.tsx")).toMatch(
      /forkIsCoordinator\s*\?\s*coordinatorChildInputs\(/u,
    );
  });

  it("keeps the standing rules short, with no model rule", () => {
    const rules = COORDINATOR_START_MESSAGE;
    expect(rules).toContain("`delegate_task`");
    expect(rules).toContain("never wait on a child");
    // The children show in the subagents card and the panel; a reply's thread links get cut off.
    expect(rules).toContain("Don't list or link them");
    expect(rules).toContain("scopes don't overlap");
    expect(rules).toContain("or restate the question");
    expect(rules).toContain('reply exactly "Nothing to report." (I answer on its card)');
    expect(rules).toContain("never ask me it yourself");
    expect(rules).not.toMatch(/model/i);
    expect(rules.length).toBeLessThan(800);
  });

  it("shows the coordinator's own panel, a child opening inside it, on itself and its children", () => {
    const chatView = read("../components/ChatView.tsx");
    expect(chatView).toContain("forkBotThreadsIsCoordinator ? (");
    expect(chatView).toContain("<CoordinatorPanel");
    expect(chatView).toContain("coordinatorThreadHost(forkCoordinatorRef)");
    // The body it shares with the sprint panel: one-line rows under interface-size group headers,
    // and a child opened in place, only on the owner's own page.
    expect(read("../custom/coordinator/CoordinatorPanel.tsx")).toContain(
      "<BotThreadsChildPanelBody",
    );
    expect(read("../custom/sprints/SprintPanel.tsx")).toContain("<BotThreadsChildPanelBody");
    const body = read("../custom/bots/BotThreadsChild.tsx");
    expect(body).toContain("const child = onOwnerPage ? openChild : null;");
    expect(body).toContain("<BotThreadsChildConversation");
    expect(body).toContain("<BotThreadsChildHeading");
    expect(body).toContain("<BotThreadsCompactRow");
    expect(body).toContain('labelSize="interface"');
    expect(read("../custom/coordinator/coordinatorThreadHost.tsx")).toContain(
      "openThread: (ref) => openBotThreadsChild(coordinatorRef, ref),",
    );
  });

  it("answers a delegated child's question on its card where the host answers inline", () => {
    // A settled card keeps the question and its answer, read off the child.
    const host = read("../custom/coordinator/coordinatorThreadHost.tsx");
    expect(host).toContain("useChildQuestionAnswers(props.thread, props.requestId, props.kind)");
    expect(host).toContain("<ForkAnsweredRequestCard");
    // The server words a coordinator's wake for the card, not for asking the owner itself, and
    // its quiet reply hides the wake's turn, keeping the card (custom/bots/quietBotWakes).
    const reactor = read("../../../server/src/orchestration-v2/DelegatedTaskQuestionReactor.ts");
    expect(reactor).toContain("isForkCoordinatorThread(");
    expect(reactor).toContain('otherwise reply exactly "${FORK_BOT_QUIET_REPLY}"');
    const timeline = read("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toMatch(/forkIsCoordinator\s*\?\s*"coordinator"/u);
    expect(read("../custom/bots/quietBotWakes.ts")).toMatch(
      /coordinator: \{\s*reportedRunsOnly: true,\s*noticeStartsRun: true,\s*keepsDelegatedQuestions: true,/u,
    );
    const row = read("../components/chat/TimelineWorkEntryRow.tsx");
    // A coordinator host only: a sprint's delegated notices stay plain notices.
    expect(row).toContain("forkHost?.delegatedQuestionOf(item) ?? null");
    expect(host).toContain("delegatedQuestionOf: forkDelegatedQuestionOf,");
    expect(read("../custom/sprints/sprintThreadHost.tsx")).toContain(
      "delegatedQuestionOf: () => null,",
    );
  });
});
