/**
 * Finished subagent cards after the reply — see
 * `.fork/customizations.yaml#fork-subagent-cards-after-reply`. A folded turn keeps a
 * settled subagent card where it ran, under "Worked for …" and above the reply; it
 * moves below the reply and its changed-files card, so the answer leads the turn.
 */
import { isLiveSubagentTurnItem } from "@t3tools/client-runtime/state/subagentRuntime";
import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

type Row = MessagesTimelineRow;

function isSettledSubagentCard(row: Row): boolean {
  if (row.kind !== "event" || row.projectedItem.item.type !== "subagent") return false;
  return (row.subagents ?? [row.projectedItem]).every(
    (member) => !isLiveSubagentTurnItem(member.item),
  );
}

const endsTurn = (row: Row) =>
  row.kind === "turn-fold" ||
  row.kind === "working" ||
  (row.kind === "message" && row.message.role === "user");

// Runs on useStableRows' output, whose arrays keep their identity while unchanged.
const ordered = new WeakMap<Row[], Row[]>();

function reorder(rows: Row[]): Row[] {
  let result: Row[] | null = null;
  for (let fold = 0; fold < rows.length; fold += 1) {
    const foldRow = rows[fold]!;
    if (foldRow.kind !== "turn-fold" || foldRow.expanded) continue;
    let end = fold + 1;
    while (end < rows.length && !endsTurn(rows[end]!)) end += 1;
    const turn = rows.slice(fold + 1, end);
    const replyIndex = turn.findLastIndex(
      (row) => row.kind === "message" && row.message.role === "assistant",
    );
    const reply = turn[replyIndex];
    if (reply?.kind !== "message") continue;
    const cards = turn.slice(0, replyIndex).filter(isSettledSubagentCard);
    if (cards.length === 0) continue;
    // The reply's copy and fork row is its own row after any trailing tool rows.
    const metaIndex = turn.findIndex(
      (row) => row.kind === "assistant-meta" && row.message.id === reply.message.id,
    );
    const after = Math.max(replyIndex, metaIndex) + 1;
    const moved = [
      ...turn.slice(0, after).filter((row) => !cards.includes(row)),
      ...cards,
      ...turn.slice(after),
    ];
    result ??= [...rows];
    result.splice(fold + 1, turn.length, ...moved);
    fold = end - 1;
  }
  return result ?? rows;
}

export function forkSubagentCardsAfterReply(rows: Row[]): Row[] {
  const cached = ordered.get(rows);
  if (cached) return cached;
  const result = reorder(rows);
  ordered.set(rows, result);
  return result;
}
