/**
 * Follows T3's own thread events into webhook tasks that ask for them — see
 * `.fork/customizations.yaml#fork-bot-event-wakes`. Matching and delivery live in
 * ScheduledTaskService.deliverThreadEvent; this only turns domain events into thread events.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";
import { forkParked } from "../serverActivation.ts";
import { forkThreadEventFromDomainEvent } from "./forkThreadEventWakes.ts";
import * as ScheduledTaskService from "./ScheduledTaskService.ts";

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    const tasks = yield* ScheduledTaskService.ScheduledTaskService;
    yield* forkParked(
      Stream.runForEach(orchestrator.streamDomainEvents, (event) => {
        const threadEvent = forkThreadEventFromDomainEvent(event);
        return threadEvent === null
          ? Effect.void
          : tasks.deliverThreadEvent(threadEvent).pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("Thread event wake failed", {
                  threadId: threadEvent.threadId,
                  cause,
                }),
              ),
            );
      }),
    );
  }),
);
