// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=68-54
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/settings/SettingsSidebarNav.tsx
// component=SettingsSidebarNav
import figma from "figma";

// The settings sidebar: its search, groups and rows come from the settings routes.
export default {
  example: figma.tsx`<SettingsSidebarNav pathname={location.pathname} />`,
  imports: ['import { SettingsSidebarNav } from "~/components/settings/SettingsSidebarNav";'],
  id: "settings-sidebar",
};
