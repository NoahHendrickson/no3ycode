/** A bot card's Mascot submenu in the sidebar's thread menu — see `.fork/customizations.yaml#fork-bots`. */
import { BOT_MASCOT_SHAPES, type BotMascotShape, isBotMascotShape } from "./botMascotArt";
import { botMascotShape } from "./botMascotTags";
import type { BotShell } from "./botThreads";

const MASCOT_MENU_PREFIX = "bot-mascot:";
type BotMascotMenuId = `${typeof MASCOT_MENU_PREFIX}${BotMascotShape}`;

/** A bot's context-menu item for changing its mascot, ticked at the face it wears now. */
export function botMascotMenuItem(
  shell: Pick<BotShell, "tags"> & { readonly id: string },
  canOperate: boolean,
) {
  const current = botMascotShape(shell);
  return {
    id: "bot-mascot" as const,
    label: "Mascot",
    disabled: !canOperate,
    children: BOT_MASCOT_SHAPES.map((shape) => ({
      id: `${MASCOT_MENU_PREFIX}${shape}` as BotMascotMenuId,
      label: shape,
      checked: shape === current,
    })),
  };
}

/** The Mascot item and its shapes, so the menu's click handler can take them all out of its union. */
export function isBotMascotMenuId(id: string): id is "bot-mascot" | BotMascotMenuId {
  return id === "bot-mascot" || id.startsWith(MASCOT_MENU_PREFIX);
}

export function botMascotFromMenuId(id: string): BotMascotShape | null {
  if (!id.startsWith(MASCOT_MENU_PREFIX)) return null;
  const name = id.slice(MASCOT_MENU_PREFIX.length);
  return isBotMascotShape(name) ? name : null;
}
