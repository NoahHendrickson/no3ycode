import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// The library's chrome in Basic · Dark Neutral: the base, its 8% line and white ink.
addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "no3y code — Basic",
    appBg: "#232323",
    appContentBg: "#2b2b2b",
    appPreviewBg: "#2b2b2b",
    appBorderColor: "#404040",
    barBg: "#2b2b2b",
    colorPrimary: "#ffffff",
    colorSecondary: "#e8e8e8",
    textColor: "#e8e8e8",
    textMutedColor: "#9a9a9a",
    fontBase: '"Geist Variable", system-ui, sans-serif',
    fontCode: '"Geist Mono Variable", ui-monospace, monospace',
  }),
});
