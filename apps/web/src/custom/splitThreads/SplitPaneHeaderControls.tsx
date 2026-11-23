/** A pane's header controls (fork-split-threads). Float lifts a thread into a window over the
 * column, where the same spot reads Dock; the window drops the split and panel toggles until it
 * docks. The split toggle sits just before details; an unsent split draft gets a closing X. */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { PictureInPicture2, SquareSplitHorizontal, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import type { DraftId } from "~/composerDraftStore";

import { closeSplitDraft } from "./splitPaneNavigation";
import { useSplitPane } from "./splitPaneContext";

function PaneActionButton(props: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly onPress: () => void;
}) {
  return (
    <div className="pointer-events-auto flex h-full items-center">
      <Tooltip>
        <TooltipTrigger
          // data-split-pane-action keeps a press here from first focusing the pane.
          render={<span className="flex shrink-0" data-fork-panel-toggle data-split-pane-action />}
        >
          <Button
            className="shrink-0 [-webkit-app-region:no-drag]"
            variant="ghost"
            size="icon-sm"
            aria-label={props.label}
            onClick={props.onPress}
          >
            {props.icon}
          </Button>
        </TooltipTrigger>
        <TooltipPopup side="bottom">{props.label}</TooltipPopup>
      </Tooltip>
    </div>
  );
}

export function SplitPaneHeaderControls(props: {
  readonly panelToggleControls: ReactNode;
  /** SplitAgentToggle, when the pane can split or is split. */
  readonly splitAgentToggle: ReactNode;
  /** The pane's thread while it is an unsent draft, else null. */
  readonly draftId: DraftId | null;
  readonly threadRef: ScopedThreadRef | null;
}) {
  const { draftId, threadRef } = props;
  const splitPane = useSplitPane();
  const { windowAction } = splitPane;

  const close = (draft: DraftId, ref: ScopedThreadRef) =>
    void closeSplitDraft(splitPane.focusPartner, ref, draft);

  return (
    <>
      {windowAction ? (
        <PaneActionButton
          label={windowAction.kind === "dock" ? "Dock beside" : "Float thread"}
          icon={
            windowAction.kind === "dock" ? (
              <SquareSplitHorizontal className="size-4" />
            ) : (
              <PictureInPicture2 className="size-4" />
            )
          }
          onPress={windowAction.run}
        />
      ) : null}
      {splitPane.floating ? null : (
        <>
          {props.splitAgentToggle}
          <div className="pointer-events-auto flex h-full items-center">
            {props.panelToggleControls}
          </div>
        </>
      )}
      {splitPane.split && draftId !== null && threadRef !== null ? (
        <PaneActionButton
          label="Close new agent"
          icon={<XIcon className="size-4" />}
          onPress={() => close(draftId, threadRef)}
        />
      ) : null}
    </>
  );
}
