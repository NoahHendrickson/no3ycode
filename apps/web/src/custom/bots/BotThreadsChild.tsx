/**
 * A thread opened inside a Threads panel, with a way back to the list — see
 * `.fork/customizations.yaml#fork-sprints` and `#fork-coordinator-threads`. The thread's own chat,
 * composer included, embedded as a side chat is, so the panel's owner keeps the main column; its
 * panel actions reach the owner's panel, which hosts it.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect } from "react";

import ChatView from "~/components/ChatView";
import { BackgroundThreadContext } from "~/components/chat/backgroundThread";
import { Button } from "~/components/ui/button";
import { ComposerHandleContext } from "~/composerHandleContext";
import type { SideChatParentPanel } from "~/lib/sideChatPane";
import { hostRightPanel } from "~/rightPanelStore";
import { useQuietThreadShell } from "~/state/entities";

import { ChevronLeftIcon } from "../icons/lucide-hugeicons";
import { closeBotThreadsChild } from "./botThreadsPanelStore";

/** The header's back arrow and the open thread's title, in place of the panel's own title. */
export function BotThreadsChildHeading(props: {
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

export function BotThreadsChildConversation(props: {
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
