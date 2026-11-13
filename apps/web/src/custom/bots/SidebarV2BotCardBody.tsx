/**
 * A bot's sidebar card body — see `.fork/customizations.yaml#fork-bots`. The mascot is an avatar
 * beside both lines, the second line is a status in words, and the card's trailing group (time,
 * actions, pin, status mark) sits centred on both lines. 6 + 16 + 2 + 14 + 6 = 44px.
 */
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { ReactNode } from "react";

import type { SidebarThreadStatus } from "~/components/Sidebar.logic";
import { cn } from "~/lib/utils";

import { SIDEBAR_V2_CARD_ALIGNMENT } from "../sidebarV2CardAlignment";
import { BotCardStatusLine } from "./BotCardStatusLine";
import { BotMascot } from "./BotMascot";
import type { BotMascotMood } from "./botMascotArt";
import { botMascotShape } from "./botMascotTags";
import { type BotShell, isBotThread } from "./botThreads";

/** Which body a sidebar card draws, chosen once per row. */
export type SidebarV2CardKind = "card" | "compact" | "bot" | "bot-compact";

export function sidebarV2CardKind(
  shell: Pick<BotShell, "tags">,
  compact: boolean,
): SidebarV2CardKind {
  if (isBotThread(shell)) return compact ? "bot-compact" : "bot";
  return compact ? "compact" : "card";
}

export function SidebarV2BotCardBody(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly shell: BotShell & { readonly id: string };
  readonly status: SidebarThreadStatus;
  readonly isUnread: boolean;
  readonly mood: BotMascotMood;
  readonly title: ReactNode;
  readonly trailing: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative z-10 grid grid-cols-[22px_minmax(0,1fr)_auto] grid-rows-[16px_14px] items-center gap-x-2 gap-y-0.5 py-1.5",
        SIDEBAR_V2_CARD_ALIGNMENT.cardPad,
      )}
    >
      <span className="row-span-2 flex items-center justify-center">
        <BotMascot shape={botMascotShape(props.shell)} mood={props.mood} fit={22} />
      </span>
      <span className="flex h-4 min-w-0 items-center">{props.title}</span>
      {/* ms-2 on the 8px column gap keeps the title line's 16px to the trailing group. */}
      <span className="row-span-2 ms-2 flex items-center">{props.trailing}</span>
      <BotCardStatusLine
        environmentId={props.environmentId}
        threadId={props.threadId}
        shell={props.shell}
        status={props.status}
        isUnread={props.isUnread}
      />
    </div>
  );
}
