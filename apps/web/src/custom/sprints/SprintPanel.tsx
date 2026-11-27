/**
 * A sprint's Threads panel — see `.fork/customizations.yaml#fork-sprints`. The Petal panel's frame,
 * list, search and controls (bots/BotThreadsPanel) under the sprint's own header: its tabs, or a
 * thread opened from the sprint with a way back.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { SideChatParentPanel } from "~/lib/sideChatPane";

import {
  BotThreadsCloseButton,
  BotThreadsHeader,
  BotThreadsList,
  BotThreadsListBody,
  BotThreadsListControls,
  BotThreadsPanelFrame,
  type BotThreadsPanelProps,
  botThreadsPanelRightmost,
  BotThreadsSearchInput,
  useBotThreadsListing,
} from "../bots/BotThreadsPanel";
import { BotThreadsCompactRow } from "../bots/BotThreadsCompactRow";
import { BotThreadsChildConversation, BotThreadsChildHeading } from "../bots/BotThreadsChild";
import { useBotThreadsOpenChild } from "../bots/botThreadsPanelStore";
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
  const listing = useBotThreadsListing(props.sprintRef);
  const { botKey: sprintKey, view } = listing;
  const tab = useSprintPanelTab(sprintKey);
  const searching = tab === "threads" && view.query !== null;
  // The thread opened from the sprint shows here, only on the sprint's own page: on one of its
  // threads, that thread holds the main column.
  const onSprintPage = scopedThreadKey(props.currentThreadRef) === sprintKey;
  const openChild = useBotThreadsOpenChild(sprintKey);
  const child = onSprintPage ? openChild : null;
  return (
    <>
      <BotThreadsHeader
        botKey={sprintKey}
        currentThreadRef={props.currentThreadRef}
        rightmost={props.rightmost}
        // The tabs need the room: their track's own fill stands in for the inset.
        className="gap-1 pr-0.5 pl-1.5"
      >
        {child !== null ? (
          <BotThreadsChildHeading
            botKey={sprintKey}
            childRef={child}
            backLabel="Back to the sprint's threads"
          />
        ) : searching ? (
          <BotThreadsSearchInput botKey={sprintKey} view={view} />
        ) : (
          // The tabs stand in for the title; the open one names the panel.
          <SprintPanelTabStrip sprintKey={sprintKey} tab={tab} />
        )}
        <span className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
          {tab === "threads" && child === null ? (
            <>
              <SprintThreadModel sprintRef={props.sprintRef} />
              <BotThreadsListControls listing={listing} />
            </>
          ) : null}
          <BotThreadsCloseButton botRef={props.sprintRef} />
        </span>
      </BotThreadsHeader>
      {child !== null ? (
        <BotThreadsChildConversation
          botRef={props.sprintRef}
          childRef={child}
          parentPanel={props.parentPanel}
        />
      ) : tab === "threads" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BotThreadsListBody listing={listing} none="This sprint has not started any threads.">
            <BotThreadsList
              listing={listing}
              currentThreadRef={props.currentThreadRef}
              labelClassName="px-2.5"
              labelSize="interface"
              renderRow={(row, current) => (
                <BotThreadsCompactRow
                  key={row.thread.id}
                  row={row}
                  current={current}
                  // On the sprint's page a thread opens here; on one of its threads, in its place.
                  onOpenThread={
                    onSprintPage ? (ref) => openInSprintPanel(props.sprintRef, ref) : undefined
                  }
                />
              )}
            />
          </BotThreadsListBody>
        </div>
      ) : (
        <SprintPanelTabContent sprintRef={props.sprintRef} tab={tab} />
      )}
    </>
  );
}
