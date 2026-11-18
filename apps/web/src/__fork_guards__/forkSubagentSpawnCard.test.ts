// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Every transcript subagent, alone or in a batch, renders as the fork's card.
 * A sync that puts upstream's lifecycle row or avatar-stack group back at the
 * call site, or drops the card's well, compiles and ships upstream's look.
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
const theme = readSibling("../theme.custom.css");
const basic = readSibling("../theme.custom.basic.css");

describe("fork guard: fork-subagent-spawn-card", () => {
  it("routes every subagent, alone or batched, through the fork's cards", () => {
    expect(timeline).toContain('from "~/custom/ForkSubagentGroup"');
    // One branch takes every subagent item, alone or batched.
    expect(timeline).toMatch(
      /if \(item\.type === "subagent"\) \{\s*return \(\s*<ForkSubagentGroup\b/u,
    );
    expect(timeline).not.toContain("row.subagents?.length");
    expect(timeline).not.toContain("return <V2SubagentGroup key={row.id} row={row} />;");
    // A finished subagent's completion notice is its card too, not upstream's notification row.
    const workEntryRow = readSibling("../components/chat/TimelineWorkEntryRow.tsx");
    expect(workEntryRow).toContain("<ForkSubagentNotice");
    expect(workEntryRow.indexOf("<ForkSubagentNotice")).toBeLessThan(
      workEntryRow.indexOf("<SubagentNotificationLink"),
    );
  });

  it("draws the Basic kit card: provider tile, status mark, and the task / now / model well", () => {
    // A batch keeps its lead line above the cards.
    expect(group).toContain('<ListTreeIcon weight="stroke"');
    expect(model).toContain("subagentGroupSummary(rows)");
    expect(model).toContain("summarizeSubagentStatuses(rows.map((row) => row.status))");
    expect(model).toContain("formatModelSlugName(slug)");
    expect(group).toContain("<EnvironmentSubagentAvatar");
    expect(group).toContain("<SidebarV2StatusMark status={markStatus(member.mark)}");
    expect(group).toContain('data-fork-subagent-well=""');
    expect(basic).toMatch(
      /\[data-fork-subagent-well\] \{\s*background-color: var\(--basic-raised\);/u,
    );
    expect(group).toContain('term: "Task"');
    expect(group).toContain('term: "Model"');
    // One list of rows gates the chevron and the well, so a card with nothing to list offers neither.
    expect(group).toMatch(
      /details\.length === 0 \? null : \(\s*<Tooltip|details\.length === 0 \? null : \(\s*<button/u,
    );
    expect(group).toMatch(/details\.length === 0 \? null : \(\s*<dl/u);
    // The fork mark stays for Codex and Claude; upstream's avatar over it draws only the badge.
    expect(group).toContain('iconClassName="hidden"');
    // The well is open while the subagent works, unless the chevron was used.
    expect(group).toContain('const open = chosenOpen ?? member.mark === "working";');
    expect(group).toContain("ctx.workGroupViewState.expandedEntries");
    // A member with a thread of its own opens it from the header.
    expect(group).toContain("return () => onOpenThread(childThreadId);");
    // …and from an explicit arrow button beside the chevron.
    expect(group).toMatch(
      /data-fork-subagent-open=""[\s\S]*?onClick=\{openThread\}[\s\S]*?<ArrowUpRightIcon/u,
    );
    // The buttons' hover is scoped to the card, so a completion notice outside a tree gets it too.
    expect(theme).toMatch(
      /\[data-fork-subagent-card\]\s*:is\(\s*button\[data-fork-subagent-member\],\s*button\[data-fork-subagent-open\],/u,
    );
  });
});
