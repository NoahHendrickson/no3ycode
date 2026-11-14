/**
 * A bot's mascot as thread tags, and how its face reads the thread — see
 * `.fork/customizations.yaml#fork-bots`. The mascot is a second tag, `mascot:<Shape>`.
 */
import { FORK_BOT_MASCOT_TAG_PREFIX } from "@t3tools/shared/forkBotTags";

import type { SidebarThreadStatus } from "~/components/Sidebar.logic";

import {
  BOT_MASCOT_SHAPES,
  type BotMascotMood,
  type BotMascotShape,
  isBotMascotShape,
} from "./botMascotArt";
import type { BotShell } from "./botThreads";

type MascotShell = Pick<BotShell, "tags"> & { readonly id: string };

export function botMascotTag(shape: BotMascotShape): string {
  return `${FORK_BOT_MASCOT_TAG_PREFIX}${shape}`;
}

/** The mascot a bot was given, or one picked from its id so an untagged bot still has a face. */
export function botMascotShape(shell: MascotShell): BotMascotShape {
  for (const tag of shell.tags ?? []) {
    const name = tag.startsWith(FORK_BOT_MASCOT_TAG_PREFIX)
      ? tag.slice(FORK_BOT_MASCOT_TAG_PREFIX.length)
      : "";
    if (isBotMascotShape(name)) return name;
  }
  let hash = 0;
  for (const char of shell.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BOT_MASCOT_SHAPES[hash % BOT_MASCOT_SHAPES.length] ?? "Classic";
}

/** The first mascot no listed bot wears yet, so new bots look different while there are faces left. */
export function nextBotMascotShape(taken: ReadonlyArray<BotMascotShape>): BotMascotShape {
  return BOT_MASCOT_SHAPES.find((shape) => !taken.includes(shape)) ?? "Classic";
}

/** The tag writes that make `shape` a bot's only mascot: the new one first, so the bot never
    shows the face picked from its id between the writes. */
export function botMascotTagWrites(
  shell: Pick<BotShell, "tags">,
  shape: BotMascotShape,
): ReadonlyArray<{ readonly tag: string; readonly tagged: boolean }> {
  const next = botMascotTag(shape);
  const tags = shell.tags ?? [];
  return [
    ...(tags.includes(next) ? [] : [{ tag: next, tagged: true }]),
    ...tags
      .filter((tag) => tag.startsWith(FORK_BOT_MASCOT_TAG_PREFIX) && tag !== next)
      .map((tag) => ({ tag, tagged: false })),
  ];
}

/**
 * How a bot's face reads its thread: thinking while it works, happy with something to tell you,
 * crossed out when a run failed, asleep between wakes. It is awake while you have it open, and
 * whenever it is waiting on you.
 */
export function botMascotMood(input: {
  readonly status: SidebarThreadStatus;
  readonly isUnread: boolean;
  /** False while the bot's conversation is the one on screen. */
  readonly resting: boolean;
}): BotMascotMood {
  if (input.status === "failed" || input.status === "limited") return "Error";
  if (input.status === "working" || input.status === "preparing") return "Thinking";
  if (input.isUnread) return "Happy";
  return input.status === "ready" && input.resting ? "Sleeping" : "Idle";
}
