/**
 * Bottom half of the composer's split branch-and-workspace popup — see
 * `.fork/customizations.yaml#fork-composer-shell`.
 */
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import type { KeyboardEvent } from "react";

import {
  resolveCurrentWorkspaceLabel,
  resolveEnvModeLabel,
  resolveLockedWorkspaceLabel,
  type EnvMode,
} from "../components/BranchToolbar.logic";
import { PreviousWorktreeItemContent } from "../components/PreviousWorktreeItemContent";
import { RadioGroup } from "../components/ui/radio-group";
import { cn } from "~/lib/utils";
import { CheckIcon, GitBranchIcon } from "./icons/lucide-hugeicons";
import { WorktreeIcon } from "./icons/WorktreeIcon";

/** Single source of truth for whether a workspace state wears the worktree or branch glyph. */
function resolveWorkspaceGlyphKind(input: {
  readonly effectiveEnvMode: EnvMode;
  readonly activeWorktreePath: string | null;
  readonly forceNewWorktree?: boolean;
}): "worktree" | "branch" {
  return input.forceNewWorktree || input.effectiveEnvMode === "worktree" || input.activeWorktreePath
    ? "worktree"
    : "branch";
}

/** Renders the checkout or worktree glyph on the combined trigger and footer rows. */
export function ComposerWorkspaceTriggerIcon(props: {
  readonly effectiveEnvMode: EnvMode;
  readonly activeWorktreePath: string | null;
  readonly forceNewWorktree?: boolean;
  readonly className?: string;
}) {
  const iconClassName = props.className ?? "size-3 shrink-0";
  return resolveWorkspaceGlyphKind(props) === "worktree" ? (
    <WorktreeIcon className={iconClassName} />
  ) : (
    <GitBranchIcon className={iconClassName} />
  );
}

const FOOTER_HANDLED_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Enter",
  " ",
]);

/** Stops combobox capture of radio-group navigation/activation keys while letting Escape, Tab, and chords bubble. */
function keepRadioKeysInFooter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (FOOTER_HANDLED_KEYS.has(event.key)) {
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
          effectiveEnvMode={effectiveEnvMode}
          activeWorktreePath={activeWorktreePath}
          forceNewWorktree={forceNewWorktree}
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
      className="flex flex-col gap-0.5 border-t border-border/60 p-1"
      onKeyDown={keepRadioKeysInFooter}
    >
      <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
        Workspace
      </div>
      <RadioGroup
        aria-label="Workspace"
        value={effectiveEnvMode}
        onValueChange={(value) => {
          if (value === "local" || value === "worktree") {
            onEnvModeChange(value);
          }
        }}
        density="compact"
        className="flex flex-col"
      >
        <RadioPrimitive.Root
          value="local"
          className={cn(OPTION_CLASS, "data-checked:bg-foreground/[0.06]")}
        >
          <ComposerWorkspaceTriggerIcon
            effectiveEnvMode="local"
            activeWorktreePath={activeWorktreePath}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 truncate">{localLabel}</span>
          {effectiveEnvMode === "local" ? (
            <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
          ) : null}
        </RadioPrimitive.Root>
        <RadioPrimitive.Root
          value="worktree"
          className={cn(OPTION_CLASS, "data-checked:bg-foreground/[0.06]")}
        >
          <ComposerWorkspaceTriggerIcon
            effectiveEnvMode="worktree"
            activeWorktreePath={activeWorktreePath}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 truncate">{worktreeLabel}</span>
          {effectiveEnvMode === "worktree" ? (
            <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
          ) : null}
        </RadioPrimitive.Root>
      </RadioGroup>
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
