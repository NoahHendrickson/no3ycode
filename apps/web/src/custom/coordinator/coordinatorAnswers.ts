/**
 * What the owner answered a coordinator's child, for the coordinator's answered card — see
 * `.fork/customizations.yaml#fork-coordinator-threads`. A coordinator keeps no ANSWERS.md, so the
 * answer is read off the child's own answered question item.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { getQuestionAnswerText } from "@t3tools/client-runtime/work-log/user-input";
import * as Option from "effect/Option";
import { Atom } from "effect/reactivity";

import { environmentThreadDetails } from "~/state/threads";

import type { ForkRequestAnswer } from "../threadLaunchCards/forkThreadHost";

interface AnsweredQuestionItem {
  readonly type: "user_input_request";
  readonly requestId: string;
  readonly questions: ReadonlyArray<{ readonly id: string; readonly question: string }>;
  readonly questionAnswer?:
    | {
        readonly questionTextById?: Readonly<Record<string, string>> | undefined;
        readonly answers: Readonly<Record<string, unknown>>;
      }
    | undefined;
}

const isQuestionItem = (item: { readonly type: string }): item is AnsweredQuestionItem =>
  item.type === "user_input_request";

/** Each question of the child's request `requestId` and the answer it got, or null when the
    request carries none (an approval, or an answer older than the item's record of it). */
export function childQuestionAnswers(
  turnItems: ReadonlyArray<{ readonly type: string }>,
  requestId: string,
): ForkRequestAnswer[] | null {
  const item = turnItems
    .filter(isQuestionItem)
    .findLast((candidate) => candidate.requestId === requestId);
  const record = item?.questionAnswer;
  if (item === undefined || record === undefined) return null;
  const answers = Object.entries(record.answers).flatMap(([id, value]) => {
    const answer = getQuestionAnswerText(value);
    if (answer === "") return [];
    const question =
      record.questionTextById?.[id] ?? item.questions.find((entry) => entry.id === id)?.question;
    return [{ question: question ?? id, answer }];
  });
  return answers.length === 0 ? null : answers;
}

/** An answer never changes once given, so a card that has read one stops following its child. */
const answeredByKey = new Map<string, ForkRequestAnswer[]>();

/** Follows the child until the answer shows up: its card re-renders once, then reads the cache. */
const answersAtomFamily = Atom.family((key: string) => {
  const [environmentId, threadId, requestId] = JSON.parse(key) as [EnvironmentId, ThreadId, string];
  return Atom.make((get) => {
    const projection = Option.getOrNull(
      get(environmentThreadDetails.stateAtom(scopeThreadRef(environmentId, threadId))).data,
    );
    const answers =
      projection === null ? null : childQuestionAnswers(projection.turnItems, requestId);
    if (answers !== null) answeredByKey.set(key, answers);
    return answers;
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(
      `coordinator-child-answers:${scopedThreadKey(scopeThreadRef(environmentId, threadId))}`,
    ),
  );
});

const answeredAtomFamily = Atom.family((key: string) =>
  Atom.make<ForkRequestAnswer[] | null>(answeredByKey.get(key) ?? null).pipe(
    Atom.withLabel("coordinator-child-answers:read"),
  ),
);

const NO_ANSWERS = Atom.make<ForkRequestAnswer[] | null>(null).pipe(
  Atom.withLabel("coordinator-child-answers:none"),
);

/** The answers of the child's question `requestId` for a settled card; an approval card reads
    nothing, so it never subscribes to its child. */
export function useChildQuestionAnswers(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id">,
  requestId: string | null,
  kind: "question" | "approval",
): ForkRequestAnswer[] | null {
  const key =
    kind !== "question" || requestId === null
      ? null
      : JSON.stringify([thread.environmentId, thread.id, requestId]);
  return useAtomValue(
    key === null
      ? NO_ANSWERS
      : answeredByKey.has(key)
        ? answeredAtomFamily(key)
        : answersAtomFamily(key),
  );
}
