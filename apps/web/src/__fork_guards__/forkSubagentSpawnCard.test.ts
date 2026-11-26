// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Every transcript subagent, alone or in a batch, renders as the fork's start line.
 * A sync that puts upstream's lifecycle row or avatar-stack group back at the
 * call site compiles and ships upstream's look.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

// Upstream moved V2EventTimelineRow out of MessagesTimeline.
const timeline = readSibling("../components/chat/TimelineV2EventRow.tsx");
const group = readSibling("../custom/ForkSubagentGroup.tsx");
const model = readSibling("../custom/forkSubagentTree.ts");

describe("fork guard: fork-subagent-spawn-card", () => {
  it("routes every subagent, alone or batched, through the fork's lines", () => {
    expect(timeline).toContain('from "~/custom/ForkSubagentGroup"');
    // One branch takes every subagent item, alone or batched.
    expect(timeline).toMatch(
      /if \(item\.type === "subagent"\) \{\s*return \(\s*<ForkSubagentGroup\b/u,
    );
    expect(timeline).not.toContain("row.subagents?.length");
    expect(timeline).not.toContain("return <V2SubagentGroup key={row.id} row={row} />;");
    // A finished subagent's completion notice is the fork's one line, not upstream's row…
    const workEntryRow = readSibling("../components/chat/TimelineWorkEntryRow.tsx");
    expect(workEntryRow).toContain("<ForkSubagentNotice");
    expect(workEntryRow).not.toContain("<SubagentNotificationLink");
    expect(group).toMatch(/return \(\s*<ForkSubagentNoticeLine\b/u);
    // The notice is the start line's own line, led by the provider's mark.
    expect(group).toContain('root={{ "data-fork-subagent-notice": member.id }}');
    // …because the start line itself stays in the turn that launched it.
    expect(readSibling("../components/chat/MessagesTimeline.logic.ts")).toContain(
      '(entry.kind === "event" && entry.projectedItem.item.type === "subagent") ||',
    );
    // …while a question, progress or resumed notice keeps upstream's row.
    expect(group).toMatch(
      /if \(!settled \|\| subagentResumedSince\(agent, notice\.createdAt\)\) \{\s*return <SubagentNotificationLink \{\.\.\.notice\} \/>;/u,
    );
  });

  it("draws each subagent as one start line: mark, status, title, model and effort, elapsed", () => {
    // A batch keeps its lead line above the lines.
    expect(group).toContain('<ListTreeIcon weight="stroke"');
    expect(model).toContain("subagentGroupSummary(rows)");
    expect(model).toContain("summarizeSubagentStatuses(rows.map((row) => row.status))");
    expect(model).toContain("formatModelSlugName(slug)");
    expect(group).toMatch(/<ForkSubagentStartLineView\b/u);
    expect(group).toContain('root={{ "data-fork-subagent-start": member.id }}');
    expect(group).toContain('<span className="shrink-0">{"Started"}</span>');
    expect(group).toContain(
      "formatSubagentEffort({ modelSlug, modelSelection: member.modelSelection, provider })",
    );
    // The provider's mark leads, badged with the sidebar's status mark on the start line.
    expect(group).toContain("driver={forkSubagentMarkDriver(member)}");
    expect(group).toContain("<EnvironmentSubagentAvatar");
    expect(group).toContain("status={forkSubagentStatusMark(member.mark)}");
    // No card or well comes back.
    expect(group).not.toContain("data-fork-subagent-card");
    expect(group).not.toContain("data-fork-subagent-well");
    // A member with a thread of its own opens it from the line. The click's intent rides along,
    // so it opens beside the thread or in its place.
    expect(group).toContain("open: (intent) => onOpenThread(childThreadId, undefined, intent)");
    expect(group).toContain("{...trigger(open, { panel: props.panel })}");
  });
});
