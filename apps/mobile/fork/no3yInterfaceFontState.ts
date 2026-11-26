/**
 * The picked iPhone interface font as app state — see `.fork/customizations.yaml#no3y-mobile-interface-font`.
 */
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { Uniwind } from "uniwind";

import { UNIWIND_THEME_NAMES } from "../src/lib/mobileThemeRuntime";
import { mobilePreferencesAtom } from "../src/state/preferences";
import { no3yInterfaceFontVariables, publishNo3yInterfaceFont } from "./no3yInterfaceFont";

const no3yInterfaceFontAtom = Atom.make((get) => {
  const result = get(mobilePreferencesAtom);
  return (AsyncResult.isSuccess(result) ? result.value.interfaceFont : undefined) ?? "system";
}).pipe(Atom.withLabel("mobile:no3y-interface-font"));

export function useNo3yInterfaceFont() {
  return useAtomValue(no3yInterfaceFontAtom);
}

/** Like the text-scale variables, the font tokens are process-global, so every theme gets them. */
export function installNo3yInterfaceFont(registry: AtomRegistry.AtomRegistry): () => void {
  return registry.subscribe(
    no3yInterfaceFontAtom,
    (font) => {
      publishNo3yInterfaceFont(font);
      const variables = no3yInterfaceFontVariables(font);
      for (const themeName of UNIWIND_THEME_NAMES) {
        Uniwind.updateCSSVariables(themeName, variables);
      }
    },
    { immediate: true },
  );
}
