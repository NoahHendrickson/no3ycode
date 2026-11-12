/**
 * Which branch a bootstrap-created thread records — see
 * `.fork/customizations.yaml#server-local-thread-branch`.
 *
 * Upstream mobile records a branch only when its picker is tapped, so the
 * untouched "Current checkout" default arrives as null and the thread never
 * shows a branch on any other surface. The server can read the checkout's
 * branch, so it fills the label in at creation instead of waiting on a client
 * release.
 *
 * Precedence: an explicit client branch always wins; a worktree being
 * prepared names its own branch through that flow; an existing worktree path
 * is the checkout to read, the project root is the fallback. The source is
 * the live HEAD (one `git symbolic-ref`), never listRefs' cache-served flag
 * or a full status, whose diff stats this never uses. A detached HEAD, a
 * non-repository project, a missing project, or a git failure yields null
 * with a warning rather than fabricating a branch or failing the create.
 *
 * A temporary worktree placeholder (`t3/…`) is never adopted, matching the
 * checkpoint and provider reactors: recording it would make this thread's
 * first turn rename a worktree it does not own.
 */
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { ProjectId, ThreadId } from "@t3tools/contracts";
import { isTemporaryWorktreeBranch } from "@t3tools/shared/git";

export interface BootstrapThreadBranchInput {
  readonly threadId: ThreadId;
  readonly projectId: ProjectId;
  readonly branch: string | null;
  readonly worktreePath: string | null;
  /** True when the same bootstrap also prepares a new worktree. */
  readonly preparingWorktree: boolean;
}

export interface BootstrapThreadBranchDeps<ProjectError = never, BranchError = never> {
  readonly getProjectShellById: (
    projectId: ProjectId,
  ) => Effect.Effect<Option.Option<{ readonly workspaceRoot: string }>, ProjectError>;
  /** Null on a detached HEAD or a non-repository checkout. */
  readonly currentBranch: (cwd: string) => Effect.Effect<string | null, BranchError>;
}

export const resolveBootstrapThreadBranch = <ProjectError, BranchError>(
  input: BootstrapThreadBranchInput,
  deps: BootstrapThreadBranchDeps<ProjectError, BranchError>,
): Effect.Effect<string | null> => {
  if (input.branch !== null || input.preparingWorktree) {
    return Effect.succeed(input.branch);
  }
  return Effect.gen(function* () {
    const cwd =
      input.worktreePath ??
      Option.getOrNull(
        Option.map(yield* deps.getProjectShellById(input.projectId), (p) => p.workspaceRoot),
      );
    if (cwd === null) return null;
    const refName = yield* deps.currentBranch(cwd);
    return refName === null || isTemporaryWorktreeBranch(refName) ? null : refName;
  }).pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.interrupt
        : Effect.logWarning("bootstrap thread create could not resolve checkout branch", {
            threadId: input.threadId,
            cause: Cause.pretty(cause),
          }).pipe(Effect.as(null)),
    ),
  );
};
