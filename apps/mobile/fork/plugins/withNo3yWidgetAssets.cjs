"use strict";

// Fork-owned — see .fork/customizations.yaml#no3y-live-activity. Adds the no3y Live Activity's
// marks to the widget catalog upstream's withWidgetLogoAsset creates and wires; listed
// before it so this mod runs after it (mods run in reverse order).

const path = require("path");
const fs = require("fs");
const { withDangerousMod } = require("expo/config-plugins");

const CATALOG = path.join("ExpoWidgetsTarget", "Assets.xcassets");

/** Image set name → source file, relative to the mobile app root. */
const IMAGES = {
  No3yLeaf: "../../assets/fork/app-icon.icon/Assets/mark.svg",
  No3yClaude: "fork/assets/widget/No3yClaude.svg",
  // codex-mark.png baked as No3yProviderMark draws it (#8680ff cloud, white prompt): no tint here.
  No3yCodex: "fork/assets/widget/No3yCodex.png",
  // beadRingPath's still frame, cropped to the ring.
  No3yBeadRing: "fork/assets/widget/No3yBeadRing.svg",
  // The Figma lockup (no3y-code file, "Lockup · on light"), split so the words can take the card's ink.
  No3yWordNoey: "fork/assets/widget/No3yWordNoey.svg",
  No3yLeafSquares: "fork/assets/widget/No3yLeafSquares.svg",
  No3yWordCode: "fork/assets/widget/No3yWordCode.svg",
};
/** Drawn as masks the card tints: the bead ring with its status colour, the words with its ink. */
const TEMPLATES = new Set(["No3yBeadRing", "No3yWordNoey", "No3yWordCode"]);

module.exports = function withNo3yWidgetAssets(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      for (const [name, relative] of Object.entries(IMAGES)) {
        const source = path.join(cfg.modRequest.projectRoot, relative);
        const filename = path.basename(source);
        const dir = path.join(cfg.modRequest.platformProjectRoot, CATALOG, `${name}.imageset`);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(source, path.join(dir, filename));
        const vector = filename.endsWith(".svg");
        const intent = TEMPLATES.has(name) ? "template" : "original";
        const contents = {
          // The 128px Codex PNG stands in for 3x at the card's 15pt.
          images: [
            vector
              ? { idiom: "universal", filename }
              : { idiom: "universal", filename, scale: "3x" },
          ],
          info: { author: "expo", version: 1 },
          properties: vector
            ? { "preserves-vector-representation": true, "template-rendering-intent": intent }
            : { "template-rendering-intent": intent },
        };
        fs.writeFileSync(path.join(dir, "Contents.json"), `${JSON.stringify(contents, null, 2)}\n`);
      }
      return cfg;
    },
  ]);
};
