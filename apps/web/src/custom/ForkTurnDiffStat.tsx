import type { RunId } from "@t3tools/contracts";
import { turnChanges, turnHasChanges } from "@t3tools/client-runtime/state/thread-repositories";
import { useGT } from "gt-react";
import { ChevronRightIcon } from "./icons/lucide-hugeicons";
import { DiffStatLabel } from "../components/chat/DiffStatLabel";
import type { TurnDiffSummary } from "../types";

/** A finished turn's `+N −M ›` on its "Worked for" row; opens the turn's diff. */
export function ForkTurnDiffStat({
  summary,
  onOpenTurnDiff,
}: {
  summary: TurnDiffSummary;
  onOpenTurnDiff: (runId: RunId) => void;
}) {
  const gt = useGT();
  if (!turnHasChanges(summary)) return null;
  const { totals } = turnChanges(summary);

  return (
    <button
      type="button"
      data-scroll-anchor-ignore
      aria-label={gt(
        "{count, plural, one {{formattedCount} changed file} other {{formattedCount} changed files}}",
        { count: totals.count, formattedCount: totals.count.toLocaleString() },
      )}
      onClick={() => onOpenTurnDiff(summary.runId)}
      className="flex shrink-0 cursor-pointer select-none items-center gap-1 rounded-md px-1 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
    >
      <DiffStatLabel additions={totals.additions} deletions={totals.deletions} layout="inline" />
      <ChevronRightIcon aria-hidden className="size-3.5" />
    </button>
  );
}
