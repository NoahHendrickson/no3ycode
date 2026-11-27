/**
 * A sprint's Threads panel — see `.fork/customizations.yaml#fork-sprints`. The Petal panel's frame,
 * list, search and controls (bots/BotThreadsPanel) under the sprint's own header: its tabs, or a
 * thread opened from the sprint with a way back.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Button } from "~/components/ui/button";
import type { SideChatParentPanel } from "~/lib/sideChatPane";
import { cn } from "~/lib/utils";
import { useQuietThreadShell } from "~/state/entities";

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
  useBotThreadsRow,
} from "../bots/BotThreadsPanel";
import { BotPullRequestMark } from "../bots/BotPullRequestMark";
import type { BotWorkRow } from "../bots/botWork";
import { ChevronLeftIcon } from "../icons/lucide-hugeicons";
import { ListItem } from "../ListItem";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { SprintChildConversation } from "./SprintChildConversation";
import {
  closeSprintChild,
  openInSprintPanel,
  SPRINT_PANEL_DEFAULT_WIDTH,
  useSprintOpenChild,
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
  const openChild = useSprintOpenChild(sprintKey);
  const child = onSprintPage ? openChild : null;
  const childShell = useQuietThreadShell(child);
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
          <span className="flex min-w-0 flex-1 items-center gap-1 [-webkit-app-region:no-drag]">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Back to the sprint's threads"
              onClick={() => closeSprintChild(sprintKey)}
              data-testid="sprint-child-back"
            >
              <ChevronLeftIcon />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">
              {childShell?.title ?? "Thread"}
            </h2>
          </span>
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
        <SprintChildConversation
          sprintRef={props.sprintRef}
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
                <SprintThreadsRow
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

function SprintThreadsRow(props: {
  readonly row: BotWorkRow;
  readonly current: boolean;
  readonly onOpenThread: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  return (
    <SprintThreadsRowView {...useBotThreadsRow(props.row, props.current, props.onOpenThread)} />
  );
}

/** One line per thread (mark, title, pull request, time), leaving the checkout to the thread. */
function SprintThreadsRowView(props: ReturnType<typeof useBotThreadsRow>) {
  return (
    <li>
      <ListItem
        aria-current={props.current ? "page" : undefined}
        onClick={props.onOpen}
        onContextMenu={props.onContextMenu}
        className={cn(
          "items-center gap-2.5 px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          props.current && "bg-accent",
        )}
        data-testid="bot-threads-row"
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          <SidebarV2StatusMark status={props.status} seed={props.seed} idle="dot" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-base leading-5 text-foreground">
            {props.title}
          </span>
          {props.pullRequest === null ? null : (
            <span className="shrink-0 text-xs text-muted-foreground">
              <BotPullRequestMark
                number={props.pullRequest.number}
                state={props.pullRequest.state}
              />
            </span>
          )}
          <span className="shrink-0 text-xs leading-5 text-muted-foreground tabular-nums">
            {props.time}
          </span>
        </span>
      </ListItem>
    </li>
  );
}
