// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-glass-3d`. The 3D glass setting gates depth
   through parent rules on a root attribute; a rule outside them ignores the setting and
   leaks depth into Flat. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_GLASS_3D_ATTRIBUTE } from "../custom/forkGlass3d";
import { COOL_DARKER_THEME, FORK_THEME_ATTRIBUTE } from "../custom/forkTheme";
import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { cssRules, topLevelHeaders } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const compact = (value: string) => value.replace(/\s+/gu, "");

const FORK_ROOT = `:root[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"]`;
const FULL = `${FORK_ROOT}:where(:not([${FORK_GLASS_3D_ATTRIBUTE}]))`;
const PALETTE = `.dark[${FORK_THEME_ATTRIBUTE}="${COOL_DARKER_THEME}"]`;

describe("fork guard: fork-glass-3d", () => {
  it("needs Full for the stage card", () => {
    expect(topLevelHeaders(readSibling("../theme.custom.glass-stage.css"))).toEqual([FULL]);
  });

  it("needs Full for every glass surface", () => {
    const sheet = readSibling("../theme.custom.glass-surfaces.css");
    expect(topLevelHeaders(sheet)).toEqual([FULL, FULL, FULL, FULL]);
  });

  it("keeps the card geometry outside the setting and the picture's old corners short of Full", () => {
    const rules = cssRules(readSibling("../theme.custom.palettes.css"));
    const tokens = rules.find((rule) => rule.body.includes("--fork-glass-card-inset:"));
    expect(compact(tokens?.selector ?? "")).toBe(compact(`${FORK_ROOT}${PALETTE}`));
    const corners = rules.find(
      (rule) =>
        compact(rule.selector) === compact(`${FORK_ROOT}[${FORK_GLASS_3D_ATTRIBUTE}]${PALETTE}`),
    );
    expect(corners?.body).toContain("--fork-glass-card-radius: 8px;");
  });

  it("drops the picture's halo clip short of Full", () => {
    const glass = compact(readSibling("../theme.custom.glass.css"));
    expect(glass).toContain(compact(`:where(:not([${FORK_GLASS_3D_ATTRIBUTE}]))${PALETTE}`));
  });

  it("stamps the root before first render and offers the setting under Glass", () => {
    expect(readSibling("../main.tsx")).toContain("initializeForkGlass3d();");
    expect(readSibling("../components/settings/AppearanceSettingsPanel.tsx")).toContain(
      'title="3D glass"',
    );
  });
});
