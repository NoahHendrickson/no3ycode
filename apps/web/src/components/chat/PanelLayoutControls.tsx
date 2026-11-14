import {
  PanelBottomIcon,
  PanelRightIcon,
  SquareMenuIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "lucide-react";
import { memo, type ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { ThreadPanelPresentation } from "../../rightPanelLayout";
import { PopoverCreateHandle, PopoverTrigger } from "../ui/popover";
import { useMobileSidebarSheetMounted } from "../ui/sidebar";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
/* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { MusicPanelToggle } from "../../custom/music/MusicPanelToggle";
/* fork:end fork-music-panel */
/* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
import { BotThreadsPanelToggle } from "../../custom/bots/BotThreadsPanelToggle";
/* fork:end fork-bot-work-threads */

export interface PanelLayoutControlsProps {
  showThreadPanelControl?: boolean;
  showTerminalControl?: boolean;
  showRightPanelControl?: boolean;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalShortcutLabel: string | null;
  threadPanelOpen: boolean;
  threadPanelPresentation: ThreadPanelPresentation;
  threadPanelPopoverHandle?: ReturnType<typeof PopoverCreateHandle>;
  threadPanelShortcutLabel: string | null;
  rightPanelAvailable: boolean;
  rightPanelOpen: boolean;
  rightPanelShortcutLabel: string | null;
  rightPanelUnavailableLabel?: string;
  onToggleTerminal: () => void;
  onToggleThreadPanel: () => void;
  onToggleRightPanel: () => void;
  /* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel
     The thread whose right panel the music button opens; omitted, the button is not offered. */
  musicThreadRef?: ScopedThreadRef | null;
  /* fork:end fork-music-panel */
  /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads
     The thread whose Threads panel the yarn toggle opens; it shows on a bot's conversation only. */
  botThreadsThreadRef?: ScopedThreadRef | null;
  /* fork:end fork-bot-work-threads */
}

export const PanelLayoutControls = memo(function PanelLayoutControls({
  showThreadPanelControl = true,
  showTerminalControl = true,
  showRightPanelControl = true,
  terminalAvailable,
  terminalOpen,
  terminalShortcutLabel,
  threadPanelOpen,
  threadPanelPresentation,
  threadPanelPopoverHandle,
  threadPanelShortcutLabel,
  rightPanelAvailable,
  rightPanelOpen,
  rightPanelShortcutLabel,
  rightPanelUnavailableLabel = "Right panel is unavailable",
  onToggleTerminal,
  onToggleThreadPanel,
  onToggleRightPanel,
  /* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel */
  musicThreadRef,
  /* fork:end fork-music-panel */
  /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
  botThreadsThreadRef,
  /* fork:end fork-bot-work-threads */
}: PanelLayoutControlsProps) {
  const threadPanelToggle = (
    <Toggle
      className="relative shrink-0 [-webkit-app-region:no-drag]"
      pressed={threadPanelOpen}
      onPressedChange={threadPanelPresentation === "popover" ? undefined : onToggleThreadPanel}
      aria-label="Toggle thread details panel"
      /* fork:begin fork-inlet-theme — see .fork/customizations.yaml#fork-inlet-theme
         What Inlet's morph and the docked card's join key on, not the label. */
      data-fork-details-toggle=""
      /* fork:end fork-inlet-theme */
      variant="ghost"
      size="sm"
    >
      <SquareMenuIcon className="size-4" />
    </Toggle>
  );
  const threadPanelControl = (
    <Tooltip>
      {/* fork:begin fork-glass-new-agent-stage — see .fork/customizations.yaml#fork-glass-new-agent-stage
          The span carries the Glass draft's menu material, like the two toggles below. */}
      <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
        {threadPanelPresentation === "popover" ? (
          <PopoverTrigger handle={threadPanelPopoverHandle} render={threadPanelToggle} />
        ) : (
          threadPanelToggle
        )}
      </TooltipTrigger>
      {/* fork:end fork-glass-new-agent-stage */}
      <TooltipPopup side="bottom">
        Toggle thread details
        {threadPanelShortcutLabel ? ` (${threadPanelShortcutLabel})` : ""}
      </TooltipPopup>
    </Tooltip>
  );

  return (
    <div
      className="flex h-full shrink-0 items-center gap-1 [-webkit-app-region:no-drag]"
      data-panel-layout-controls
    >
      {showThreadPanelControl ? threadPanelControl : null}
      {/* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */}
      {showRightPanelControl && botThreadsThreadRef !== undefined ? (
        <BotThreadsPanelToggle threadRef={botThreadsThreadRef} />
      ) : null}
      {/* fork:end fork-bot-work-threads */}
      {showTerminalControl ? (
        <Tooltip>
          {/* fork:begin fork-glass-new-agent-stage — see .fork/customizations.yaml#fork-glass-new-agent-stage
              The span carries the Glass draft's menu material; the Toggle inside paints its own hover above it. */}
          <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
            {/* fork:end fork-glass-new-agent-stage */}
            <Toggle
              className="shrink-0 [-webkit-app-region:no-drag]"
              pressed={terminalOpen}
              onPressedChange={onToggleTerminal}
              aria-label="Toggle terminal drawer"
              variant="ghost"
              size="sm"
              disabled={!terminalAvailable}
            >
              <PanelBottomIcon className="size-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipPopup side="bottom">
            {terminalAvailable
              ? `Toggle terminal drawer${terminalShortcutLabel ? ` (${terminalShortcutLabel})` : ""}`
              : "Terminal drawer is unavailable"}
          </TooltipPopup>
        </Tooltip>
      ) : null}
      {/* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel */}
      {showRightPanelControl && musicThreadRef !== undefined ? (
        <MusicPanelToggle available={rightPanelAvailable} threadRef={musicThreadRef} />
      ) : null}
      {/* fork:end fork-music-panel */}
      {showRightPanelControl ? (
        <Tooltip>
          {/* fork:begin fork-glass-new-agent-stage — see .fork/customizations.yaml#fork-glass-new-agent-stage
              The span carries the Glass draft's menu material; the Toggle inside paints its own hover above it. */}
          <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
            {/* fork:end fork-glass-new-agent-stage */}
            <Toggle
              className="shrink-0 [-webkit-app-region:no-drag]"
              pressed={rightPanelOpen}
              onPressedChange={onToggleRightPanel}
              aria-label="Toggle right panel"
              data-right-panel-toggle
              variant="ghost"
              size="sm"
              disabled={!rightPanelAvailable}
            >
              <PanelRightIcon className="size-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipPopup side="bottom">
            {rightPanelAvailable
              ? `Toggle right panel${rightPanelShortcutLabel ? ` (${rightPanelShortcutLabel})` : ""}`
              : rightPanelUnavailableLabel}
          </TooltipPopup>
        </Tooltip>
      ) : null}
    </div>
  );
});

export const RightPanelMaximizeControl = memo(function RightPanelMaximizeControl({
  maximized,
  onToggle,
}: {
  maximized: boolean;
  onToggle: () => void;
}) {
  const label = maximized ? "Restore panel size" : "Maximize panel";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            className="shrink-0 [-webkit-app-region:no-drag]"
            pressed={maximized}
            onPressedChange={onToggle}
            aria-label={label}
            variant="ghost"
            size="sm"
          >
            {maximized ? (
              <Minimize2Icon className="size-4" />
            ) : (
              <Maximize2Icon className="size-4" />
            )}
          </Toggle>
        }
      />
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
});

/** The thread panel toggle on a header whose right side the inline right panel covers. */
export function ThreadPanelHeaderControl(props: PanelLayoutControlsProps) {
  const mobileSidebarSheetMounted = useMobileSidebarSheetMounted();
  return (
    <div
      className={cn(
        "absolute top-[var(--workspace-controls-top)] right-[calc(env(safe-area-inset-right)+0.75rem)] z-50 flex h-[var(--workspace-topbar-height)] items-center [-webkit-app-region:no-drag]",
        mobileSidebarSheetMounted && "hidden",
      )}
      data-workspace-titlebar-controls
      /* fork:begin fork-collapsed-thread-tabs — see .fork/customizations.yaml#fork-collapsed-thread-tabs
         Placed in the header, not the window, so the tab strip's controls offset skips it. */
      data-fork-header-anchored-controls=""
      /* fork:end fork-collapsed-thread-tabs */
    >
      <PanelLayoutControls {...props} showTerminalControl={false} showRightPanelControl={false} />
    </div>
  );
}

/** The window's top-right panel controls, with the maximize toggle while the panel is open. */
export function WorkspaceTitlebarControls(props: {
  readonly showMaximizeControl: boolean;
  readonly rightPanelOpen: boolean;
  readonly animationsActive: boolean;
  readonly maximized: boolean;
  readonly onToggleMaximized: () => void;
  readonly children: ReactNode;
}) {
  const mobileSidebarSheetMounted = useMobileSidebarSheetMounted();
  return (
    <div
      className={cn(
        "pointer-events-none fixed top-[var(--workspace-controls-top)] right-[var(--workspace-controls-right)] z-50 mr-px flex h-[var(--workspace-topbar-height)] items-center gap-1 [-webkit-app-region:no-drag]",
        mobileSidebarSheetMounted && "hidden",
      )}
      data-workspace-titlebar-controls
    >
      {props.showMaximizeControl ? (
        <span
          aria-hidden={!props.rightPanelOpen}
          // Fading out on close would show it beside the thread details toggle that replaces it.
          className={cn(
            "flex shrink-0",
            props.rightPanelOpen &&
              props.animationsActive &&
              "motion-safe:transition-opacity motion-safe:duration-(--panel-animation-duration) motion-safe:ease-out",
            props.rightPanelOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none absolute right-full mr-1 opacity-0",
          )}
          inert={!props.rightPanelOpen}
        >
          <RightPanelMaximizeControl
            maximized={props.maximized}
            onToggle={props.onToggleMaximized}
          />
        </span>
      ) : null}
      <div className="pointer-events-auto flex h-full items-center">{props.children}</div>
    </div>
  );
}
