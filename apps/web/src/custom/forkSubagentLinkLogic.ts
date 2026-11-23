/**
 * How a subagent thread link in a message reads — see
 * `.fork/customizations.yaml#no3y-subagent-link-chip`. Mobile keeps its own copy in
 * apps/mobile/fork/no3ySubagentLinkChip.ts.
 */
import {
  threadRuntimeIsActive,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";

export type ForkSubagentLinkKind = "working" | "waiting" | "approval" | "input" | "done" | "failed";

export function isForkSubagentLinkThread(
  shell: Pick<EnvironmentThreadShell, "lineage" | "delegatedFrom">,
): boolean {
  return shell.lineage.relationshipToParent === "subagent" || shell.delegatedFrom != null;
}

/** Null for a child that never ran or was stopped: the capsule shows the idle mark. */
export function forkSubagentLinkKind(
  shell: Pick<
    EnvironmentThreadShell,
    | "hasPendingApprovals"
    | "hasPendingUserInput"
    | "pendingSubagentRequest"
    | "runtime"
    | "blockedOnThreadWait"
    | "latestRun"
  >,
): ForkSubagentLinkKind | null {
  // Mirrors resolveSidebarThreadStatus, including requests from the child's own children.
  if (shell.hasPendingApprovals || shell.pendingSubagentRequest === "approval") return "approval";
  if (shell.hasPendingUserInput || shell.pendingSubagentRequest === "user_input") return "input";
  const status = shell.runtime?.status;
  if ((status === "running" && shell.blockedOnThreadWait === true) || status === "idle") {
    return "waiting";
  }
  if (threadRuntimeIsActive(shell.runtime)) return "working";
  if (status === "failed" || shell.latestRun?.status === "failed") return "failed";
  return shell.latestRun?.status === "completed" ? "done" : null;
}

/** "Sol review r2: composer status chips" reads "Sol review r2"; a title with no head stays whole. */
export function forkSubagentLinkLabel(title: string): string {
  const colon = title.indexOf(": ");
  const head = colon < 0 ? "" : title.slice(0, colon).trim();
  return head.length >= 3 ? head : title;
}

const FENCED_CODE = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n\2[^\n]*|$)/g;
const INLINE_CODE = /`[^`\n]+`/g;
const THREAD_LINK_HREF = /\]\(<?(t3-thread:\/\/v[12]\/[^\s>)]+)>?\)/g;

/** Code renders literally, so its text is hidden (same length, newlines kept) before scanning. */
function maskCode(markdown: string): string {
  return markdown
    .replace(FENCED_CODE, (code) => code.replace(/[^\n]/g, "#"))
    .replace(INLINE_CODE, (code) => "#".repeat(code.length));
}

function matchesOf(pattern: RegExp, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  // exec rather than matchAll: Hermes' matchAll drops capture details.
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    matches.push(match);
  }
  return matches;
}

/** The `t3-thread` hrefs of the markdown's inline links outside code. */
export function forkSubagentLinkHrefs(markdown: string): ReadonlyArray<string> {
  const pattern = new RegExp(THREAD_LINK_HREF);
  return [...new Set(matchesOf(pattern, maskCode(markdown)).map((match) => match[1] ?? ""))];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Drops the period that closes a line right after one of `hrefs`, outside code: the capsule
 * already ends the line. Mid-line periods stay. While `streaming`, the end of the text is not yet
 * the end of a line, so only a period before a newline goes.
 */
export function dropPeriodAfterSubagentLinks(
  markdown: string,
  hrefs: Iterable<string>,
  streaming = false,
): string {
  const masked = maskCode(markdown);
  const periods: number[] = [];
  for (const href of hrefs) {
    const end = streaming ? "\\r?\\n" : "\\r?\\n|$";
    const pattern = new RegExp(`\\]\\(<?${escapeRegExp(href)}>?\\)\\.(?=[ \\t]*(?:${end}))`, "g");
    for (const match of matchesOf(pattern, masked)) periods.push(match.index + match[0].length - 1);
  }
  let next = markdown;
  for (const index of periods.sort((a, b) => b - a)) {
    next = next.slice(0, index) + next.slice(index + 1);
  }
  return next;
}
