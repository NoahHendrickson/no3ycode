import "./appearance.ts";
// The app's stylesheets, in main.tsx's order (__fork_guards__/forkStorybook.test.ts keeps them in step).
import "@fontsource-variable/inter";
import "~/index.css";
import "~/theme.custom.css";
import "~/theme.custom.palettes.css";
import "~/theme.custom.glass-surfaces.css";
import "~/theme.custom.glass-stage.css";
import "~/theme.custom.focus-rings.css";

import type { Decorator, Preview } from "@storybook/react-vite";

import { applyForkMarker } from "~/custom/forkMarker";
import { initializeForkTheme } from "~/custom/forkTheme";
import { installInletMenuMorph } from "~/custom/inletMenuMorph";

import { Surface, type SurfaceName } from "../stories/Surface.tsx";

// main.tsx's theme startup, unchanged.
applyForkMarker(document.documentElement);
initializeForkTheme();
installInletMenuMorph();

const withSurface: Decorator = (Story, context) => (
  <Surface name={(context.parameters["surface"] as SurfaceName | undefined) ?? "panel"}>
    <Story />
  </Surface>
);

const preview: Preview = {
  decorators: [withSurface],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    options: {
      storySort: { order: ["Introduction", "Foundations", "Components", "Patterns"] },
    },
    // Each docs example renders in its own frame: surfaces fill it, and an opened popup stays
    // inside its own example. The code panel shows the story as written: the real composition.
    docs: { story: { inline: false, iframeHeight: 280 }, source: { type: "code" } },
  },
};

export default preview;
