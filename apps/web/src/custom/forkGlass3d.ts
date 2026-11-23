/**
 * Glass 3D setting — see `.fork/customizations.yaml#fork-glass-3d`.
 *
 * Switches Glass between Full 3D (stage card in theme.custom.glass-stage.css
 * plus glints, sheens and halos in theme.custom.glass-surfaces.css) and Flat
 * (`data-fork-glass-3d="off"`).
 */
import * as Schema from "effect/Schema";

import { createForkRootSetting } from "./forkRootSetting";
import { syncForkTopbarHeightFromRoot } from "./forkTopbarHeight";

/** Absent at Full 3D; "off" at Flat. */
export const FORK_GLASS_3D_ATTRIBUTE = "data-fork-glass-3d";

export const FORK_GLASS_3D_MODES = ["full", "off"] as const;
export type ForkGlass3dMode = (typeof FORK_GLASS_3D_MODES)[number];

export const DEFAULT_FORK_GLASS_3D_MODE: ForkGlass3dMode = "full";

export const FORK_GLASS_3D_MODE_LABELS: Record<ForkGlass3dMode, string> = {
  full: "Full 3D",
  off: "Flat",
};

const ForkGlass3dModeSchema = Schema.Literals(FORK_GLASS_3D_MODES);

export const { initialize: initializeForkGlass3d, useValue: useForkGlass3d } =
  createForkRootSetting({
    storageKey: "t3code:fork:glass-3d:v1",
    attribute: FORK_GLASS_3D_ATTRIBUTE,
    schema: ForkGlass3dModeSchema,
    defaultValue: DEFAULT_FORK_GLASS_3D_MODE,
    attributeValue: (mode) => (mode === DEFAULT_FORK_GLASS_3D_MODE ? null : mode),
    onApply: () => syncForkTopbarHeightFromRoot(),
  });
