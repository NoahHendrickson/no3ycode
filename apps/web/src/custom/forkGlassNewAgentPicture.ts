/**
 * Glass new-agent background — see `.fork/customizations.yaml#fork-glass-new-agent-stage`.
 *
 * Glass's own portrait is its stage (theme.custom.glass.css). Any other pick stamps the root
 * attribute below, every rule in that sheet stands down (so popups cut holes as in a started
 * thread), and BasicNewAgentBackdrop draws the pick instead.
 */
import * as Schema from "effect/Schema";

import {
  BASIC_NEW_AGENT_BACKDROPS,
  BASIC_NEW_AGENT_BACKDROP_LABELS,
} from "./basicNewAgentBackdropSetting";
import { createForkRootSetting } from "./forkRootSetting";

/** Stamped on the root while the portrait is off; the stage sheet's rules require its absence. */
export const FORK_GLASS_PICTURE_OFF_ATTRIBUTE = "data-fork-glass-picture";

export const GLASS_NEW_AGENT_BACKDROPS = ["portrait", ...BASIC_NEW_AGENT_BACKDROPS] as const;
export type GlassNewAgentBackdrop = (typeof GLASS_NEW_AGENT_BACKDROPS)[number];
export const DEFAULT_GLASS_NEW_AGENT_BACKDROP: GlassNewAgentBackdrop = "portrait";

export const GLASS_NEW_AGENT_BACKDROP_LABELS: Record<GlassNewAgentBackdrop, string> = {
  portrait: "Glass portrait",
  ...BASIC_NEW_AGENT_BACKDROP_LABELS,
};

export const {
  initialize: initializeForkGlassNewAgentPicture,
  useValue: useGlassNewAgentBackdrop,
  set: setGlassNewAgentBackdrop,
} = createForkRootSetting({
  storageKey: "t3code:fork:glass-new-agent-backdrop:v1",
  attribute: FORK_GLASS_PICTURE_OFF_ATTRIBUTE,
  schema: Schema.Literals(GLASS_NEW_AGENT_BACKDROPS),
  defaultValue: DEFAULT_GLASS_NEW_AGENT_BACKDROP,
  attributeValue: (backdrop) => (backdrop === "portrait" ? null : "off"),
});
