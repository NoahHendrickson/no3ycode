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
import { forkBotWorkOwner, isForkBotThread } from "@t3tools/shared/forkBotTags";
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
  const owner = forkBotWorkOwner(thread.tags);
  return owner === null ? null : ThreadId.make(owner);
}

type Report =
  | { readonly kind: "settled"; readonly run: OrchestrationV2Run }
  /** A turn the owner watched settle: the bot updates its files and says nothing. */
  | { readonly kind: "watched"; readonly run: OrchestrationV2Run }
  | { readonly kind: "request"; readonly request: OrchestrationV2RuntimeRequest };

interface Notice {
  readonly prefix: string;
  /** Queued notices that already send the bot to all of its work, so this one adds nothing. */
  readonly coveredBy: ReadonlyArray<string>;
  readonly text: string;
  readonly summary: string;
  readonly outcome: "failed" | "updated";
}

const CHECK_THE_REST = `This notice comes from T3 Code, not from your owner. Handle it like a scheduled wake: update STATE.md (and DIGEST.md), then report only what needs your owner, or reply with exactly "Nothing to report." Your other threads may have changed too, so check them while you are at it.`;

function notice(work: OrchestrationV2AppThread, report: Report): Notice {
  const named = `your thread "${work.title}" (${work.id})`;
  const read = `Read its latest messages with t3_thread_read, threadId ${work.id}, limit 5.`;
  switch (report.kind) {
    case "settled": {
      const failed = report.run.status === "failed";
      return {
        prefix: REPORT_MESSAGE_PREFIX,
        coveredBy: [REPORT_MESSAGE_PREFIX],
        text: `Work report: ${named} ${failed ? "failed its latest turn" : "finished a turn"}. ${read}\n\n${CHECK_THE_REST}`,
        summary: `${work.title} ${failed ? "failed" : "finished"}`,
        outcome: failed ? "failed" : "updated",
      };
    }
    case "watched": {
      const failed = report.run.status === "failed";
      return {
        prefix: SEEN_MESSAGE_PREFIX,
        // A queued quiet notice tells the bot to say nothing, so it never covers a real report.
        coveredBy: [REPORT_MESSAGE_PREFIX, SEEN_MESSAGE_PREFIX],
        text: `Work report: your owner just watched ${named} ${failed ? "fail" : "finish"} a turn they started. ${read}\n\nThis notice comes from T3 Code, not from your owner. They have already seen it, so do not report it. Your other threads may have changed too, so check them as well. Update STATE.md and DIGEST.md to match all of them, then reply with exactly "Nothing to report." unless another thread has something your owner has not seen.`,
        summary: `${work.title} ${failed ? "failed" : "finished"} while you watched`,
        outcome: failed ? "failed" : "updated",
      };
    }
    case "request": {
      const question = report.request.kind === "user_input";
      return {
        prefix: REPORT_MESSAGE_PREFIX,
        // Someone is waiting: always said outright, never left to a notice about other work.
        coveredBy: [],
        text: question
          ? `Work report: ${named} asked a question and is waiting for an answer. Read it with t3_pending_request action read, threadId ${work.id}, requestId ${report.request.id}. Answer it with action respond only when JOB.md or CREW.md already settle it; otherwise tell your owner what it asks. If it is no longer pending, it was answered.\n\n${CHECK_THE_REST}`
          : `Work report: ${named} is waiting for your owner to approve an action. You cannot approve it: tell your owner what it wants to do.\n\n${CHECK_THE_REST}`,
        summary: `${work.title} ${question ? "has a question" : "needs an approval"}`,
        outcome: "updated",
      };
    }
  }
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

  const logFailure = (threadId: ThreadId) => (cause: unknown) =>
    Effect.logWarning("fork-bot-work-report.failed", { threadId, cause });

  /** Who started `run`: T3 Code compacting an idle thread (never reported), the owner from the
      work thread, or anyone else (the bot, an agent, a wake). */
  const runOrigin = Effect.fnUntraced(function* (threadId: ThreadId, run: OrchestrationV2Run) {
    const { messages } = yield* projections.getThreadRecords(threadId, ["messages"], {
      messageIds: [run.userMessageId],
    });
    const message = messages[0];
    if (message?.idleCompaction !== undefined) return "compaction" as const;
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
    const next = notice(work, value);
    if (
      bot.runs.some((run) => next.coveredBy.some((prefix) => run.userMessageId.startsWith(prefix)))
    ) {
      return;
    }
    yield* engine.dispatch({
      type: "message.dispatch",
      commandId: CommandId.make(`server:${next.prefix.slice("message:".length)}${key}`),
      threadId: botId,
      messageId: MessageId.make(`${next.prefix}${key}`),
      text: next.text,
      notification: {
        source: { kind: "system" },
        outcome: next.outcome,
        summary: next.summary,
        detail: next.text,
      },
      attachments: [],
      dispatchMode: { type: "queue_after_active" },
      createdBy: "agent",
      creationSource: "server",
    });
  }, reportLock.withPermits(1));

  /** For a turn the owner started: waits out the grace off the event stream, then sends what
      `decide` makes of what the owner saw, if anything. */
  const afterOwnerGrace = (
    work: OrchestrationV2AppThread,
    botId: ThreadId,
    key: string,
    decide: Effect.Effect<Report | null, ProjectionStore.ProjectionStoreV2Error>,
  ) =>
    Effect.sleep(FORK_BOT_OWNER_WATCH_GRACE).pipe(
      Effect.andThen(decide),
      Effect.flatMap((value) => (value === null ? Effect.void : report(work, botId, key, value))),
      Effect.catchCause(logFailure(work.id)),
      Effect.forkIn(graceScope),
      Effect.asVoid,
    );

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
        if (origin === "compaction") return;
        const key = `${work.id}:${run.id}:${run.status}`;
        if (origin === "other") return yield* report(work, botId, key, { kind: "settled", run });
        yield* afterOwnerGrace(
          work,
          botId,
          key,
          ownerWasThere(work.id, run.completedAt ?? event.occurredAt).pipe(
            Effect.map((seen) => ({ kind: seen ? "watched" : "settled", run }) as const),
          ),
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
        if (origin === "compaction") return;
        const key = `${work.id}:${request.id}`;
        const value: Report = { kind: "request", request };
        if (origin === "other") return yield* report(work, botId, key, value);
        // The owner answers it there if they saw it ask, and nothing is sent once it is answered.
        yield* afterOwnerGrace(
          work,
          botId,
          key,
          Effect.all([
            projections.getRuntimeRequest(work.id, request.id),
            ownerWasThere(work.id, request.createdAt),
          ]).pipe(
            Effect.map(([current, watched]) =>
              current?.status !== "pending" || watched ? null : value,
            ),
          ),
        );
      }
    },
    (effect, event) => effect.pipe(Effect.catchCause(logFailure(event.threadId))),
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
