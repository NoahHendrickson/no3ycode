/** A coordinator's re-ask of a child's question — see `.fork/customizations.yaml#fork-coordinator-threads`.
    The server's child-question notice tells a parent to ask the owner itself; in a coordinator the
    owner answers on the child's card, so such a question only duplicates it. */
import type { RuntimeRequestId } from "@t3tools/contracts";

const PENDING_REQUEST_TOOL = "t3_pending_request";

const normalized = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Every question text the thread read off a child's pending request. */
function readChildQuestions(
  turnItems: ReadonlyArray<{
    readonly type: string;
    readonly toolName?: string | null;
    readonly input?: unknown;
    readonly output?: unknown;
  }>,
): ReadonlySet<string> {
  const read = new Set<string>();
  for (const item of turnItems) {
    if (item.type !== "dynamic_tool" || !item.toolName?.endsWith(PENDING_REQUEST_TOOL)) continue;
    if (!isRecord(item.input) || item.input.action !== "read") continue;
    const questions = isRecord(item.output) ? item.output.questions : undefined;
    if (!Array.isArray(questions)) continue;
    for (const question of questions) {
      if (isRecord(question) && typeof question.question === "string") {
        read.add(normalized(question.question));
      }
    }
  }
  return read;
}

/** The coordinator's own open questions that only repeat a child's: message-mode (a dismiss
    cancels them, nothing waits on an answer), every question one it read off a child. */
export function coordinatorMirroredQuestions(
  pending: ReadonlyArray<{
    readonly requestId: RuntimeRequestId;
    readonly responseMode?: "message" | undefined;
    readonly questions: ReadonlyArray<{ readonly question: string }>;
  }>,
  turnItems: Parameters<typeof readChildQuestions>[0],
): RuntimeRequestId[] {
  const own = pending.filter((input) => input.responseMode === "message");
  if (own.length === 0) return [];
  const read = readChildQuestions(turnItems);
  return own
    .filter(
      (input) =>
        input.questions.length > 0 &&
        input.questions.every((question) => read.has(normalized(question.question))),
    )
    .map((input) => input.requestId);
}
