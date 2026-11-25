/**
 * Dev desktop house look — see `.fork/customizations.yaml#fork-dev-house-look`.
 *
 * Every `dev:desktop` launch opens on the maintainer's working setup, whichever Electron profile
 * an agent started it with. Once per window session, so a reload keeps what changed since launch
 * (a window reopened from the dock is a new session and gets it again).
 */
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts";
import { isElectron } from "~/env";
import { setTheme } from "~/hooks/useTheme";
import { updateClientSettings } from "~/hooks/useSettings";

import { setForkGlass3d } from "./forkGlass3d";
import { setGlassNewAgentBackdrop } from "./forkGlassNewAgentPicture";
import { COOL_DARKER_THEME, setForkAppearance } from "./forkTheme";
import { setForkSidebarFontSize } from "./forkTypographyScale";
import { setForkWorkingMark } from "./forkWorkingMark";
import { isSideChatSurface } from "./sideChat/surface";

const APPLIED_SESSION_KEY = "t3code:fork:dev-house-look-applied";

export function applyDevHouseLook(): void {
  // The side chat starts its own session but shares the client settings file with the main window.
  if (!import.meta.env.DEV || !isElectron || isSideChatSurface) return;
  try {
    if (window.sessionStorage.getItem(APPLIED_SESSION_KEY) !== null) return;
    window.sessionStorage.setItem(APPLIED_SESSION_KEY, "1");
  } catch {
    return;
  }
  setForkGlass3d("off");
  setForkAppearance(COOL_DARKER_THEME, setTheme);
  setGlassNewAgentBackdrop("jollyPetal");
  setForkWorkingMark("bead");
  setForkSidebarFontSize(14);
  void updateClientSettings({
    fontFamilySans: DEFAULT_UNIFIED_SETTINGS.fontFamilySans,
    fontSizeInterface: 15,
  });
}
