/**
 * A server thread's project and branch, read-only, in the composer's context
 * row — see `.fork/customizations.yaml#fork-composer-shell`.
 *
 * Upstream drops the context strip once a thread starts (unless "Composer
 * context" is on), leaving the project and branch only in the details card.
 * Both are pinned by then, so this repeats them as plain chips: no menus, and
 * no workspace-mode label. The worktree mark replaces the branch glyph when
 * the thread runs in a worktree, as on the sidebar card. The spans carry
 * `data-fork-context-chip`, so the row's CSS paints them like the draft's
 * interactive chips.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { AsyncResult, Atom } from "effect/reactivity";
import type { KeyboardEvent, MouseEvent } from "react";

import { resolveBranchToolbarValue, type EnvMode } from "~/components/BranchToolbar.logic";
import { ProjectFavicon, type ProjectFaviconProject } from "~/components/ProjectFavicon";
import { readLocalApi } from "~/localApi";
import { vcsEnvironment } from "~/state/vcs";

import { projectBranchUrl } from "./branchLinks";
import { READ_ONLY_CONTEXT_CHIP_CLASS_NAME } from "./composerContextStrip";
import { copyBranchLink, copyBranchReference } from "./copyBranchReference";
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

/** The checked-out branch when git reports it has no upstream; a string, so pushes alone re-render. */
const unpushedRefAtom = Atom.family((status: ReturnType<typeof vcsEnvironment.status>) =>
  Atom.map(status, (result) => {
    const data = AsyncResult.getOrElse(result, () => null);
    return data !== null && !data.hasUpstream ? data.refName : null;
  }),
);
const NO_UNPUSHED_REF_ATOM: Atom.Atom<string | null> = Atom.make(null);

export function ThreadContextReadout(props: {
  readonly project: ProjectFaviconProject & Pick<EnvironmentProject, "repositoryIdentity">;
  readonly isGitRepo: boolean;
  readonly envMode: EnvMode;
  readonly activeWorktreePath: string | null;
  readonly activeThreadBranch: string | null;
  /** The live ref from git status; null before it resolves. */
  readonly currentGitBranch: string | null;
  /** The checkout ChatView reads git status from. */
  readonly statusCwd: string | null;
}) {
  const branch = resolveThreadContextBranch(props);
  const BranchIcon = props.activeWorktreePath !== null ? WorktreeIcon : GitBranchIcon;
  const unpushedRef = useAtomValue(
    props.statusCwd === null
      ? NO_UNPUSHED_REF_ATOM
      : unpushedRefAtom(
          vcsEnvironment.status({
            environmentId: props.project.environmentId,
            input: { cwd: props.statusCwd },
          }),
        ),
  );
  const branchUrl = branch ? projectBranchUrl(props.project.repositoryIdentity, branch) : null;
  const unpushed = branch !== null && unpushedRef === branch;
  const copyBranch = () => {
    if (branch) copyBranchReference({ branch, url: branchUrl, unpushed });
  };
  const onBranchKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    copyBranch();
  };
  const onBranchContextMenu = (event: MouseEvent) => {
    const api = readLocalApi();
    if (!branch || !api) return;
    event.preventDefault();
    event.stopPropagation();
    const link = unpushed ? null : branchUrl;
    void api.contextMenu
      .show(
        [
          { id: "copy-branch-name" as const, label: "Copy branch name", icon: "copy" },
          ...(link
            ? [{ id: "copy-branch-link" as const, label: "Copy branch link", icon: "copy" }]
            : []),
        ],
        { x: event.clientX, y: event.clientY },
      )
      .then((action) => {
        if (action === "copy-branch-name")
          copyBranchReference({ branch, url: null, unpushed: false });
        if (action === "copy-branch-link" && link) copyBranchLink(link);
      });
  };
  return (
    <>
      <span
        data-fork-context-chip="project"
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
        // A span, not a button: the row's CSS gives buttons a hover fill that would replace the chip's.
        <span
          role="button"
          tabIndex={0}
          aria-label={
            branchUrl !== null && !unpushed
              ? `Copy link to ${branch}`
              : `Copy branch name ${branch}`
          }
          data-fork-context-chip
          data-composer-context-control
          data-fork-branch-link-chip
          data-testid="thread-branch-readout"
          className={READ_ONLY_CONTEXT_CHIP_CLASS_NAME}
          onClick={copyBranch}
          onKeyDown={onBranchKeyDown}
          onContextMenu={onBranchContextMenu}
        >
          <BranchIcon className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{branch}</span>
        </span>
      ) : null}
    </>
  );
}
