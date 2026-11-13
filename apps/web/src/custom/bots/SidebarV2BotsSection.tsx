/**
 * The sidebar's Bots and Threads sections — see `.fork/customizations.yaml#fork-bots`.
 * Their rows are in custom/SidebarV2ChromeRows; this holds what folds them and names a new bot.
 */
import * as Schema from "effect/Schema";
import { useState, type KeyboardEvent } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";

import { BotMascot } from "./BotMascot";
import { BOT_MASCOT_SHAPES, type BotMascotShape } from "./botMascots";

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

/** Names a new bot in place: Enter creates it, Escape or leaving the field empty cancels. */
export function SidebarV2NewBotRow(props: {
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
    <li data-thread-selection-safe className="flex list-none items-center gap-1 px-1">
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
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60"
      >
        <BotMascot shape={mascot} mood="Idle" />
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
        className="h-9 min-w-0 flex-1 rounded-md border border-sidebar-border bg-transparent px-2 text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60"
      />
    </li>
  );
}
