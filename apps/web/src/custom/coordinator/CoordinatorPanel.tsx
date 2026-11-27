/**
 * A coordinator's Threads panel — see `.fork/customizations.yaml#fork-coordinator-threads`. The
 * Petal panel's frame, list, search and controls (bots/BotThreadsPanel) listing the coordinator's
 * children by status; on the coordinator's own page a child opens here, with a way back.
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
  BotThreadsRowView,
  BotThreadsSearchInput,
  useBotThreadsListing,
  useBotThreadsRow,
} from "../bots/BotThreadsPanel";
import { BotThreadsChildConversation, BotThreadsChildHeading } from "../bots/BotThreadsChild";
import type { BotWorkRow } from "../bots/botWork";
import { openBotThreadsChild, useBotThreadsOpenChild } from "../bots/botThreadsPanelStore";
import { BOT_THREADS_PANEL_DEFAULT_WIDTH } from "../bots/stagePanels";

export function CoordinatorPanel(
  props: BotThreadsPanelProps & {
    /** The conversation's own panel, which a child opened here borrows as a side chat does. */
    readonly parentPanel: SideChatParentPanel;
  },
) {
  return (
    <BotThreadsPanelFrame {...props} defaultWidth={BOT_THREADS_PANEL_DEFAULT_WIDTH}>
      <CoordinatorPanelBody
        coordinatorRef={props.botRef}
        currentThreadRef={props.threadRef}
        rightmost={botThreadsPanelRightmost(props)}
        parentPanel={props.parentPanel}
      />
    </BotThreadsPanelFrame>
  );
}

function CoordinatorPanelBody(props: {
  readonly coordinatorRef: ScopedThreadRef;
  readonly currentThreadRef: ScopedThreadRef;
  readonly rightmost: boolean;
  readonly parentPanel: SideChatParentPanel;
}) {
  const listing = useBotThreadsListing(props.coordinatorRef);
  const { botKey, view } = listing;
  // A child opens here only on the coordinator's page: on a child's, that child holds the column.
  const onCoordinatorPage = scopedThreadKey(props.currentThreadRef) === botKey;
  const openChild = useBotThreadsOpenChild(botKey);
  const child = onCoordinatorPage ? openChild : null;
  return (
    <>
      <BotThreadsHeader
        botKey={botKey}
        currentThreadRef={props.currentThreadRef}
        rightmost={props.rightmost}
        className={child === null ? "gap-2 pr-2 pl-3.5" : "gap-1 pr-2 pl-1.5"}
      >
        {child !== null ? (
          <BotThreadsChildHeading
            botKey={botKey}
            childRef={child}
            backLabel="Back to the coordinator's threads"
          />
        ) : view.query === null ? (
          <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">Threads</h2>
        ) : (
          <BotThreadsSearchInput botKey={botKey} view={view} />
        )}
        <span className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
          {child === null ? <BotThreadsListControls listing={listing} /> : null}
          <BotThreadsCloseButton botRef={props.coordinatorRef} />
        </span>
      </BotThreadsHeader>
      {child !== null ? (
        <BotThreadsChildConversation
          botRef={props.coordinatorRef}
          childRef={child}
          parentPanel={props.parentPanel}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BotThreadsListBody listing={listing} none="This coordinator has not delegated any work.">
            <BotThreadsList
              listing={listing}
              currentThreadRef={props.currentThreadRef}
              renderRow={(row, current) => (
                <CoordinatorThreadsRow
                  key={row.thread.id}
                  row={row}
                  current={current}
                  onOpenThread={
                    onCoordinatorPage
                      ? (ref) => openBotThreadsChild(props.coordinatorRef, ref)
                      : undefined
                  }
                />
              )}
            />
          </BotThreadsListBody>
        </div>
      )}
    </>
  );
}

function CoordinatorThreadsRow(props: {
  readonly row: BotWorkRow;
  readonly current: boolean;
  readonly onOpenThread: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  return <BotThreadsRowView {...useBotThreadsRow(props.row, props.current, props.onOpenThread)} />;
}
