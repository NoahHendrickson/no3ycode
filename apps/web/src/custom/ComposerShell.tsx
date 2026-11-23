import type { RuntimeMode } from "@t3tools/contracts";
import { memo, type ComponentProps, type ReactNode } from "react";

import { ComposerControl } from "../components/chat/ComposerControl";
import { cn } from "~/lib/utils";

import "./ComposerShell.css";

type ComposerShellVisibilityInput = {
  approvalPending: boolean;
  collapsedMobile: boolean;
  mobilePendingActionsVisible: boolean;
};

export function resolveComposerShellVisibility({
  approvalPending,
  collapsedMobile,
  mobilePendingActionsVisible,
}: ComposerShellVisibilityInput) {
  return {
    showInlinePrimaryAction: !approvalPending && !mobilePendingActionsVisible,
    // Upstream hides its footer on phones while the pending-answer cluster is
    // up (the editor reserves that band for the absolute prev/advance actions).
    showInteractiveControls: !approvalPending && !collapsedMobile && !mobilePendingActionsVisible,
  };
}

type ComposerShellProps = ComposerShellVisibilityInput & {
  children?: ReactNode;
  context?: ReactNode;
  modeControls: ReactNode;
  modelControls: ReactNode;
  readoutControls: ReactNode;
  usageControls?: ReactNode;
  topVessel?: ReactNode;
  /** Chips above the composer (the thread's PR, background work); the row hides when empty. */
  statusChips?: ReactNode;
};

/** Owns the fork's vessel(topVessel + surface + controls) composition and state gates. */
export const ComposerShell = memo(function ComposerShell({
  approvalPending,
  children,
  collapsedMobile,
  context,
  mobilePendingActionsVisible,
  modeControls,
  modelControls,
  readoutControls,
  usageControls,
  topVessel,
  statusChips,
}: ComposerShellProps) {
  const { showInteractiveControls } = resolveComposerShellVisibility({
    approvalPending,
    collapsedMobile,
    mobilePendingActionsVisible,
  });
  const left =
    !collapsedMobile && !mobilePendingActionsVisible && context ? (
      <div data-fork-composer-vessel-context="true" className="flex min-w-0 flex-1 items-center">
        {context}
      </div>
    ) : null;
  const right =
    readoutControls ||
    (showInteractiveControls && (modelControls || modeControls || usageControls)) ? (
      <>
        {readoutControls}
        {showInteractiveControls && modelControls ? (
          <div
            data-fork-composer-model-controls="true"
            className="flex min-w-0 items-center gap-px"
          >
            {modelControls}
          </div>
        ) : null}
        {showInteractiveControls && modeControls ? (
          <div
            data-fork-composer-mode-controls="true"
            className="flex shrink-0 items-center gap-px"
          >
            {modeControls}
          </div>
        ) : null}
        {showInteractiveControls ? usageControls : null}
      </>
    ) : null;

  return (
    <div className="flex min-w-0 flex-col">
      {/* In flow, so the transcript's bottom inset makes room for it; the drawer floats over it. */}
      <div
        data-fork-composer-status-chips="true"
        className="flex min-w-0 flex-wrap items-center gap-1.5 pb-1.5 empty:hidden"
      >
        {statusChips}
      </div>
      <div className="relative flex min-w-0 flex-col">
        {/* Sibling of the vessel (not its child): the vessel's backdrop-filter makes it a
          Chromium Backdrop Root, which would stop a child from blurring the picture. It floats
          over the transcript rather than pushing it up. */}
        {!collapsedMobile && topVessel ? (
          <div
            data-fork-composer-top-vessel="true"
            className="pointer-events-none absolute inset-x-0 bottom-full z-20 flex flex-col"
          >
            {topVessel}
          </div>
        ) : null}
        {/* No vessel paint while collapsed: the mobile pill rounds to 12px and
          the vessel's 8px corners would peek out as background wedges (and a
          live readout row would slab onto the pill). */}
        <div
          {...(collapsedMobile ? {} : { "data-fork-composer-vessel": "true" })}
          className="flex min-w-0 flex-col"
        >
          {children}
          {left || right ? (
            <div
              data-fork-composer-control-row="true"
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1.5"
            >
              {left ? (
                <div
                  data-fork-composer-control-row-slot="left"
                  className="-m-1 flex min-w-[min(100%,11rem)] flex-1 items-center gap-px overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {left}
                </div>
              ) : null}
              {right ? (
                <div
                  data-fork-composer-control-row-slot="right"
                  className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-px"
                >
                  {right}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

type ComposerPromptRowProps = Pick<
  ComposerShellVisibilityInput,
  "approvalPending" | "mobilePendingActionsVisible"
> & {
  leadingAction?: ReactNode;
  action: ReactNode;
  children?: ReactNode;
};

/**
 * Keeps the prompt beside its leading (+) and primary-action (mic + send)
 * clusters. On the draft hero CSS grid moves both clusters to a row beneath
 * the prompt, with + at the far left and mic + send at the far right.
 */
export const ComposerPromptRow = memo(function ComposerPromptRow({
  action,
  approvalPending,
  children,
  leadingAction,
  mobilePendingActionsVisible,
}: ComposerPromptRowProps) {
  const { showInlinePrimaryAction } = resolveComposerShellVisibility({
    approvalPending,
    collapsedMobile: false,
    mobilePendingActionsVisible,
  });

  return (
    // Stamped so the draft-only geometry (theme.custom.css, keyed on the
    // overlay's data-draft-hero) can put the prompt on top and the action
    // clusters beneath it.
    <div data-fork-composer-prompt-row="true" className="flex min-w-0 items-end gap-2">
      {showInlinePrimaryAction && leadingAction ? (
        <div
          data-chat-composer-leading-actions="true"
          className="flex shrink-0 items-center self-end"
        >
          {leadingAction}
        </div>
      ) : null}
      <div data-fork-composer-prompt="true" className="relative min-w-0 flex-1">
        {children}
      </div>
      {showInlinePrimaryAction ? (
        <div
          data-chat-composer-inline-actions="true"
          className="flex shrink-0 items-center self-end"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
});

type ComposerRuntimeModeTriggerProps = ComponentProps<typeof ComposerControl> & {
  runtimeMode: RuntimeMode;
};

/** The runtime mode trigger, rendered as a ghost button matching sibling composer controls. */
export function ComposerRuntimeModeTrigger({
  className,
  runtimeMode,
  ...props
}: ComposerRuntimeModeTriggerProps) {
  return (
    <ComposerControl
      {...props}
      data-fork-composer-mode-chip="true"
      data-fork-runtime-mode={runtimeMode}
      className={cn("font-medium", className)}
    />
  );
}
