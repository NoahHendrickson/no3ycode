import { BASIC_APPEARANCES, type BasicAppearance } from "~/custom/forkTheme";
import { setAppearanceMode } from "~/hooks/useTheme";

import { type ResolvedColor, readTokenColor } from "./resolveColor.ts";

export type ToneTable = ReadonlyMap<BasicAppearance, ReadonlyMap<string, ResolvedColor>>;

/**
 * Every tone's value for each property, read by moving the root through Basic's appearances and
 * back in one synchronous pass: styles recompute on read, and nothing paints until the pass
 * returns. Frames cannot do this, because they share localStorage and each one's mode write
 * re-themes the rest.
 */
export function sweepTones(
  variables: ReadonlyArray<string>,
  restoreTo: BasicAppearance,
  scopeAttributes: Readonly<Record<string, string>> = {},
): ToneTable {
  const scope = document.createElement("div");
  for (const [name, value] of Object.entries(scopeAttributes)) scope.setAttribute(name, value);
  document.body.append(scope);
  const table = new Map<BasicAppearance, Map<string, ResolvedColor>>();
  try {
    for (const appearance of BASIC_APPEARANCES) {
      setAppearanceMode(appearance);
      table.set(
        appearance,
        new Map(variables.map((variable) => [variable, readTokenColor(scope, variable)])),
      );
    }
  } finally {
    setAppearanceMode(restoreTo);
    scope.remove();
  }
  return table;
}
