/**
 * The no3y Automations screen's run groups — see `.fork/customizations.yaml#no3y-mobile-redesign`:
 * runs that need you first, then working, then the rest by recency, a page at a time.
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";

export const NO3Y_RUNS_PAGE = 25;

export type No3yRunGroup = "needs-you" | "working" | "recent";

export const NO3Y_RUN_GROUP_LABELS: Readonly<Record<No3yRunGroup, string>> = {
  "needs-you": "Needs you",
  working: "Working",
  recent: "Recent",
};

export function no3yRunGroup(kind: SidebarV2CardStatusKind | null): No3yRunGroup {
  switch (kind) {
    case "approval":
    case "input":
    case "request":
    case "limited":
    case "failed":
    case "woke":
      return "needs-you";
    case "working":
    case "waiting":
    case "monitoring":
      return "working";
    default:
      return "recent";
  }
}

/** Groups runs (already newest first), keeping order inside each group, up to `limit` runs. */
export function groupNo3yRuns<Run>(
  runs: ReadonlyArray<Run>,
  kindOf: (run: Run) => SidebarV2CardStatusKind | null,
  limit: number,
): ReadonlyArray<{ readonly group: No3yRunGroup; readonly runs: ReadonlyArray<Run> }> {
  const order: ReadonlyArray<No3yRunGroup> = ["needs-you", "working", "recent"];
  const byGroup = new Map<No3yRunGroup, Run[]>(order.map((group) => [group, []]));
  for (const run of runs) byGroup.get(no3yRunGroup(kindOf(run)))!.push(run);
  let left = limit;
  return order.flatMap((group) => {
    const shown = byGroup.get(group)!.slice(0, Math.max(0, left));
    left -= shown.length;
    return shown.length === 0 ? [] : [{ group, runs: shown }];
  });
}
