/**
 * Sidebar font size and chat stream size — see `.fork/customizations.yaml#fork-typography-settings`.
 *
 * Device-local, like the fork's other appearance settings: a contracts field would put a fork
 * key in a schema upstream owns.
 */
import * as Schema from "effect/Schema";

import { createForkRootSetting } from "./forkRootSetting";

const FORK_SIDEBAR_FONT_SIZE_ATTRIBUTE = "data-fork-sidebar-font-size";
const FORK_CHAT_TEXT_SCALE_ATTRIBUTE = "data-fork-chat-text-scale";

/** Thread titles' size, in px. The sidebar's other type sizes and line boxes keep their ratio
    to it (index.css `--text-sidebar-*`), so rows grow with the text. */
export const MIN_FORK_SIDEBAR_FONT_SIZE = 11;
export const MAX_FORK_SIDEBAR_FONT_SIZE = 20;
export const DEFAULT_FORK_SIDEBAR_FONT_SIZE = 14;

const ForkSidebarFontSizeSchema = Schema.Int.check(
  Schema.isBetween({ minimum: MIN_FORK_SIDEBAR_FONT_SIZE, maximum: MAX_FORK_SIDEBAR_FONT_SIZE }),
);

export const { initialize: initializeForkSidebarFontSize, useValue: useForkSidebarFontSize } =
  createForkRootSetting({
    storageKey: "t3code:fork:sidebar-font-size:v1",
    attribute: FORK_SIDEBAR_FONT_SIZE_ATTRIBUTE,
    schema: ForkSidebarFontSizeSchema,
    defaultValue: DEFAULT_FORK_SIDEBAR_FONT_SIZE,
    attributeValue: (size) => (size === DEFAULT_FORK_SIDEBAR_FONT_SIZE ? null : String(size)),
    onApply: (size) => {
      const root = document.documentElement;
      if (size === DEFAULT_FORK_SIDEBAR_FONT_SIZE)
        root.style.removeProperty("--fork-sidebar-font-size");
      else root.style.setProperty("--fork-sidebar-font-size", `${size}px`);
    },
  });

export const FORK_TYPOGRAPHY_SCALE_OPTIONS = [
  80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150,
] as const;
export type ForkTypographyScale = (typeof FORK_TYPOGRAPHY_SCALE_OPTIONS)[number];
export const DEFAULT_FORK_TYPOGRAPHY_SCALE: ForkTypographyScale = 100;

export const { initialize: initializeForkChatTextScale, useValue: useForkChatTextScale } =
  createForkRootSetting({
    storageKey: "t3code:fork:chat-text-scale:v1",
    attribute: FORK_CHAT_TEXT_SCALE_ATTRIBUTE,
    schema: Schema.Literals(FORK_TYPOGRAPHY_SCALE_OPTIONS),
    defaultValue: DEFAULT_FORK_TYPOGRAPHY_SCALE,
    attributeValue: (scale) => (scale === DEFAULT_FORK_TYPOGRAPHY_SCALE ? null : String(scale)),
    onApply: (scale) => {
      const root = document.documentElement;
      if (scale === DEFAULT_FORK_TYPOGRAPHY_SCALE)
        root.style.removeProperty("--fork-chat-text-scale");
      else root.style.setProperty("--fork-chat-text-scale", String(scale / 100));
    },
  });

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
