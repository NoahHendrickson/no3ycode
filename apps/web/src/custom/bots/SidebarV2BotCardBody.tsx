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
import { SidebarV2StatusMark, type SidebarV2TopStatusMark } from "../SidebarV2StatusIndicator";
import { BotCardStatusLine } from "./BotCardStatusLine";
import { BotMascot, BotMascotTile } from "./BotMascot";
import type { BotMascotMood } from "./botMascotArt";
import { botMascotShape } from "./botMascotTags";
import { type BotShell, isBotThread } from "./botThreads";
import type { BotWorkAttention } from "./botWork";

/** How a list draws its cards: full, one line, or (Petals only) grid tiles. One value, so a
    compact grid cannot be built. */
export type SidebarV2CardView = "card" | "compact" | "grid";

/** Which body a sidebar card draws, chosen once per row. */
export type SidebarV2CardKind = "card" | "compact" | "bot" | "bot-compact" | "bot-grid";

export function sidebarV2CardKind(
  shell: Pick<BotShell, "tags">,
  view: SidebarV2CardView,
): SidebarV2CardKind {
  if (isBotThread(shell)) {
    return view === "grid" ? "bot-grid" : view === "compact" ? "bot-compact" : "bot";
  }
  return view === "compact" ? "compact" : "card";
}

/** A grid tile's hover card opens beyond the Petals section, level with the tile, so it never
    covers the neighbouring tiles. */
export function petalTileHoverAnchor(threadKey: string) {
  return {
    getBoundingClientRect: () => {
      const element = document.querySelector(`[data-thread-item="${CSS.escape(threadKey)}"]`);
      const box = element?.getBoundingClientRect() ?? new DOMRect();
      const section = element?.closest("[data-fork-petals-grid]")?.getBoundingClientRect() ?? box;
      return new DOMRect(section.x, box.y, section.width, box.height);
    },
  };
}

/** A bot in the Petals grid (Figma no3y-code 11:3126): a tile washed 4% in the sidebar's ink,
    the mascot fitted to 24px in a 28px box over its name at the sidebar row size, 8 + 28 + 16 + 10
    = 62px tall (the box's own 2px slack evens the gaps above the mascot and below the name), and
    the status mark in its top-right corner. */
export function SidebarV2BotGridBody(props: {
  readonly shell: Parameters<typeof botMascotShape>[0];
  readonly mood: BotMascotMood;
  readonly status: SidebarV2TopStatusMark | null;
  /** The status mark's seed: the row's scoped thread key. */
  readonly seed: string;
  readonly name: string;
  /** The rename field while renaming, in place of the name. */
  readonly renameField: ReactNode | null;
  /** Dims the name while its title regenerates, as a card's title does. */
  readonly regenerating: boolean;
  /** The sweep's verb badge while a sweep would act on this tile. A tile drops a card's
      working timer and hover actions; its context menu still has them. */
  readonly sweepBadge: ReactNode | null;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center bg-sidebar-foreground/4 px-1 pt-2 pb-2.5">
      <span className="flex size-7 items-center justify-center">
        <BotMascot shape={botMascotShape(props.shell)} mood={props.mood} fit={24} />
      </span>
      <span
        data-fork-bot-grid-badge=""
        className="pointer-events-none absolute top-1.5 right-[6.33px] flex size-[10.67px] items-center justify-center"
      >
        <SidebarV2StatusMark status={props.status} seed={props.seed} idle="dot" />
      </span>
      <span
        className={cn(
          // A slim row's 16px line at the default size: room for descenders, and the taller rename
          // field overhangs the padding instead of growing the tile.
          "flex h-sidebar-16 w-full min-w-0 items-center justify-center text-center text-sidebar-row font-medium",
          props.regenerating && "opacity-55",
        )}
      >
        {props.renameField ?? (
          <span aria-hidden className="min-w-0 truncate">
            {props.name}
          </span>
        )}
      </span>
      {props.sweepBadge === null ? null : (
        <span className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
          {props.sweepBadge}
        </span>
      )}
    </div>
  );
}

export function SidebarV2BotCardBody(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly shell: BotShell & { readonly id: string };
  readonly status: SidebarThreadStatus;
  readonly isUnread: boolean;
  readonly work: BotWorkAttention | null;
  readonly mood: BotMascotMood;
  readonly title: ReactNode;
  readonly trailing: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative z-10 grid grid-cols-[32px_minmax(0,1fr)_auto] grid-rows-[max(16px,var(--spacing-sidebar-16))_max(14px,var(--spacing-sidebar-14))] items-center gap-x-2 gap-y-0.5 py-1.5",
        SIDEBAR_V2_CARD_ALIGNMENT.cardPad,
      )}
    >
      <span className="row-span-2 flex items-center justify-center">
        <BotMascotTile shape={botMascotShape(props.shell)} mood={props.mood} />
      </span>
      <span className="flex h-sidebar-16 min-w-0 items-center">{props.title}</span>
      {/* ms-2 on the 8px column gap keeps the title line's 16px to the trailing group. */}
      <span className="row-span-2 ms-2 flex items-center">{props.trailing}</span>
      <BotCardStatusLine
        environmentId={props.environmentId}
        threadId={props.threadId}
        shell={props.shell}
        status={props.status}
        isUnread={props.isUnread}
        work={props.work}
      />
    </div>
  );
}
