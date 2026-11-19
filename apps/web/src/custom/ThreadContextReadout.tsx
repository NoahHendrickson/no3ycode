/**
 * A server thread's project and branch, read-only, in the composer's context
 * row — see `.fork/customizations.yaml#fork-composer-shell`.
 *
 * Upstream drops the context strip once a thread starts (unless "Composer
 * context" is on), leaving the project and branch only in the details card.
 * Both are pinned by then, so this repeats them as plain chips: no menus, and
 * no workspace-mode label. Clicking the branch chip copies the branch name.
 * The worktree mark replaces the branch glyph when the thread runs in a
 * worktree, as on the sidebar card. The chips carry `data-fork-context-chip`,
 * so the row's CSS paints them like the draft's interactive chips.
 */
import { resolveBranchToolbarValue, type EnvMode } from "~/components/BranchToolbar.logic";
import { ProjectFavicon, type ProjectFaviconProject } from "~/components/ProjectFavicon";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";

import { READ_ONLY_CONTEXT_CHIP_CLASS_NAME } from "./composerContextStrip";
import { FolderIcon, GitBranchIcon } from "./icons/lucide-hugeicons";
import { WorktreeIcon } from "./icons/WorktreeIcon";

/**
 * The branch the readout names: the value BranchToolbar's strip would show.
 * A worktree thread keeps its saved branch even when the directory is gone and
 * git status reports no repo, matching the strip's own predicates.
 */
export function resolveThreadContextBranch(input: {
  readonly isGitRepo: boolean;
  readonly envMode: EnvMode;
  readonly activeWorktreePath: string | null;
  readonly activeThreadBranch: string | null;
  readonly currentGitBranch: string | null;
}): string | null {
  if (!input.isGitRepo && input.activeWorktreePath === null) return null;
  return resolveBranchToolbarValue(input);
}

function copyBranchName(branch: string) {
  void writeTextToClipboard(branch, "branch name").then(
    (didCopy) => {
      if (didCopy) {
        toastManager.add({ type: "success", title: "Branch name copied", description: branch });
      }
    },
    (error: unknown) => {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Failed to copy branch name",
          description: error instanceof Error ? error.message : String(error),
        }),
      );
    },
  );
}

export function ThreadContextReadout(props: {
  readonly project: ProjectFaviconProject;
  readonly isGitRepo: boolean;
  readonly envMode: EnvMode;
  readonly activeWorktreePath: string | null;
  readonly activeThreadBranch: string | null;
  /** The live ref from git status; null before it resolves. */
  readonly currentGitBranch: string | null;
}) {
  const branch = resolveThreadContextBranch(props);
  const BranchIcon = props.activeWorktreePath !== null ? WorktreeIcon : GitBranchIcon;
  return (
    <>
      <span
        data-fork-context-chip
        data-composer-context-control
        data-testid="thread-project-readout"
        className={`${READ_ONLY_CONTEXT_CHIP_CLASS_NAME} max-w-72 shrink-0`}
      >
        <ProjectFavicon
          project={props.project}
          className="size-3 shrink-0"
          fallbackIcon={FolderIcon}
        />
        <span className="min-w-0 truncate">{props.project.title}</span>
      </span>
      {branch ? (
        <button
          type="button"
          data-fork-context-chip
          data-composer-context-control
          data-testid="thread-branch-readout"
          className={`${READ_ONLY_CONTEXT_CHIP_CLASS_NAME} cursor-pointer`}
          aria-label={`Copy branch name ${branch}`}
          onClick={() => copyBranchName(branch)}
        >
          <BranchIcon className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{branch}</span>
        </button>
      ) : null}
    </>
  );
}
