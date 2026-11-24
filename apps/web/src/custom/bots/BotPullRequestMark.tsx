/**
 * A pull request's state icon and number in a bot's Threads panel — see
 * `.fork/customizations.yaml#fork-bot-digest`: its thread rows and its digest draw the same mark.
 */
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import type { EnvironmentId } from "@t3tools/contracts";

import {
  PullRequestGlyph,
  type PullRequestStatePresentation,
} from "~/components/pullRequest/pullRequestIcons";
import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { cn } from "~/lib/utils";
import { useSharedPullRequestSummary } from "~/state/pullRequests";

import type { BotPullRequest } from "@t3tools/client-runtime/fork-bot-digest-links";

/** Its state and title: a thread's own link carries them; for a branch's pull request, the
    summary the sidebar badge already read, if it has. */
export function useBotPullRequestState(
  pullRequest: BotPullRequest | null,
  environmentId: EnvironmentId,
): { readonly state: PullRequestStatePresentation | null; readonly title: string | null } {
  const branch = pullRequest?.branch ?? null;
  const host =
    branch === null ? undefined : sourceControlClients.parseChangeRequestUrl(branch.url)?.link.host;
  const summary = useSharedPullRequestSummary(
    branch === null ? null : environmentId,
    branch === null
      ? null
      : {
          projectId: branch.projectId,
          repository: branch.repository,
          number: branch.number,
          ...(host === undefined ? {} : { host }),
        },
  );
  const snapshot = pullRequest?.snapshot ?? null;
  if (snapshot !== null) return { state: resolvePullRequestState(snapshot), title: snapshot.title };
  if (summary === null) return { state: null, title: null };
  return {
    state: resolvePullRequestState({ state: summary.state, isDraft: summary.isDraft ?? false }),
    title: summary.title,
  };
}

export function BotPullRequestMark(props: {
  readonly number: number;
  readonly state: PullRequestStatePresentation | null;
}) {
  const { state } = props;
  const Icon = state?.Icon ?? PullRequestGlyph.pullRequest;
  return (
    <span className={cn("flex shrink-0 items-center gap-1 tabular-nums", state?.toneClassName)}>
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="sr-only">
        {state === null ? "Pull request" : `${state.label} pull request`}
      </span>
      {props.number}
    </span>
  );
}
