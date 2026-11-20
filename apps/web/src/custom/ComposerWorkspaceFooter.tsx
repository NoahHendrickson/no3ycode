/**
 * The bottom half of the composer's split branch-and-workspace menu — see
 * `.fork/customizations.yaml#fork-composer-shell`.
 *
 * Combines the workspace picker (Local checkout / New worktree / previous
 * worktree) into the bottom of BranchPicker's popup below an edge-to-edge
 * divider, while the trigger shows the active workspace icon beside the branch
 * name as one ghost button.
 */
import type { KeyboardEvent } from "react";

import {
  resolveCurrentWorkspaceLabel,
  resolveEnvModeLabel,
  resolveLockedWorkspaceLabel,
  type EnvMode,
} from "../components/BranchToolbar.logic";
import { PreviousWorktreeItemContent } from "../components/PreviousWorktreeItemContent";
import { cn } from "~/lib/utils";
import { CheckIcon, GitBranchIcon } from "./icons/lucide-hugeicons";
import { WorktreeIcon } from "./icons/WorktreeIcon";

/** Renders the checkout or worktree glyph on the combined branch/workspace trigger. */
export function ComposerWorkspaceTriggerIcon(props: {
  readonly effectiveEnvMode: EnvMode;
  readonly activeWorktreePath: string | null;
}) {
  if (props.effectiveEnvMode === "worktree" || props.activeWorktreePath) {
    return <WorktreeIcon className="size-3 shrink-0" />;
  }
  return <GitBranchIcon className="size-3 shrink-0" />;
}

/** Keeps keyboard events on the workspace buttons from reaching the combobox search input. */
function keepKeysInFooter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Escape" && event.key !== "Tab") {
    event.stopPropagation();
  }
}

const OPTION_CLASS =
  "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left text-base text-foreground outline-none transition-colors hover:bg-foreground/[0.09] focus-visible:bg-foreground/[0.09] sm:min-h-7 sm:text-sm";

export function ComposerWorkspaceFooter(props: {
  readonly forceNewWorktree?: boolean;
  readonly envLocked: boolean;
  readonly effectiveEnvMode: EnvMode;
  readonly activeWorktreePath: string | null;
  readonly onEnvModeChange: (mode: EnvMode) => void;
  readonly previousWorktreeLabel?: string | null;
  readonly previousWorktreeBranch?: string | null;
  readonly onUsePreviousWorktree?: () => void;
  readonly onClose?: () => void;
}) {
  const {
    forceNewWorktree = false,
    envLocked,
    effectiveEnvMode,
    activeWorktreePath,
    onEnvModeChange,
    previousWorktreeLabel,
    previousWorktreeBranch = null,
    onUsePreviousWorktree,
    onClose,
  } = props;

  if (envLocked || forceNewWorktree) {
    const label = forceNewWorktree
      ? "Each model starts in its own worktree"
      : resolveLockedWorkspaceLabel(activeWorktreePath, effectiveEnvMode);
    return (
      <div
        data-fork-workspace-footer="locked"
        className="flex items-center gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground"
      >
        <ComposerWorkspaceTriggerIcon
          effectiveEnvMode={forceNewWorktree ? "worktree" : effectiveEnvMode}
          activeWorktreePath={activeWorktreePath}
        />
        <span className="min-w-0 truncate">{label}</span>
      </div>
    );
  }

  const localLabel = resolveCurrentWorkspaceLabel(activeWorktreePath);
  const worktreeLabel = resolveEnvModeLabel("worktree");
  const showPreviousWorktree = Boolean(previousWorktreeLabel && onUsePreviousWorktree);

  return (
    <div
      data-fork-workspace-footer="true"
      role="radiogroup"
      aria-label="Workspace"
      className="flex flex-col gap-0.5 border-t border-border/60 p-1"
      onKeyDown={keepKeysInFooter}
    >
      <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
        Workspace
      </div>
      <button
        type="button"
        role="radio"
        aria-checked={effectiveEnvMode === "local"}
        className={cn(OPTION_CLASS, effectiveEnvMode === "local" && "bg-foreground/[0.06]")}
        onClick={() => onEnvModeChange("local")}
      >
        {activeWorktreePath ? (
          <WorktreeIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">{localLabel}</span>
        {effectiveEnvMode === "local" ? (
          <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
        ) : null}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={effectiveEnvMode === "worktree"}
        className={cn(OPTION_CLASS, effectiveEnvMode === "worktree" && "bg-foreground/[0.06]")}
        onClick={() => onEnvModeChange("worktree")}
      >
        <WorktreeIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{worktreeLabel}</span>
        {effectiveEnvMode === "worktree" ? (
          <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
        ) : null}
      </button>
      {showPreviousWorktree && previousWorktreeLabel ? (
        <button
          type="button"
          className={cn(OPTION_CLASS, "h-auto py-1")}
          onClick={() => {
            onUsePreviousWorktree?.();
            onClose?.();
          }}
        >
          <PreviousWorktreeItemContent branch={previousWorktreeBranch} />
        </button>
      ) : null}
    </div>
  );
}
