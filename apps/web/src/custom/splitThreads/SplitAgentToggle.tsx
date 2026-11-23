/** The header's split toggle (fork-split-threads): alone, it opens a draft on this thread's
 * project, worktree and branch in a pane beside it; pressed in a split, it dissolves the pair and
 * leaves this thread on screen alone. */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedProjectRef, ScopedThreadRef } from "@t3tools/contracts";
import { useRef, type MouseEvent, type PointerEvent } from "react";

import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";

import { Columns2Icon } from "../icons/lucide-hugeicons";
import { useSplitPane, type SplitPaneState } from "./splitPaneContext";
import { morphSplitPairs } from "./splitMorph";
import { usePendingSplitStore, useSplitThreadStore } from "./splitThreadStore";

/** Whether the toggle shows: always in a split, and alone on a started thread
    in a window wide enough (splitting a draft would only reopen the same
    draft). */
export function splitAgentToggleShown(splitPane: SplitPaneState, startedThread: boolean): boolean {
  return splitPane.split || (splitPane.canSplit && startedThread);
}

export function SplitAgentToggle(props: {
  readonly threadRef: ScopedThreadRef;
  readonly projectRef: ScopedProjectRef;
  readonly branch: string | null;
  readonly worktreePath: string | null;
}) {
  const { threadRef, projectRef, branch, worktreePath } = props;
  const splitPane = useSplitPane();
  const handleNewThread = useNewThreadHandler();
  const unpair = useSplitThreadStore((state) => state.unpair);
  // A mouse press acts on pointerdown, so mounting the new pane overlaps the
  // press instead of waiting for the release. The click that release fires
  // lands on the same button, which by then reads the other action, so it is
  // swallowed. Keyboard (detail 0) and touch still act on click.
  const actedOnPressRef = useRef(false);
  const pressHandlers = (action: () => void) => ({
    onPointerDown: (event: PointerEvent) => {
      actedOnPressRef.current = event.pointerType === "mouse" && event.button === 0;
      if (actedOnPressRef.current) action();
    },
    onClick: (event: MouseEvent) => {
      if (event.detail > 0 && actedOnPressRef.current) {
        actedOnPressRef.current = false;
        return;
      }
      action();
    },
  });

  const splitAgent = () => {
    usePendingSplitStore.setState({ pending: { source: threadRef, projectRef } });
    void handleNewThread(projectRef, {
      branch,
      worktreePath,
      envMode: worktreePath ? "worktree" : "local",
      startFromOrigin: false,
    })
      .then((opened) => {
        if (!opened) return;
        useSplitThreadStore
          .getState()
          .pair(threadRef, scopeThreadRef(projectRef.environmentId, opened.threadId));
      })
      .finally(() => usePendingSplitStore.setState({ pending: null }));
  };
  const label = splitPane.split ? "Unsplit" : "Split agent";

  return (
    <div className="pointer-events-auto flex h-full items-center">
      <Tooltip>
        {/* No data-split-pane-action: the press focuses this pane first, so Unsplit leaves it on screen. */}
        <TooltipTrigger render={<span className="flex shrink-0" data-fork-panel-toggle />}>
          <Toggle
            className="shrink-0 [-webkit-app-region:no-drag]"
            pressed={splitPane.split}
            aria-label={label}
            variant="ghost"
            size="sm"
            {...pressHandlers(
              splitPane.split
                ? () => morphSplitPairs([threadRef], () => unpair(threadRef))
                : splitAgent,
            )}
          >
            <Columns2Icon className="size-4" />
          </Toggle>
        </TooltipTrigger>
        <TooltipPopup side="bottom">{label}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
