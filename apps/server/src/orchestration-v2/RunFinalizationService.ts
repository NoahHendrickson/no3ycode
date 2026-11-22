import {
  CheckpointScopeId,
  ProjectId,
  RunId,
  ThreadId,
  /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow */
  type VcsStatusLocalResult,
  /* fork:end server-local-checkout-branch-follow */
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FiberMap from "effect/FiberMap";
import * as FiberSet from "effect/FiberSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as ProjectEnrichment from "../project/ProjectEnrichmentService.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as PullRequestService from "../pullRequest/PullRequestService.ts";
import * as VcsStatusBroadcaster from "../vcs/VcsStatusBroadcaster.ts";
import * as WorkspaceEntries from "../workspace/WorkspaceEntries.ts";
import * as CheckpointCapture from "./CheckpointCaptureService.ts";
import * as ProjectionStore from "./ProjectionStore.ts";
/* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow */
import { LocalCheckoutBranchFollower } from "./forkLocalCheckoutBranchFollow.ts";
/* fork:end server-local-checkout-branch-follow */

const REPOSITORY_REFRESH_CONCURRENCY = 4;

export class RunFinalizationError extends Schema.TaggedError<RunFinalizationError>()(
  "RunFinalizationError",
  {
    threadId: ThreadId,
    runId: RunId,
    scopeId: CheckpointScopeId,
    operation: Schema.Literals(["capture-checkpoint", "refresh-workspace"]),
    cause: Schema.Defect(),
  },
) {}

export class RunFinalizationRefreshError extends Schema.TaggedError<RunFinalizationRefreshError>()(
  "RunFinalizationRefreshError",
  { cwd: Schema.String, cause: Schema.Defect() },
) {}

export class RunFinalizationObserver extends Context.Reference<{
  readonly refreshAfterTurn: (projectId: ProjectId) => Effect.Effect<void>;
  readonly refresh: (input: {
    readonly cwd: string;
    readonly threadId: ThreadId;
    readonly runId: RunId;
    /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow
       The refresh hands back the checkout status it already read, so finalize
       can follow the branch a local thread's turn ran on without a second
       git status; null when no observer is installed. */
  }) => Effect.Effect<VcsStatusLocalResult | null, RunFinalizationRefreshError>;
  /** Local status of the tracked repositories a run checkpointed. Returns before it finishes. */
  readonly refreshRepositories: (input: {
    readonly threadId: ThreadId;
    readonly cwds: ReadonlyArray<string>;
  }) => Effect.Effect<void>;
}>("t3/orchestration-v2/RunFinalizationObserver", {
  defaultValue: () => ({
    refresh: () => Effect.succeed(null),
    refreshAfterTurn: () => Effect.void,
    refreshRepositories: () => Effect.void,
  }),
  /* fork:end server-local-checkout-branch-follow */
}) {}

export class RunFinalizationService extends Context.Service<
  RunFinalizationService,
  {
    readonly finalize: (input: {
      readonly threadId: ThreadId;
      readonly runId: RunId;
      readonly scopeId: CheckpointScopeId;
    }) => Effect.Effect<void, RunFinalizationError>;
  }
>()("t3/orchestration-v2/RunFinalizationService") {}

const make = Effect.gen(function* () {
  const checkpointCapture = yield* CheckpointCapture.CheckpointCaptureServiceV2;
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const observer = yield* RunFinalizationObserver;
  /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow */
  const follower = yield* LocalCheckoutBranchFollower;
  /* fork:end server-local-checkout-branch-follow */
  const refreshes = yield* FiberSet.make<void>();

  const finalize: RunFinalizationService["Service"]["finalize"] = Effect.fn(
    "RunFinalizationService.finalize",
  )(function* (input) {
    yield* checkpointCapture
      .execute(input)
      .pipe(
        Effect.mapError(
          (cause) => new RunFinalizationError({ ...input, operation: "capture-checkpoint", cause }),
        ),
      );
    const projection = yield* projections
      .getCheckpointContext(input.threadId)
      .pipe(
        Effect.mapError(
          (cause) => new RunFinalizationError({ ...input, operation: "refresh-workspace", cause }),
        ),
      );
    const cwd = projection.checkpointScopes.find((scope) => scope.id === input.scopeId)?.cwd;
    if (cwd !== undefined) {
      // The refresh only updates the display, so the thread's next turn must not wait for it.
      // Never replaced by a newer one: back-to-back turns would interrupt each before it publishes.
      /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow
         The thread whose turn just ran on the shared checkout adopts the branch found there
         before finalize returns: its next queued turn would otherwise start first and win the
         follower's run guard. Other threads keep upstream's background refresh. */
      const refresh = observer.refresh({ cwd, threadId: input.threadId, runId: input.runId }).pipe(
        Effect.catchTags({
          RunFinalizationRefreshError: (cause) =>
            Effect.logWarning("Failed to refresh workspace after checkpoint capture", {
              ...input,
              cause,
            }).pipe(Effect.as(null)),
        }),
        Effect.flatMap((local) =>
          local === null
            ? Effect.void
            : follower.follow({ cwd, threadId: input.threadId, runId: input.runId, local }),
        ),
      );
      if (yield* follower.canFollow(input.threadId)) yield* refresh;
      else yield* refresh.pipe(FiberSet.run(refreshes));
      /* fork:end server-local-checkout-branch-follow */
    }
    const repositoryScopeIds = new Set(
      projection.checkpoints.flatMap((checkpoint) =>
        checkpoint.runId === input.runId ? [checkpoint.scopeId] : [],
      ),
    );
    const cwds = projection.checkpointScopes.flatMap((scope) =>
      typeof scope.repositoryPath === "string" && repositoryScopeIds.has(scope.id)
        ? [scope.cwd]
        : [],
    );
    if (cwds.length > 0) yield* observer.refreshRepositories({ threadId: input.threadId, cwds });
  });
  return RunFinalizationService.of({ finalize });
});

export const layer = Layer.effect(RunFinalizationService, make);

export const layerObserver = Layer.effect(
  RunFinalizationObserver,
  Effect.gen(function* () {
    const workspaceEntries = yield* WorkspaceEntries.WorkspaceEntries;
    const vcsStatus = yield* VcsStatusBroadcaster.VcsStatusBroadcaster;
    const projections = yield* ProjectionStore.ProjectionStoreV2;
    const pullRequests = yield* PullRequestService.PullRequestService;
    const projects = yield* ProjectService.ProjectService;
    const enrichment = yield* ProjectEnrichment.ProjectEnrichmentService;
    const pullRequestLookups = yield* FiberMap.make<string>();
    const repositoryRefreshes = yield* FiberMap.make<ThreadId>();
    const identityRefreshes = yield* FiberMap.make<ProjectId>();
    /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow */
    const rescans = yield* FiberSet.make<void>();
    /* fork:end server-local-checkout-branch-follow */
    // A turn can add the first remote (`git remote add`, `gh repo create --push`), which the
    // enrichment and resolver caches would otherwise keep reporting as missing for a minute.
    const refreshMissingRepositoryIdentity = Effect.fn(
      "RunFinalizationService.refreshMissingRepositoryIdentity",
    )(
      function* (projectId: ProjectId) {
        const project = yield* projects.getById(projectId);
        if (Option.isNone(project)) return;
        const { workspaceRoot } = project.value;
        if ((yield* enrichment.readRepositoryIdentity(workspaceRoot)) !== null) return;
        yield* enrichment.refreshRepositoryIdentity(workspaceRoot);
      },
      (effect, projectId) =>
        effect.pipe(
          Effect.catch((error) =>
            Effect.logWarning("failed to refresh repository identity after run completion", {
              projectId,
              detail: error.message,
            }),
          ),
        ),
    );
    return {
      refreshAfterTurn: pullRequests.refreshAfterTurn,
      // A project can track dozens of repositories, so the next turn must not wait for them all.
      // A newer turn's refresh replaces a running one.
      refreshRepositories: Effect.fn("RunFinalizationService.refreshRepositories")(function* ({
        threadId,
        cwds,
      }) {
        yield* Effect.forEach(
          cwds,
          (cwd) =>
            vcsStatus.refreshLocalStatus(cwd).pipe(
              Effect.catch((error) =>
                Effect.logWarning("failed to refresh repository status after run completion", {
                  threadId,
                  cwd,
                  detail: error.message,
                }),
              ),
            ),
          { concurrency: REPOSITORY_REFRESH_CONCURRENCY, discard: true },
        ).pipe(FiberMap.run(repositoryRefreshes, threadId));
      }),
      refresh: Effect.fn("RunFinalizationService.refresh")(
        function* ({ cwd, threadId, runId }) {
          /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow
             Finalize awaits this refresh for a shared-checkout thread's branch follow, which needs
             only the status; the file-index rescan runs on, like the PR lookup. */
          yield* workspaceEntries.refresh(cwd).pipe(FiberSet.run(rescans));
          const local = yield* vcsStatus.refreshLocalStatus(cwd);
          /* fork:end server-local-checkout-branch-follow */
          /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow
             Every exit returns the status read above; see the observer shape. */
          const thread = yield* projections.getThreadShell(threadId);
          if (!thread) return local;
          // Forge discovery probes can take seconds; like the PR lookup, the next turn must not wait.
          yield* refreshMissingRepositoryIdentity(thread.projectId).pipe(
            FiberMap.run(identityRefreshes, thread.projectId),
          );
          if (local.refName === null || local.isDefaultRef) return local;
          if (thread.branch !== local.refName) return local;
          if (thread.activeRunId !== null && thread.activeRunId !== runId) return local;
          /* fork:end server-local-checkout-branch-follow */
          // The forge CLI can take minutes, so the next turn must not wait for it. A newer
          // turn's lookup replaces a running one instead of queueing behind the cwd's lock.
          yield* vcsStatus.refreshPullRequestStatus(cwd).pipe(
            Effect.catch((error) =>
              Effect.logWarning("failed to refresh pull request status after run completion", {
                threadId,
                cwd,
                detail: error.message,
              }),
            ),
            FiberMap.run(pullRequestLookups, cwd),
          );
          /* fork:begin server-local-checkout-branch-follow — see .fork/customizations.yaml#server-local-checkout-branch-follow */
          return local;
          /* fork:end server-local-checkout-branch-follow */
        },
        (effect, { cwd }) =>
          effect.pipe(Effect.mapError((cause) => new RunFinalizationRefreshError({ cwd, cause }))),
      ),
    };
  }),
);
