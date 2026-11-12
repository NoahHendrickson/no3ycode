import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// The library's own chrome in Jungle Art's creams and green.
addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "no3y code components",
    appBg: "#f2f0d8",
    appContentBg: "#f6f4e4",
    appPreviewBg: "#f6f4e4",
    appBorderColor: "#dfddc7",
    barBg: "#f6f4e4",
    colorPrimary: "#21835c",
    colorSecondary: "#21835c",
    textColor: "#1c1c1a",
    textMutedColor: "#55544c",
  }),
});
