/**
 * Sidebar font size and chat stream size — see `.fork/customizations.yaml#fork-typography-settings`.
 *
 * Device-local, like the fork's other appearance settings: a contracts field would put a fork
 * key in a schema upstream owns.
 */
import * as Schema from "effect/Schema";

import { createForkRootSetting } from "./forkRootSetting";

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
    schema: ForkSidebarFontSizeSchema,
    defaultValue: DEFAULT_FORK_SIDEBAR_FONT_SIZE,
    cssVariable: "--fork-sidebar-font-size",
    cssValue: (size) => (size === DEFAULT_FORK_SIDEBAR_FONT_SIZE ? null : `${size}px`),
  });

export const FORK_TYPOGRAPHY_SCALE_OPTIONS = [
  80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150,
] as const;
export type ForkTypographyScale = (typeof FORK_TYPOGRAPHY_SCALE_OPTIONS)[number];
export const DEFAULT_FORK_TYPOGRAPHY_SCALE: ForkTypographyScale = 100;

export const { initialize: initializeForkChatTextScale, useValue: useForkChatTextScale } =
  createForkRootSetting({
    storageKey: "t3code:fork:chat-text-scale:v1",
    schema: Schema.Literals(FORK_TYPOGRAPHY_SCALE_OPTIONS),
    defaultValue: DEFAULT_FORK_TYPOGRAPHY_SCALE,
    cssVariable: "--fork-chat-text-scale",
    cssValue: (scale) => (scale === DEFAULT_FORK_TYPOGRAPHY_SCALE ? null : String(scale / 100)),
  });

/** The family theme.custom.css puts first in --fork-font-sans, which an empty preference renders. */
export const FORK_DEFAULT_SANS_FAMILY = "Cinnabar Sans";

/** Interface font presets. Empty is the fork default, Cinnabar Sans; Geist stays one click away. */
export const FORK_INTERFACE_FONT_PRESETS = [
  { label: FORK_DEFAULT_SANS_FAMILY, value: "" },
  { label: "Geist", value: "Geist Variable" },
  { label: "Inter", value: "Inter Variable" },
  { label: "System", value: "BlinkMacSystemFont, Segoe UI, system-ui" },
] as const;

export function forkInterfaceFontPreset(value: string) {
  const trimmed = value.trim();
  return FORK_INTERFACE_FONT_PRESETS.find((preset) => preset.value === trimmed) ?? null;
}
