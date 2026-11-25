// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-trail-summary` and `#fork-live-task-list`.
 *
 * Both live in fenced edits to upstream's timeline. A sync that takes upstream's files compiles
 * clean and quietly brings back split trail rows, far-right chevrons, or a live turn without its
 * checklist.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-trail-summary", () => {
  const logic = readSibling("../components/chat/MessagesTimeline.logic.ts");

  it("groups a task update with the stretch it follows and names the group for its tools", () => {
    expect(logic).not.toContain('nextEntry.entry.itemType === "todo_list" ||');
    expect(logic).toMatch(
      /workEntryIsInActiveRun\(entry\) &&[\s\S]{0,200}entry\.itemType !== "todo_list"/u,
    );
    expect(logic).toContain('visibleGroupedEntries[0]!.itemType !== "reasoning"');
    expect(logic).toContain("summary: forkTrailSummary(visibleGroupedEntries, resolve),");
  });

  it("hugs each row's chevron to its label and gives summary rows one", () => {
    const workLog = readSibling("../components/chat/WorkLog.tsx");
    expect(workLog).toContain(
      "[&>[data-row-timestamp]]:order-last [&>[data-row-timestamp]]:ms-auto",
    );
    // Upstream's flex-1 label parks the chevron at the row's far end.
    expect(workLog).toContain('className="flex min-w-0 flex-initial items-baseline gap-1.5"');
    expect(workLog).toContain('"min-w-0 text-secondary-label",');
    expect(workLog).not.toContain('"min-w-0 flex-1 text-secondary-label"');
    expect(readSibling("../components/chat/TimelineRowParts.tsx")).toContain("data-row-timestamp");
    const rows = readSibling("../components/chat/TimelineWorkGroupRows.tsx");
    const header = rows.slice(rows.indexOf("function WorkGroupHeader"));
    expect(header).toContain('props.expanded && "rotate-90"');
    expect(rows).toContain("<div data-fork-trace-group>");
  });

  it("hangs an opened group on a 2px rounded rail, without a scrollbar", () => {
    const css = readSibling("../theme.custom.css");
    // The rail is the list's own background: a 2px bar between two 2px round caps.
    expect(css).toMatch(
      /\[data-tool-group-scroll\] \{[^}]*--fork-rail-cap: radial-gradient\([^}]*background:[^}]*\/ 2px 2px no-repeat,[^}]*\/ 2px[^}]*scrollbar-width: none;/u,
    );
    expect(css).toMatch(
      /\[data-fork-trace-group\] > \* \{[^}]*border-inline-start[^}]*scrollbar-width: none;/u,
    );
  });
});

describe("fork guard: fork-live-task-list", () => {
  it("provides the turn's task list while it works, outside Zen", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toMatch(
      /isWorking && toolCallVisibility !== "zen" \? forkLiveTaskSteps\(timelineEntries\) : null/u,
    );
    expect(timeline).toContain("<ForkLiveTasksCtx value={forkLiveTasks}>");
  });

  it("draws the checklist above both the status line and upstream's fallback line", () => {
    expect(readSibling("../custom/ForkLiveStatusLine.tsx")).toContain(
      "<ForkLiveTaskList steps={tasks} />",
    );
    expect(readSibling("../components/chat/TimelineWorkGroupRows.tsx")).toContain(
      "<ForkLiveTaskList steps={forkTasks} />",
    );
  });
});
