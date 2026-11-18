import { BASIC_TONES, type BasicTone, setForkBasicTone } from "~/custom/forkTheme";
import { setTheme } from "~/hooks/useTheme";

import { type ResolvedColor, readTokenColor } from "./resolveColor.ts";

export type ToneTable = ReadonlyMap<BasicTone, ReadonlyMap<string, ResolvedColor>>;

/**
 * Every tone's value for each property, read by moving the root through the tones and back in one
 * synchronous pass: styles recompute on read, and nothing paints until the pass returns. Frames
 * cannot do this, because they share localStorage and each one's tone write re-themes the rest.
 */
export function sweepTones(
  variables: ReadonlyArray<string>,
  restoreTo: BasicTone,
  scopeAttributes: Readonly<Record<string, string>> = {},
): ToneTable {
  const scope = document.createElement("div");
  for (const [name, value] of Object.entries(scopeAttributes)) scope.setAttribute(name, value);
  document.body.append(scope);
  const table = new Map<BasicTone, Map<string, ResolvedColor>>();
  try {
    for (const tone of BASIC_TONES) {
      setForkBasicTone(tone, setTheme);
      table.set(
        tone,
        new Map(variables.map((variable) => [variable, readTokenColor(scope, variable)])),
      );
    }
  } finally {
    setForkBasicTone(restoreTo, setTheme);
    scope.remove();
  }
  return table;
}
