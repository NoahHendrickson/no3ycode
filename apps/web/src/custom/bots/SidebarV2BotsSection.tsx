/**
 * The sidebar's Bots section — see `.fork/customizations.yaml#fork-bots`: its row, its cards'
 * density, naming a new bot, and what folds it and the Threads list under it.
 */
import * as Schema from "effect/Schema";
import { PlusIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

import { Menu, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { SidebarGroup, SidebarMenuButton } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";

import { SettingsIcon } from "../icons/lucide-phosphor";
import { SIDEBAR_V2_CARD_ALIGNMENT } from "../sidebarV2CardAlignment";
import { CHROME_ROW_INSET, OptionCheckboxItem, PROJECTS_ROW_BUTTON } from "../SidebarV2ChromeRows";
import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";

import { BotMascot } from "./BotMascot";
import { BOT_MASCOT_SHAPES, type BotMascotShape } from "./botMascotArt";

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

/** Names a new bot in place: Enter creates it, Escape or leaving the field empty cancels. Drawn
    as the card it becomes: the 44px avatar card (SidebarV2BotCardBody), or the compact card's
    34px line with the mascot at one pixel per cell. */
export function SidebarV2NewBotRow(props: {
  readonly compact: boolean;
  /** The mascot offered first; the button beside the name steps through the rest. */
  readonly initialMascot: BotMascotShape;
  readonly onCreate: (name: string, mascot: BotMascotShape) => Promise<unknown>;
  readonly onDone: () => void;
}) {
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
        props.compact ? "h-[34px]" : "h-11",
        SIDEBAR_V2_CARD_ALIGNMENT.cardPad,
      )}
    >
      {/* The card's 22px mascot column; the 36px button overhangs it evenly. */}
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
        className="-mx-[7px] flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60"
      >
        {props.compact ? (
          <BotMascot shape={mascot} mood="Idle" />
        ) : (
          <BotMascot shape={mascot} mood="Idle" fit={22} />
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
        placeholder="Name your bot"
        aria-label="Bot name"
        data-testid="sidebar-v2-new-bot-name"
        // Where the card's title sits, and as tall as the row allows.
        className={cn(
          "min-w-0 flex-1 rounded-md border border-sidebar-border bg-transparent px-2 text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60",
          props.compact ? "h-7" : "h-8",
        )}
      />
    </li>
  );
}

/** The Bots section above the Threads row, in its shape: label, count, fold caret, view options
    and a plus that names a new bot. Its cards are its children. */
export function SidebarV2BotsRow(props: {
  readonly count: number;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly onNewBot: () => void;
  /** The bots' own card density, independent of the threads' Compact cards. */
  readonly compactCards: boolean;
  readonly onCompactCardsChange: (compactCards: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <SidebarGroup data-fork-bots-row="" className={cn("mt-6 px-2 pt-0 pb-0", CHROME_ROW_INSET)}>
      <div className="flex h-8 items-center gap-1.5 px-3">
        <span role="heading" aria-level={2} className="min-w-0 flex-1 truncate text-left">
          <SidebarV2SectionLabel
            count={props.count}
            collapsed={props.collapsed}
            onToggle={props.onToggleCollapsed}
            testId="sidebar-v2-bots-section-toggle"
          >
            Bots
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
                        aria-label="Bot view options"
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
            <MenuPopup
              align="end"
              data-fork-glass-rim
              data-fork-tab-menu="sidebar"
              className="min-w-48"
            >
              <OptionCheckboxItem
                checked={props.compactCards}
                onCheckedChange={props.onCompactCardsChange}
                testId="sidebar-v2-compact-bots-toggle"
              >
                Compact cards
              </OptionCheckboxItem>
            </MenuPopup>
          </Menu>
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarMenuButton
                  size="sm"
                  type="button"
                  className={PROJECTS_ROW_BUTTON}
                  aria-label="New bot"
                  data-testid="sidebar-v2-new-bot"
                  onClick={props.onNewBot}
                />
              }
            >
              <PlusIcon className="size-4 shrink-0" />
            </TooltipTrigger>
            <TooltipPopup side="right">New bot</TooltipPopup>
          </Tooltip>
        </div>
      </div>
      {/* The thread list's tooltip timing, so a bot card's hover card opens like a thread's. */}
      <TooltipProvider delay={150} closeDelay={0} timeout={400}>
        {/* 4px under the header row, so the first card never meets its buttons; none when
            folded away to nothing or empty. */}
        <ul
          role="presentation"
          className={cn("mt-1 flex flex-col empty:mt-0", SIDEBAR_V2_CARD_ALIGNMENT.listGap)}
        >
          {props.children}
        </ul>
      </TooltipProvider>
    </SidebarGroup>
  );
}
