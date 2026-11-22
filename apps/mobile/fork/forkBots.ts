/**
 * Bots on the no3y iOS Threads screen — mobile copies of the Mac fork's listing, mascot and mood
 * rules (apps/web/src/custom/bots/botThreads.ts, botMascotTags.ts), parity-guarded in
 * `no3yMobileRedesign.test.ts`; see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { FORK_BOT_MASCOT_TAG_PREFIX, isForkBotThread } from "@t3tools/shared/forkBotTags";

import {
  BOT_MASCOT_SHAPES,
  isBotMascotShape,
  type BotMascotMood,
  type BotMascotShape,
} from "./botMascotArt";
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";

interface BotListFields {
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly source?: { readonly tags?: ReadonlyArray<string> | undefined } | undefined;
}

/** Live, unarchived bots, oldest first so a bot keeps its place (the Mac's listSidebarBots). */
export function listNo3yBots<T extends BotListFields>(threads: ReadonlyArray<T>): T[] {
  return threads
    .filter((thread) => thread.archivedAt === null && isForkBotThread(thread.source?.tags))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** The mascot a bot was given, or one picked from its id so an untagged bot still has a face. */
export function no3yBotMascotShape(shell: {
  readonly id: string;
  readonly tags?: ReadonlyArray<string> | undefined;
}): BotMascotShape {
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

/** The Mac's mood rules read from a card status: thinking, happy with news, crossed out, asleep. */
export function no3yBotMascotMood(kind: SidebarV2CardStatusKind | null): BotMascotMood {
  switch (kind) {
    case "failed":
    case "limited":
      return "Error";
    case "working":
      return "Thinking";
    case "done":
      return "Happy";
    case null:
    case "monitoring":
      return "Sleeping";
    default:
      return "Idle";
  }
}
