// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=124-949
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/BotMascot.tsx
// component=BotMascot
import figma from "figma";

const mascot = figma.selectedInstance;
const shape = mascot.getEnum("Shape", {
  Classic: "Classic",
  Round: "Round",
  Willow: "Willow",
  Heart: "Heart",
  Maple: "Maple",
  Oak: "Oak",
  Ginkgo: "Ginkgo",
  Monstera: "Monstera",
  Sakura: "Sakura",
  Spoon: "Spoon",
  Tulip: "Tulip",
  Drop: "Drop",
  Bell: "Bell",
  Bud: "Bud",
});
const mood = mascot.getEnum("Mood", {
  Idle: "Idle",
  Thinking: "Thinking",
  Happy: "Happy",
  Sleeping: "Sleeping",
  Error: "Error",
});
// Tile On is a card's 32px tile, Grid the Petals grid's 48px one.
const tile = mascot.getEnum("Tile", { On: "", Grid: ' size="grid"' });
const props = `shape="${shape ?? "Classic"}" mood="${mood ?? "Idle"}"`;

export default {
  example:
    tile === undefined
      ? figma.tsx`<BotMascot ${props} />`
      : figma.tsx`<BotMascotTile ${props}${tile} />`,
  imports: [
    tile === undefined
      ? 'import { BotMascot } from "~/custom/bots/BotMascot";'
      : 'import { BotMascotTile } from "~/custom/bots/BotMascot";',
  ],
  id: "petal-mascot",
  metadata: { nestable: true },
};
