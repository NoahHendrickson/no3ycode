/**
 * The sidebar's Bots section — see `.fork/customizations.yaml#fork-bots`: its row, its cards'
 * density, naming a new bot, and what folds it and the Threads list under it.
 */
import * as Schema from "effect/Schema";
import { PlusIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

import { Menu, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { SidebarGroup, SidebarMenuButton } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";

import { SettingsIcon } from "../icons/lucide-hugeicons";
import { SIDEBAR_V2_CARD_ALIGNMENT } from "../sidebarV2CardAlignment";
import { CHROME_ROW_INSET, OptionCheckboxItem, PROJECTS_ROW_BUTTON } from "../SidebarV2ChromeRows";
import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";

import { BotMascot, BotMascotTile } from "./BotMascot";
import { BOT_MASCOT_SHAPES, type BotMascotShape } from "./botMascotArt";
import { PetalLayout, PetalLayoutPicker } from "./PetalLayoutPicker";
import type { SidebarV2CardView } from "./SidebarV2BotCardBody";

export type SidebarV2ListSection = "bots" | "threads";

const COLLAPSED_SECTIONS_STORAGE_KEY = "t3code:fork:sidebar-v2-collapsed-list-sections:v1";
const CollapsedSections = Schema.Array(Schema.Literals(["bots", "threads"]));
const NONE_COLLAPSED: ReadonlyArray<SidebarV2ListSection> = [];

/** Which of the two sections are folded, per device like the other collapse stores. */
export function useSidebarV2CollapsedListSections(): readonly [
  (section: SidebarV2ListSection) => boolean,
  (section: SidebarV2ListSection) => void,
] {
  const [collapsed, setCollapsed] = useLocalStorage(
    COLLAPSED_SECTIONS_STORAGE_KEY,
    NONE_COLLAPSED,
    CollapsedSections,
  );
  return [
    (section) => collapsed.includes(section),
    (section) =>
      setCollapsed((previous) =>
        previous.includes(section)
          ? previous.filter((entry) => entry !== section)
          : [...previous, section],
      ),
  ];
}

const COMPACT_BOTS_STORAGE_KEY = "t3code:fork:sidebar-v2-compact-bots:v1";

/** One-line bot cards, apart from the threads' Compact cards: bots default to the avatar card. */
export function useSidebarV2CompactBots(): [boolean, (value: boolean) => void] {
  return useLocalStorage(COMPACT_BOTS_STORAGE_KEY, false, Schema.Boolean);
}

const BOTS_LAYOUT_STORAGE_KEY = "t3code:fork:sidebar-v2-bots-layout:v1";

/** Petals as a list of cards, or as a grid of mascot tiles with their names under them. */
export function useSidebarV2BotsLayout(): [PetalLayout, (value: PetalLayout) => void] {
  return useLocalStorage(BOTS_LAYOUT_STORAGE_KEY, "list", PetalLayout);
}

/** Names a new bot in place: Enter creates it, Escape or leaving the field empty cancels. Drawn
    as the card it becomes: the 44px avatar card (SidebarV2BotCardBody), or the compact card's
    32px line with the mascot at one pixel per cell. */
export function SidebarV2NewBotRow(props: {
  /** The Petals' view: the compact line, or the full card (which the grid's row also draws,
      spanning every column). */
  readonly view: SidebarV2CardView;
  /** The mascot offered first; the button beside the name steps through the rest. */
  readonly initialMascot: BotMascotShape;
  readonly onCreate: (name: string, mascot: BotMascotShape) => Promise<unknown>;
  readonly onDone: () => void;
}) {
  const compact = props.view === "compact";
  const [name, setName] = useState("");
  const [mascot, setMascot] = useState(props.initialMascot);
  const [creating, setCreating] = useState(false);
  const submit = () => {
    if (creating) return;
    if (name.trim() === "") {
      props.onDone();
      return;
    }
    setCreating(true);
    void props.onCreate(name, mascot).then((created) => {
      // A failure keeps the name, so the fix is one keystroke from a retry.
      if (created === null) setCreating(false);
      else props.onDone();
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      props.onDone();
    }
  };
  return (
    <li
      data-thread-selection-safe
      className={cn(
        "flex list-none items-center gap-x-2",
        compact ? "h-8" : "h-11",
        props.view === "grid" && "col-span-full",
        SIDEBAR_V2_CARD_ALIGNMENT.cardPad,
      )}
    >
      {/* The card's mascot column (22px compact, the 32px tile full); the 36px button overhangs it
          evenly, so the draft's mascot and name sit where the saved card puts them. */}
      <button
        type="button"
        disabled={creating}
        aria-label={`Mascot: ${mascot}. Change mascot`}
        data-testid="sidebar-v2-new-bot-mascot"
        // Keeps the name field focused, so stepping through mascots does not cancel an empty row.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() =>
          setMascot(
            (current) =>
              BOT_MASCOT_SHAPES[
                (BOT_MASCOT_SHAPES.indexOf(current) + 1) % BOT_MASCOT_SHAPES.length
              ] ?? current,
          )
        }
        className={cn(
          "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60",
          compact ? "-mx-[7px]" : "-mx-[2px]",
        )}
      >
        {compact ? (
          <BotMascot shape={mascot} mood="Idle" />
        ) : (
          <BotMascotTile shape={mascot} mood="Idle" />
        )}
      </button>
      <input
        autoFocus
        value={name}
        disabled={creating}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!creating && name.trim() === "") props.onDone();
        }}
        maxLength={80}
        placeholder="Name your petal"
        aria-label="Petal name"
        data-testid="sidebar-v2-new-bot-name"
        // Where the card's title sits, and as tall as the row allows.
        className={cn(
          "min-w-0 flex-1 rounded-md border border-sidebar-border bg-transparent px-2 text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60",
          compact ? "h-7" : "h-8",
        )}
      />
    </li>
  );
}

/** @public — the Petals grid's columns: as many tiles at least 64px wide as the width holds,
    sharing it equally, 8px apart. auto-fit, so a short row still spans the sidebar. Storybook
    lays its tiles out on it too. */
export const PETALS_GRID_CLASS_NAME = "grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-2";

/** @public — the Petals row's View options popup: the layout picker, and Compact cards under it
    while the layout is List. Storybook opens it on its own. */
export function PetalViewOptionsMenu(props: {
  readonly layout: PetalLayout;
  readonly onLayoutChange: (layout: PetalLayout) => void;
  readonly compactCards: boolean;
  readonly onCompactCardsChange: (compactCards: boolean) => void;
}) {
  return (
    <MenuPopup align="end" data-fork-glass-rim data-fork-tab-menu="sidebar" className="min-w-48">
      <PetalLayoutPicker layout={props.layout} onLayoutChange={props.onLayoutChange} />
      {props.layout === "list" ? (
        <>
          <MenuSeparator className="-mx-1" />
          <OptionCheckboxItem
            checked={props.compactCards}
            onCheckedChange={props.onCompactCardsChange}
            testId="sidebar-v2-compact-bots-toggle"
          >
            Compact cards
          </OptionCheckboxItem>
        </>
      ) : null}
    </MenuPopup>
  );
}

/** The Bots section above the Threads row, in its shape: label, fold chevron, view options
    and a plus that names a new bot. Its cards are its children. */
export function SidebarV2BotsRow(props: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly onNewBot: () => void;
  readonly layout: PetalLayout;
  readonly onLayoutChange: (layout: PetalLayout) => void;
  /** The bots' own card density, independent of the threads' Compact cards; the list's alone. */
  readonly compactCards: boolean;
  readonly onCompactCardsChange: (compactCards: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <SidebarGroup data-fork-bots-row="" className={cn("mt-6 px-2 pt-0 pb-0", CHROME_ROW_INSET)}>
      <div className="flex h-8 items-center gap-1.5 px-3">
        <span role="heading" aria-level={2} className="min-w-0 flex-1 truncate text-left">
          <SidebarV2SectionLabel
            collapsed={props.collapsed}
            onToggle={props.onToggleCollapsed}
            testId="sidebar-v2-bots-section-toggle"
          >
            Petals
          </SidebarV2SectionLabel>
        </span>
        <div className="-me-3 flex shrink-0 items-center">
          <Menu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <MenuTrigger
                    render={
                      <SidebarMenuButton
                        size="sm"
                        type="button"
                        className={PROJECTS_ROW_BUTTON}
                        aria-label="Petal view options"
                        data-testid="sidebar-v2-bots-options"
                        data-fork-tab-trigger=""
                      />
                    }
                  />
                }
              >
                <SettingsIcon className="size-4 shrink-0" />
              </TooltipTrigger>
              <TooltipPopup side="right">View options</TooltipPopup>
            </Tooltip>
            <PetalViewOptionsMenu
              layout={props.layout}
              onLayoutChange={props.onLayoutChange}
              compactCards={props.compactCards}
              onCompactCardsChange={props.onCompactCardsChange}
            />
          </Menu>
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarMenuButton
                  size="sm"
                  type="button"
                  className={PROJECTS_ROW_BUTTON}
                  aria-label="New petal"
                  data-testid="sidebar-v2-new-bot"
                  onClick={props.onNewBot}
                />
              }
            >
              <PlusIcon className="size-4 shrink-0" />
            </TooltipTrigger>
            <TooltipPopup side="right">New petal</TooltipPopup>
          </Tooltip>
        </div>
      </div>
      {/* The thread list's tooltip timing, so a bot card's hover card opens like a thread's. */}
      <TooltipProvider delay={150} closeDelay={0} timeout={400}>
        {/* 4px under the header row, so the first card never meets its buttons; none when
            folded away to nothing or empty. */}
        <ul
          role="presentation"
          data-fork-petals-grid={props.layout === "grid" ? "" : undefined}
          className={cn(
            "mt-1 empty:mt-0",
            props.layout === "grid"
              ? PETALS_GRID_CLASS_NAME
              : cn("flex flex-col", SIDEBAR_V2_CARD_ALIGNMENT.listGap),
          )}
        >
          {props.children}
        </ul>
      </TooltipProvider>
    </SidebarGroup>
  );
}
