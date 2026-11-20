/**
 * What Inlet draws behind a new agent — see `.fork/customizations.yaml#fork-inlet-black-texture`.
 * One pick per Inlet colour, so switching colour brings back that colour's own; Black starts on
 * the texture it always had and Cream on nothing. Device-local, like the colour it belongs to.
 */
import * as Schema from "effect/Schema";

import { useLocalStorage } from "~/hooks/useLocalStorage";

import {
  BASIC_NEW_AGENT_BACKDROPS,
  BASIC_NEW_AGENT_BACKDROP_LABELS,
} from "./basicNewAgentBackdropSetting";
import type { InletColor } from "./forkTheme";

export const INLET_NEW_AGENT_BACKDROPS = ["none", ...BASIC_NEW_AGENT_BACKDROPS] as const;
export type InletNewAgentBackdrop = (typeof INLET_NEW_AGENT_BACKDROPS)[number];

export const DEFAULT_INLET_NEW_AGENT_BACKDROPS: Record<InletColor, InletNewAgentBackdrop> = {
  black: "texture",
  cream: "none",
};

export const INLET_NEW_AGENT_BACKDROP_LABELS: Record<InletNewAgentBackdrop, string> = {
  none: "None",
  ...BASIC_NEW_AGENT_BACKDROP_LABELS,
};

const InletNewAgentBackdropSchema = Schema.Literals(INLET_NEW_AGENT_BACKDROPS);

export function useInletNewAgentBackdrop(color: InletColor) {
  return useLocalStorage(
    `t3code:fork:inlet-new-agent-backdrop:${color}:v1`,
    DEFAULT_INLET_NEW_AGENT_BACKDROPS[color],
    InletNewAgentBackdropSchema,
  );
}
