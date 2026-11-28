/**
 * The body of a panel that opens its threads in place, and the thread opened there — see
 * `.fork/customizations.yaml#fork-sprints` and `#fork-coordinator-threads`. The thread's own chat,
 * embedded as a side chat is, so the owner keeps the main column; its panel actions reach the owner's.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { type ReactNode, useEffect } from "react";

import ChatView from "~/components/ChatView";
import { BackgroundThreadContext } from "~/components/chat/backgroundThread";
import { Button } from "~/components/ui/button";
import { ComposerHandleContext } from "~/composerHandleContext";
import type { SideChatParentPanel } from "~/lib/sideChatPane";
import { hostRightPanel } from "~/rightPanelStore";
import { useQuietThreadShell } from "~/state/entities";

import { ChevronLeftIcon } from "../icons/lucide-hugeicons";
import { BotThreadsCompactRow } from "./BotThreadsCompactRow";
import {
  BotThreadsCloseButton,
  BotThreadsHeader,
  BotThreadsList,
  BotThreadsListBody,
  BotThreadsListControls,
  BotThreadsSearchInput,
  useBotThreadsListing,
} from "./BotThreadsPanel";
import { closeBotThreadsChild, useBotThreadsOpenChild } from "./botThreadsPanelStore";

/** The header's back arrow and the open thread's title, in place of the panel's own title. */
function BotThreadsChildHeading(props: {
  readonly botKey: string;
  readonly childRef: ScopedThreadRef;
  readonly backLabel: string;
}) {
  const child = useQuietThreadShell(props.childRef);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1 [-webkit-app-region:no-drag]">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={props.backLabel}
        onClick={() => closeBotThreadsChild(props.botKey)}
        data-testid="bot-threads-child-back"
      >
        <ChevronLeftIcon />
      </Button>
      <h2 className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">
        {child?.title ?? "Thread"}
      </h2>
    </span>
  );
}

function BotThreadsChildConversation(props: {
  readonly botRef: ScopedThreadRef;
  readonly childRef: ScopedThreadRef;
  readonly parentPanel: SideChatParentPanel;
}) {
  const { botRef, childRef } = props;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- registers the owner's panel as the embedded thread's panel host
  useEffect(() => hostRightPanel(childRef, botRef), [childRef, botRef]);
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-fork-panel-child={childRef.threadId}
      data-side-chat-pane={childRef.threadId}
    >
      <BackgroundThreadContext value>
        <ComposerHandleContext value={null}>
          <ChatView
            key={childRef.threadId}
            environmentId={childRef.environmentId}
            threadId={childRef.threadId}
            routeKind="server"
            embedded={props.parentPanel}
          />
        </ComposerHandleContext>
      </BackgroundThreadContext>
    </div>
  );
}

/** A panel that opens its threads in place (a sprint's, a coordinator's): the header (the opened
    thread's heading, search, or `title`), then the compact list, `content` in its place, or on the
    owner's own page the opened thread. On a thread's page that thread holds the main column, so it
    never opens here. */
export function BotThreadsChildPanelBody(props: {
  readonly ownerRef: ScopedThreadRef;
  readonly currentThreadRef: ScopedThreadRef;
  readonly rightmost: boolean;
  readonly parentPanel: SideChatParentPanel;
  /** The header's gap and side insets, with a thread opened or not. */
  readonly headerClassName: (childOpen: boolean) => string;
  readonly backLabel: string;
  /** The header's title, unless the list is searched. */
  readonly title: ReactNode;
  /** Ahead of the list's own controls, which show with the list. */
  readonly controls?: ReactNode;
  /** Shown in place of the list (a sprint's other tabs); null or absent shows the list. */
  readonly content?: ReactNode;
  /** Why the list is empty when the owner has started nothing. */
  readonly none: string;
  /** Opens a row's thread here, on the owner's page. */
  readonly openThread: (ref: ScopedThreadRef) => void;
}) {
  const listing = useBotThreadsListing(props.ownerRef);
  const { botKey, view } = listing;
  const listShown = props.content == null;
  const onOwnerPage = scopedThreadKey(props.currentThreadRef) === botKey;
  const openChild = useBotThreadsOpenChild(botKey);
  const child = onOwnerPage ? openChild : null;
  return (
    <>
      <BotThreadsHeader
        botKey={botKey}
        currentThreadRef={props.currentThreadRef}
        rightmost={props.rightmost}
        className={props.headerClassName(child !== null)}
      >
        {child !== null ? (
          <BotThreadsChildHeading botKey={botKey} childRef={child} backLabel={props.backLabel} />
        ) : listShown && view.query !== null ? (
          <BotThreadsSearchInput botKey={botKey} view={view} />
        ) : (
          props.title
        )}
        <span className="flex shrink-0 items-center [-webkit-app-region:no-drag]">
          {listShown && child === null ? (
            <>
              {props.controls}
              <BotThreadsListControls listing={listing} />
            </>
          ) : null}
          <BotThreadsCloseButton botRef={props.ownerRef} />
        </span>
      </BotThreadsHeader>
      {child !== null ? (
        <BotThreadsChildConversation
          botRef={props.ownerRef}
          childRef={child}
          parentPanel={props.parentPanel}
        />
      ) : listShown ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BotThreadsListBody listing={listing} none={props.none}>
            <BotThreadsList
              listing={listing}
              currentThreadRef={props.currentThreadRef}
              // Compact: interface-size headers over one-line rows.
              labelClassName="px-2.5"
              labelSize="interface"
              renderRow={(row, current) => (
                <BotThreadsCompactRow
                  key={row.thread.id}
                  row={row}
                  current={current}
                  // On the owner's page a thread opens here; on one of its threads, in its place.
                  onOpenThread={onOwnerPage ? props.openThread : undefined}
                />
              )}
            />
          </BotThreadsListBody>
        </div>
      ) : (
        props.content
      )}
    </>
  );
}
