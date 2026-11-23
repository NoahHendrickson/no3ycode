/**
 * How a subagent thread link in a message reads — see
 * `.fork/customizations.yaml#no3y-subagent-link-chip`: a neutral capsule with the child's live
 * status mark and its short title, and no stray period after it.
 */
import {
  threadRuntimeIsActive,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";

import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";

export type No3ySubagentChipKind = Extract<
  SidebarV2CardStatusKind,
  "working" | "waiting" | "approval" | "input" | "done" | "failed"
>;

export function isNo3ySubagentChipThread(
  shell: Pick<EnvironmentThreadShell, "lineage" | "delegatedFrom">,
): boolean {
  return shell.lineage.relationshipToParent === "subagent" || shell.delegatedFrom != null;
}

/** Null for a child that never ran or was stopped: the capsule shows the idle ring. */
export function no3ySubagentChipKind(
  shell: Pick<
    EnvironmentThreadShell,
    "hasPendingApprovals" | "hasPendingUserInput" | "runtime" | "blockedOnThreadWait" | "latestRun"
  >,
): No3ySubagentChipKind | null {
  if (shell.hasPendingApprovals) return "approval";
  if (shell.hasPendingUserInput) return "input";
  const status = shell.runtime?.status;
  // Mirrors resolveSidebarThreadStatus: blocked on another thread, or parked on background work.
  if ((status === "running" && shell.blockedOnThreadWait === true) || status === "idle") {
    return "waiting";
  }
  if (threadRuntimeIsActive(shell.runtime)) return "working";
  if (status === "failed" || shell.latestRun?.status === "failed") return "failed";
  return shell.latestRun?.status === "completed" ? "done" : null;
}

/** "Sol review r2: composer status chips" reads "Sol review r2"; a title with no head stays whole. */
export function no3ySubagentChipLabel(title: string): string {
  const colon = title.indexOf(": ");
  const head = colon < 0 ? "" : title.slice(0, colon).trim();
  return head.length >= 3 ? head : title;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Drops the period that closes a line right after one of `hrefs`: the capsule already ends the
 * line, and the dot would sit on its own past the pill's gap. Mid-line periods stay, since they
 * still separate sentences.
 */
export function dropPeriodAfterSubagentChips(markdown: string, hrefs: Iterable<string>): string {
  let next = markdown;
  for (const href of hrefs) {
    const target = escapeRegExp(href);
    next = next.replace(
      new RegExp(`(\\]\\(<?${target}>?\\))\\.(?=[ \\t]*(?:\\r?\\n|$))`, "g"),
      "$1",
    );
  }
  return next;
}
