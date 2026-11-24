/**
 * Dev desktop house look — see `.fork/customizations.yaml#fork-dev-house-look`.
 *
 * Every `dev:desktop` launch opens on the maintainer's working setup, whichever Electron profile
 * an agent started it with. Once per window session, so a reload keeps what changed since launch.
 */
import { setTheme } from "~/hooks/useTheme";
import { persistClientSettingsPatch } from "~/hooks/useSettings";

import { setForkGlass3d } from "./forkGlass3d";
import { setGlassNewAgentBackdrop } from "./forkGlassNewAgentPicture";
import { COOL_DARKER_THEME, setForkAppearance } from "./forkTheme";
import { setForkSidebarFontSize } from "./forkTypographyScale";
import { setForkWorkingMark } from "./forkWorkingMark";

const APPLIED_SESSION_KEY = "t3code:fork:dev-house-look-applied";

export const DEV_HOUSE_LOOK = {
  palette: COOL_DARKER_THEME,
  glass3d: "off",
  newAgentBackdrop: "jollyPetal",
  workingMark: "bead",
  sidebarFontSize: 14,
  fontFamilySans: "Inter Variable",
  fontSizeInterface: 15,
} as const;

export function applyDevHouseLook(): void {
  try {
    if (window.sessionStorage.getItem(APPLIED_SESSION_KEY) !== null) return;
    window.sessionStorage.setItem(APPLIED_SESSION_KEY, "1");
  } catch {
    return;
  }
  setForkGlass3d(DEV_HOUSE_LOOK.glass3d);
  setForkAppearance(DEV_HOUSE_LOOK.palette, setTheme);
  setGlassNewAgentBackdrop(DEV_HOUSE_LOOK.newAgentBackdrop);
  setForkWorkingMark(DEV_HOUSE_LOOK.workingMark);
  setForkSidebarFontSize(DEV_HOUSE_LOOK.sidebarFontSize);
  void persistClientSettingsPatch({
    fontFamilySans: DEV_HOUSE_LOOK.fontFamilySans,
    fontSizeInterface: DEV_HOUSE_LOOK.fontSizeInterface,
  });
}
