/**
 * What Basic draws behind a new agent — see `.fork/customizations.yaml#fork-basic-theme`.
 * Device-local, like the palette it belongs to: a contracts field would put a fork key in a
 * schema upstream owns.
 */
import * as Schema from "effect/Schema";

import { useLocalStorage } from "~/hooks/useLocalStorage";

export const BASIC_NEW_AGENT_BACKDROPS = ["texture", "dither"] as const;
export type BasicNewAgentBackdrop = (typeof BASIC_NEW_AGENT_BACKDROPS)[number];
export const DEFAULT_BASIC_NEW_AGENT_BACKDROP: BasicNewAgentBackdrop = "texture";

export const BASIC_NEW_AGENT_BACKDROP_LABELS: Record<BasicNewAgentBackdrop, string> = {
  texture: "Pixel texture",
  dither: "Dither",
};

const BasicNewAgentBackdropSchema = Schema.Literals(BASIC_NEW_AGENT_BACKDROPS);

export function useBasicNewAgentBackdrop() {
  return useLocalStorage(
    "t3code:fork:basic-new-agent-backdrop:v1",
    DEFAULT_BASIC_NEW_AGENT_BACKDROP,
    BasicNewAgentBackdropSchema,
  );
}
