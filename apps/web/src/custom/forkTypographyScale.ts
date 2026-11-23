/**
 * Sidebar and chat stream size — see `.fork/customizations.yaml#fork-typography-settings`.
 *
 * Percentages, so both compose with upstream's Interface font size instead of fighting it.
 * Device-local, like the fork's other appearance settings: a contracts field would put a fork
 * key in a schema upstream owns.
 */
import * as Schema from "effect/Schema";

import { createForkRootSetting } from "./forkRootSetting";

export const FORK_SIDEBAR_ZOOM_ATTRIBUTE = "data-fork-sidebar-zoom";
const FORK_CHAT_TEXT_SCALE_ATTRIBUTE = "data-fork-chat-text-scale";

export const FORK_TYPOGRAPHY_SCALE_OPTIONS = [
  80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150,
] as const;
export type ForkTypographyScale = (typeof FORK_TYPOGRAPHY_SCALE_OPTIONS)[number];
export const DEFAULT_FORK_TYPOGRAPHY_SCALE: ForkTypographyScale = 100;

const ForkTypographyScaleSchema = Schema.Literals(FORK_TYPOGRAPHY_SCALE_OPTIONS);

function scaleSetting(storageKey: string, attribute: string, variable: string) {
  return createForkRootSetting({
    storageKey,
    attribute,
    schema: ForkTypographyScaleSchema,
    defaultValue: DEFAULT_FORK_TYPOGRAPHY_SCALE,
    attributeValue: (scale) => (scale === DEFAULT_FORK_TYPOGRAPHY_SCALE ? null : String(scale)),
    onApply: (scale) => {
      const root = document.documentElement;
      if (scale === DEFAULT_FORK_TYPOGRAPHY_SCALE) root.style.removeProperty(variable);
      else root.style.setProperty(variable, String(scale / 100));
    },
  });
}

export const { initialize: initializeForkSidebarZoom, useValue: useForkSidebarZoom } = scaleSetting(
  "t3code:fork:sidebar-zoom:v1",
  FORK_SIDEBAR_ZOOM_ATTRIBUTE,
  "--fork-sidebar-zoom",
);

export const { initialize: initializeForkChatTextScale, useValue: useForkChatTextScale } =
  scaleSetting(
    "t3code:fork:chat-text-scale:v1",
    FORK_CHAT_TEXT_SCALE_ATTRIBUTE,
    "--fork-chat-text-scale",
  );

/** The family theme.custom.css puts first in --fork-font-sans, which an empty preference renders. */
export const FORK_DEFAULT_SANS_FAMILY = "Geist Variable";

/** Interface font presets. Empty is the fork default, Geist. */
export const FORK_INTERFACE_FONT_PRESETS = [
  { label: "Geist", value: "" },
  { label: "Inter", value: "Inter Variable" },
  { label: "System", value: "BlinkMacSystemFont, Segoe UI, system-ui" },
] as const;

export function forkInterfaceFontPreset(value: string) {
  const trimmed = value.trim();
  return FORK_INTERFACE_FONT_PRESETS.find((preset) => preset.value === trimmed) ?? null;
}

/**
 * dnd-kit's sortable offsets for a row inside the zoomed sidebar. dnd-kit measures pointer and
 * rects in visual px, but a transform inside `zoom` is in local px and gets zoomed again, so
 * the row would outrun the pointer. The variable is only set while the zoom is.
 */
export function forkSidebarSortableTranslate(transform: { x: number; y: number } | null) {
  if (transform === null) return undefined;
  const zoom = "var(--fork-sidebar-zoom, 1)";
  return `translate3d(calc(${Math.round(transform.x)}px / ${zoom}), calc(${Math.round(transform.y)}px / ${zoom}), 0)`;
}

/** An element's effective CSS zoom, for converting visual rects into its offset space. */
export function forkEffectiveZoom(element: HTMLElement) {
  if ("currentCSSZoom" in element && typeof element.currentCSSZoom === "number") {
    return element.currentCSSZoom;
  }
  // Engines without currentCSSZoom: the rendered height over the layout height.
  const height = element.offsetHeight;
  return height > 0 ? element.getBoundingClientRect().height / height : 1;
}
