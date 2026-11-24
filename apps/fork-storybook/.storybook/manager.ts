import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// The library's chrome in Flat Glass, the primary theme: its base, its 8% line and white ink.
addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "no3y code",
    appBg: "#161616",
    appContentBg: "#1d1d1d",
    appPreviewBg: "#1d1d1d",
    appBorderColor: "#303030",
    barBg: "#1d1d1d",
    colorPrimary: "#ffffff",
    colorSecondary: "#e8e8e8",
    textColor: "#e8e8e8",
    textMutedColor: "#9a9a9a",
    fontBase: '"Geist Variable", system-ui, sans-serif',
    fontCode: '"Geist Mono Variable", ui-monospace, monospace',
  }),
});
