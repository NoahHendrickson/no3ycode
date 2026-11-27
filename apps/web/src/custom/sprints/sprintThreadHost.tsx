/**
 * How a sprint hosts the threads its conversation names — see `.fork/customizations.yaml#fork-sprints`
 * and `#fork-thread-launch-cards`. A thread opens in the sprint's panel, an answer the owner gives
 * from a card is noted in ANSWERS.md, and a settled card reads that answer back.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ProjectReadFileResult, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { readThreadShell, useQuietThreadShell } from "~/state/entities";
import { projectEnvironment } from "~/state/projects";

import { ForkThreadHookRow } from "../threadLaunchCards/ForkThreadLaunchCards";
import { ForkAnsweredRequestCard } from "../threadLaunchCards/ForkThreadRequestCard";
import type { ForkThreadHost } from "../threadLaunchCards/forkThreadHost";
import { noteSprintAnswer, type SprintFolder } from "./sprintFiles";
import { openInSprintPanel } from "./sprintPanelState";
import { SPRINT_ANSWERS_FILE, sprintAnswersFor } from "./sprintThreads";

function sprintFolderOf(shell: EnvironmentThreadShell | null): SprintFolder | null {
  return shell === null || shell.worktreePath === null
    ? null
    : { environmentId: shell.environmentId, cwd: shell.worktreePath };
}

const NO_LOG = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("sprint-answers:none"),
);

/** A settled card: the question and the owner's answer, when they gave it from the sprint's card;
    otherwise the thread's row alone. */
function SprintAnsweredRequest(props: {
  readonly thread: EnvironmentThreadShell;
  readonly reportKey: string;
  readonly hostRef: ScopedThreadRef | null;
  readonly kind: "question" | "approval";
}) {
  const folder = sprintFolderOf(useQuietThreadShell(props.hostRef));
  const result = useAtomValue(
    folder === null
      ? NO_LOG
      : projectEnvironment.readFile({
          environmentId: folder.environmentId,
          input: { cwd: folder.cwd, relativePath: SPRINT_ANSWERS_FILE, allowMissing: true },
        }),
  );
  const file = AsyncResult.getOrElse(result, () => null);
  const answers =
    file === null || file.exists === false
      ? null
      : sprintAnswersFor(file.contents, props.reportKey);
  return answers === null ? (
    <ForkThreadHookRow
      kind="report"
      threadRef={scopeThreadRef(props.thread.environmentId, props.thread.id)}
      fallbackTitle={null}
      hostRef={props.hostRef}
    />
  ) : (
    <ForkAnsweredRequestCard
      thread={props.thread}
      hostRef={props.hostRef}
      kind={props.kind}
      answers={answers}
    />
  );
}

/** One per sprint, so the timeline's context value holds still across renders. */
const hosts = new Map<string, ForkThreadHost>();

/** The sprint's host, for its timeline (ThreadTimeline's forkThreadHost). */
export function sprintThreadHost(sprintRef: ScopedThreadRef): ForkThreadHost {
  const key = scopedThreadKey(sprintRef);
  const known = hosts.get(key);
  if (known !== undefined) return known;
  const host: ForkThreadHost = {
    openThread: (ref) => openInSprintPanel(sprintRef, ref),
    onAnswered: (thread, requestId, answers) => {
      const folder = sprintFolderOf(readThreadShell(sprintRef));
      if (folder === null) return;
      void noteSprintAnswer(appAtomRegistry, folder, {
        threadTitle: thread.title,
        reportKey: `${thread.id}:${requestId}`,
        answers,
      });
    },
    AnsweredRequest: SprintAnsweredRequest,
  };
  hosts.set(key, host);
  return host;
}
