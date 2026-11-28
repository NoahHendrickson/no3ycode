/**
 * A sprint's Threads panel — see `.fork/customizations.yaml#fork-sprints`. The Petal panel's frame,
 * list, search and controls (bots/BotThreadsPanel) in the body it shares with a coordinator's
 * (bots/BotThreadsChild), under the sprint's tabs: a thread opened from the sprint shows there
 * with a way back.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { SideChatParentPanel } from "~/lib/sideChatPane";

import {
  BotThreadsPanelFrame,
  type BotThreadsPanelProps,
  botThreadsPanelRightmost,
} from "../bots/BotThreadsPanel";
import { BotThreadsChildPanelBody } from "../bots/BotThreadsChild";
import {
  openInSprintPanel,
  SPRINT_PANEL_DEFAULT_WIDTH,
  useSprintPanelTab,
} from "./sprintPanelState";
import { SprintPanelTabContent, SprintPanelTabStrip } from "./SprintPanelTabs";
import { SprintThreadModel } from "./SprintThreadModel";

export function SprintPanel(
  props: BotThreadsPanelProps & {
    /** The conversation's own panel, which a thread opened here borrows as a side chat does. */
    readonly parentPanel: SideChatParentPanel;
  },
) {
  return (
    <BotThreadsPanelFrame {...props} defaultWidth={SPRINT_PANEL_DEFAULT_WIDTH}>
      <SprintPanelBody
        sprintRef={props.botRef}
        currentThreadRef={props.threadRef}
        rightmost={botThreadsPanelRightmost(props)}
        parentPanel={props.parentPanel}
      />
    </BotThreadsPanelFrame>
  );
}

function SprintPanelBody(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly currentThreadRef: ScopedThreadRef;
  readonly rightmost: boolean;
  readonly parentPanel: SideChatParentPanel;
}) {
  const sprintKey = scopedThreadKey(props.sprintRef);
  const tab = useSprintPanelTab(sprintKey);
  return (
    <BotThreadsChildPanelBody
      ownerRef={props.sprintRef}
      currentThreadRef={props.currentThreadRef}
      rightmost={props.rightmost}
      parentPanel={props.parentPanel}
      // The tabs need the room: their track's own fill stands in for the inset.
      headerClassName={() => "gap-1 pr-0.5 pl-1.5"}
      backLabel="Back to the sprint's threads"
      // The tabs stand in for the title; the open one names the panel.
      title={<SprintPanelTabStrip sprintKey={sprintKey} tab={tab} />}
      controls={<SprintThreadModel sprintRef={props.sprintRef} />}
      content={
        tab === "threads" ? null : <SprintPanelTabContent sprintRef={props.sprintRef} tab={tab} />
      }
      none="This sprint has not started any threads."
      openThread={(ref) => openInSprintPanel(props.sprintRef, ref)}
    />
  );
}
