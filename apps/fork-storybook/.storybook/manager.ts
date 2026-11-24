import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// The library's chrome in Basic · Darker Neutral: the base, its 8% line and white ink.
addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "no3y code — Basic",
    appBg: "#171717",
    appContentBg: "#232323",
    appPreviewBg: "#232323",
    appBorderColor: "#383838",
    barBg: "#232323",
    colorPrimary: "#ffffff",
    colorSecondary: "#e8e8e8",
    textColor: "#e8e8e8",
    textMutedColor: "#9a9a9a",
    fontBase: '"Geist Variable", system-ui, sans-serif',
    fontCode: '"Geist Mono Variable", ui-monospace, monospace',
  }),
});
