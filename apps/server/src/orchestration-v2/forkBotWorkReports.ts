/**
 * A bot hears from its work — see `.fork/customizations.yaml#fork-bot-work-reports`: a queued
 * notice in its conversation when a top-level `bot-work:<bot>` thread settles a turn or waits on
 * someone. A turn the owner watched still reaches it, but tells it to stay quiet.
 */
import {
  CommandId,
  MessageId,
  type OrchestrationV2AppThread,
  type OrchestrationV2DomainEvent,
  type OrchestrationV2Run,
  type OrchestrationV2RuntimeRequest,
  ThreadId,
  isListedThreadLineage,
} from "@t3tools/contracts";
import { FORK_BOT_WORK_TAG_PREFIX, isForkBotThread } from "@t3tools/shared/forkBotTags";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import { forkParked } from "../serverActivation.ts";
import * as Orchestrator from "./Orchestrator.ts";
import * as ProjectionStore from "./ProjectionStore.ts";

const REPORT_MESSAGE_PREFIX = "message:fork-bot-work-report:";
/** A turn the owner watched: the bot updates its files and replies quietly. */
const SEEN_MESSAGE_PREFIX = "message:fork-bot-work-seen:";

/** How long after a turn the owner started a client still on the thread has to record a visit.
    An open thread records one on every update, at least every 10 seconds while it streams
    (client-runtime threadVisits). */
export const FORK_BOT_OWNER_WATCH_GRACE = "30 seconds";

/** Requests that wait on a person; a bot can answer a question, never an approval. */
const WAITING_REQUEST_KINDS: ReadonlySet<OrchestrationV2RuntimeRequest["kind"]> = new Set([
  "user_input",
  "command",
  "file-read",
  "file-change",
  "mcp-elicitation",
  "permission",
]);

/** The bot `thread` works for, when it is a top-level thread of a bot's work. */
export function forkBotWorkOwnerId(
  thread: Pick<OrchestrationV2AppThread, "tags" | "lineage">,
): ThreadId | null {
  // A subagent or side chat inherits its parent's tags; its parent reports for it.
  if (!isListedThreadLineage(thread.lineage)) return null;
  const tag = thread.tags?.find((candidate) => candidate.startsWith(FORK_BOT_WORK_TAG_PREFIX));
  return tag === undefined ? null : ThreadId.make(tag.slice(FORK_BOT_WORK_TAG_PREFIX.length));
}

type Report =
  | { readonly kind: "settled"; readonly run: OrchestrationV2Run; readonly seen?: boolean }
  | { readonly kind: "request"; readonly request: OrchestrationV2RuntimeRequest };

function reportText(work: OrchestrationV2AppThread, report: Report): string {
  const named = `your thread "${work.title}" (${work.id})`;
  if (report.kind === "settled" && report.seen === true) {
    return `Work report: your owner just watched ${named} ${report.run.status === "failed" ? "fail" : "finish"} a turn they started. Read its latest messages with t3_thread_read, threadId ${work.id}, limit 5.

This notice comes from T3 Code, not from your owner. They have already seen it, so do not report it. Your other threads may have changed too, so check them as well. Update STATE.md and DIGEST.md to match all of them, then reply with exactly "Nothing to report." unless another thread has something your owner has not seen.`;
  }
  const header =
    report.kind === "request"
      ? report.request.kind === "user_input"
        ? `Work report: ${named} asked a question and is waiting for an answer. Read it with t3_pending_request action read, threadId ${work.id}, requestId ${report.request.id}. Answer it with action respond only when JOB.md or CREW.md already settle it; otherwise tell your owner what it asks. If it is no longer pending, it was answered.`
        : `Work report: ${named} is waiting for your owner to approve an action. You cannot approve it: tell your owner what it wants to do.`
      : report.run.status === "failed"
        ? `Work report: ${named} failed its latest turn. Read its latest messages with t3_thread_read, threadId ${work.id}, limit 5.`
        : `Work report: ${named} finished a turn. Read its latest messages with t3_thread_read, threadId ${work.id}, limit 5.`;
  return `${header}

This notice comes from T3 Code, not from your owner. Handle it like a scheduled wake: update STATE.md (and DIGEST.md), then report only what needs your owner, or reply with exactly "Nothing to report." Your other threads may have changed too, so check them while you are at it.`;
}

function reportSummary(work: OrchestrationV2AppThread, report: Report): string {
  if (report.kind === "request") {
    return report.request.kind === "user_input"
      ? `${work.title} has a question`
      : `${work.title} needs an approval`;
  }
  const outcome = report.run.status === "failed" ? "failed" : "finished";
  return report.seen === true
    ? `${work.title} ${outcome} while you watched`
    : `${work.title} ${outcome}`;
}

export class ForkBotWorkReports extends Context.Service<
  ForkBotWorkReports,
  {
    readonly start: () => Effect.Effect<void, never, Scope.Scope>;
    readonly handle: (event: OrchestrationV2DomainEvent) => Effect.Effect<void>;
  }
>()("t3/orchestration-v2/forkBotWorkReports") {}

const make = Effect.gen(function* () {
  const engine = yield* Orchestrator.OrchestratorV2;
  const projections = yield* ProjectionStore.ProjectionStoreV2;

  // Owner turns wait out the grace off the event stream, for as long as the server runs.
  const graceScope = yield* Effect.scope;
  // Grace fibers and the stream report at once; one at a time, each sees the others' notices.
  const reportLock = yield* Semaphore.make(1);

  /** Who started `run`: T3 Code compacting an idle thread (never reported), the owner from the
      work thread, or anyone else (the bot, an agent, a wake). */
  const runOrigin = Effect.fnUntraced(function* (threadId: ThreadId, run: OrchestrationV2Run) {
    const { messages } = yield* projections.getThreadRecords(threadId, ["messages"], {
      messageIds: [run.userMessageId],
    });
    const message = messages[0];
    if (message?.idleCompaction !== undefined) return "quiet" as const;
    return message?.createdBy === "user" ? ("owner" as const) : ("other" as const);
  });

  /** Whether a client had the thread open at or after `since`. */
  const ownerWasThere = Effect.fnUntraced(function* (threadId: ThreadId, since: DateTime.Utc) {
    const { lastVisitedAt } = yield* projections.getThread(threadId);
    return lastVisitedAt !== null && DateTime.isGreaterThanOrEqualTo(lastVisitedAt, since);
  });

  const report = Effect.fnUntraced(function* (
    work: OrchestrationV2AppThread,
    botId: ThreadId,
    key: string,
    value: Report,
  ) {
    const bot = yield* projections.getThreadRecords(botId, ["runs"], { runStatuses: ["queued"] });
    if (
      !isForkBotThread(bot.thread.tags) ||
      bot.thread.archivedAt !== null ||
      bot.thread.deletedAt !== null
    ) {
      return;
    }
    // A queued notice tells the bot to look at all of its work, so it covers this one; a quiet
    // one covers only another quiet one, since it tells the bot to say nothing.
    const seen = value.kind === "settled" && value.seen === true;
    const covering = seen ? [REPORT_MESSAGE_PREFIX, SEEN_MESSAGE_PREFIX] : [REPORT_MESSAGE_PREFIX];
    if (bot.runs.some((run) => covering.some((prefix) => run.userMessageId.startsWith(prefix)))) {
      return;
    }
    const text = reportText(work, value);
    yield* engine.dispatch({
      type: "message.dispatch",
      commandId: CommandId.make(`server:fork-bot-work-${seen ? "seen" : "report"}:${key}`),
      threadId: botId,
      messageId: MessageId.make(`${seen ? SEEN_MESSAGE_PREFIX : REPORT_MESSAGE_PREFIX}${key}`),
      text,
      notification: {
        source: { kind: "system" },
        outcome: value.kind === "settled" && value.run.status === "failed" ? "failed" : "updated",
        summary: reportSummary(work, value),
        detail: text,
      },
      attachments: [],
      dispatchMode: { type: "queue_after_active" },
      createdBy: "agent",
      creationSource: "server",
    });
  }, reportLock.withPermits(1));

  // Runs for every domain event; most return before reading anything.
  const handle: ForkBotWorkReports["Service"]["handle"] = Effect.fnUntraced(
    function* (event) {
      if (event.type === "run.updated") {
        const run = event.payload;
        if (run.status !== "completed" && run.status !== "failed") return;
        const work = yield* projections.getThread(event.threadId);
        const botId = forkBotWorkOwnerId(work);
        if (botId === null) return;
        const origin = yield* runOrigin(work.id, run);
        if (origin === "quiet") return;
        const key = `${work.id}:${run.id}:${run.status}`;
        if (origin === "other") return yield* report(work, botId, key, { kind: "settled", run });
        const settledAt = run.completedAt ?? event.occurredAt;
        yield* Effect.sleep(FORK_BOT_OWNER_WATCH_GRACE).pipe(
          Effect.andThen(ownerWasThere(work.id, settledAt)),
          Effect.flatMap((seen) => report(work, botId, key, { kind: "settled", run, seen })),
          Effect.catchCause((cause) =>
            Effect.logWarning("fork-bot-work-report.failed", { threadId: work.id, cause }),
          ),
          Effect.forkIn(graceScope),
        );
        return;
      }
      if (event.type === "runtime-request.updated") {
        const request = event.payload;
        if (request.status !== "pending" || !WAITING_REQUEST_KINDS.has(request.kind)) return;
        const work = yield* projections.getThread(event.threadId);
        const botId = forkBotWorkOwnerId(work);
        if (botId === null) return;
        const run =
          event.runId === undefined
            ? undefined
            : (yield* projections.getThreadRecords(work.id, ["runs"], { runIds: [event.runId] }))
                .runs[0];
        const origin = run === undefined ? "other" : yield* runOrigin(work.id, run);
        if (origin === "quiet") return;
        const send = report(work, botId, `${work.id}:${request.id}`, { kind: "request", request });
        if (origin === "other") return yield* send;
        // Still waiting, and no one was on the thread to see it ask.
        yield* Effect.sleep(FORK_BOT_OWNER_WATCH_GRACE).pipe(
          Effect.andThen(
            Effect.all([
              projections.getRuntimeRequest(work.id, request.id),
              ownerWasThere(work.id, request.createdAt),
            ]),
          ),
          Effect.flatMap(([current, watched]) =>
            current?.status !== "pending" || watched ? Effect.void : send,
          ),
          Effect.catchCause((cause) =>
            Effect.logWarning("fork-bot-work-report.failed", { threadId: work.id, cause }),
          ),
          Effect.forkIn(graceScope),
        );
      }
    },
    (effect, event) =>
      effect.pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("fork-bot-work-report.failed", { threadId: event.threadId, cause }),
        ),
      ),
  );

  const start: ForkBotWorkReports["Service"]["start"] = () =>
    forkParked(
      Stream.runForEach(engine.streamDomainEvents, handle).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("fork-bot-work-report.stream-failed", { cause }),
        ),
      ),
    );

  return { start, handle } satisfies ForkBotWorkReports["Service"];
});

export const layer = Layer.effect(ForkBotWorkReports, make);
