/**
 * The conversation a timeline's thread rows sit in, when it hosts them its own way — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. A sprint supplies one (sprints/
 * sprintThreadHost), so the cards and thread links stay free of sprint code; without one a thread
 * opens beside the conversation and a report row is the thread's row alone.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { RuntimeRequestId, ScopedThreadRef } from "@t3tools/contracts";
import { type ComponentType, createContext, use } from "react";

import type { ForkWorkReport, forkDelegatedQuestionOf } from "../forkWorkReports";

/** One question and what the owner answered; for an approval, what it asked and the decision. */
export interface ForkRequestAnswer {
  readonly question: string;
  readonly answer: string;
}

export interface ForkThreadHost {
  /** A delegate_task child's question notice as the card the host answers it on (a coordinator's
      forkDelegatedQuestionOf, fork-coordinator-threads); null leaves the plain notice, as a
      sprint's does. */
  readonly delegatedQuestionOf: (
    notice: Parameters<typeof forkDelegatedQuestionOf>[0],
  ) => ForkWorkReport | null;
  /** Opens a thread named in the conversation in the host's own place; false leaves it to the
      caller, as for the host itself. */
  readonly openThread: (ref: ScopedThreadRef) => boolean;
  /** The owner answered one of the host's threads from its card in the conversation. */
  readonly onAnswered: (
    thread: EnvironmentThreadShell,
    requestId: RuntimeRequestId,
    answers: ReadonlyArray<ForkRequestAnswer>,
  ) => void;
  /** A settled question or approval: the host draws what was answered, or the thread's row. */
  readonly AnsweredRequest: ComponentType<{
    readonly thread: EnvironmentThreadShell;
    /** The work report's `threadId:requestId`. */
    readonly reportKey: string;
    /** The request that key names, or null when it names none. */
    readonly requestId: RuntimeRequestId | null;
    /** The conversation the card sits in. */
    readonly hostRef: ScopedThreadRef | null;
    readonly kind: "question" | "approval";
  }>;
}

/** Set around a conversation's timeline only, so a nested conversation sets its own. */
export const ForkThreadHostContext = createContext<ForkThreadHost | null>(null);

export function useForkThreadHost(): ForkThreadHost | null {
  return use(ForkThreadHostContext);
}
