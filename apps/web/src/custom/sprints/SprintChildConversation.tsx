/**
 * One of a sprint's threads, open in the sprint's panel — see `.fork/customizations.yaml#fork-sprints`.
 * The thread's own chat, composer included, embedded as a side chat is, so the sprint keeps the
 * main column; its panel actions reach the sprint's panel, which hosts it.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect } from "react";

import ChatView from "~/components/ChatView";
import { BackgroundThreadContext } from "~/components/chat/backgroundThread";
import { ComposerHandleContext } from "~/composerHandleContext";
import type { SideChatParentPanel } from "~/lib/sideChatPane";
import { hostRightPanel } from "~/rightPanelStore";

export function SprintChildConversation(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly childRef: ScopedThreadRef;
  readonly parentPanel: SideChatParentPanel;
}) {
  const { sprintRef, childRef } = props;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- registers the sprint's panel as the embedded thread's panel host
  useEffect(() => hostRightPanel(childRef, sprintRef), [childRef, sprintRef]);
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-fork-sprint-child={childRef.threadId}
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
