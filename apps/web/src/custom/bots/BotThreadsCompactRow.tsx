/**
 * A bot panel's one-line thread row (mark, title, pull request, time) — the sprint panel's
 * (`fork-sprints`) and the coordinator's (`fork-coordinator-threads`); a Petal's panel keeps
 * BotThreadsPanel's two-line row.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

import { ListItem } from "../ListItem";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { BotPullRequestMark } from "./BotPullRequestMark";
import { type BotThreadsRowView, useBotThreadsRow } from "./BotThreadsPanel";
import type { BotWorkRow } from "./botWork";

export function BotThreadsCompactRow(props: {
  readonly row: BotWorkRow;
  readonly current: boolean;
  readonly onOpenThread: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  return (
    <BotThreadsCompactRowView {...useBotThreadsRow(props.row, props.current, props.onOpenThread)} />
  );
}

/** One line per thread (mark, title, pull request, time), leaving the checkout to the thread. */
export function BotThreadsCompactRowView(props: ComponentProps<typeof BotThreadsRowView>) {
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
