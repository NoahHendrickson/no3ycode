/**
 * A coordinator's Threads panel — see `.fork/customizations.yaml#fork-coordinator-threads`. The
 * Petal panel's frame, list, search and controls (bots/BotThreadsPanel) in the body it shares with
 * a sprint's (bots/BotThreadsChild), with no tabs: the coordinator's children by status, and on
 * its own page a child opened here, with a way back.
 */
import type { SideChatParentPanel } from "~/lib/sideChatPane";

import {
  BotThreadsPanelFrame,
  type BotThreadsPanelProps,
  botThreadsPanelRightmost,
} from "../bots/BotThreadsPanel";
import { BotThreadsChildPanelBody } from "../bots/BotThreadsChild";
import { openBotThreadsChild } from "../bots/botThreadsPanelStore";
import { BOT_THREADS_PANEL_DEFAULT_WIDTH } from "../bots/stagePanels";

export function CoordinatorPanel(
  props: BotThreadsPanelProps & {
    /** The conversation's own panel, which a child opened here borrows as a side chat does. */
    readonly parentPanel: SideChatParentPanel;
  },
) {
  return (
    <BotThreadsPanelFrame {...props} defaultWidth={BOT_THREADS_PANEL_DEFAULT_WIDTH}>
      <BotThreadsChildPanelBody
        ownerRef={props.botRef}
        currentThreadRef={props.threadRef}
        rightmost={botThreadsPanelRightmost(props)}
        parentPanel={props.parentPanel}
        headerClassName={(childOpen) => (childOpen ? "gap-1 pr-2 pl-1.5" : "gap-2 pr-2 pl-3.5")}
        backLabel="Back to the coordinator's threads"
        title={
          <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
        }
        none="This coordinator has not delegated any work."
        openThread={(ref) => openBotThreadsChild(props.botRef, ref)}
      />
    </BotThreadsPanelFrame>
  );
}
