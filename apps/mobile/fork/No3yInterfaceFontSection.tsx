/**
 * Settings → Appearance → Font on the iPhone — see `.fork/customizations.yaml#no3y-mobile-interface-font`.
 */
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { ListChoiceRow } from "../src/components/ui/ListChoiceRow";
import { SettingsSection } from "../src/features/settings/components/SettingsSection";
import { applyNo3yInterfaceFont } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { mobilePreferencesAtom, saveMobilePreferences } from "../src/state/preferences";
import { useAtomCommand } from "../src/state/use-atom-command";
import { NO3Y_INTERFACE_FONT_OPTIONS, useNo3yInterfaceFont } from "./no3yInterfaceFont";

export function No3yInterfaceFontSection() {
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomCommand(saveMobilePreferences);
  const ready = AsyncResult.isSuccess(preferencesResult);
  const selected = useNo3yInterfaceFont();

  return (
    <SettingsSection title="Font">
      {NO3Y_INTERFACE_FONT_OPTIONS.map((option, index) => (
        <ListChoiceRow
          key={option.font}
          label={option.label}
          selected={selected === option.font}
          separated={index > 0}
          disabled={!ready}
          onPress={() => {
            applyNo3yInterfaceFont(option.font);
            void savePreferences({ interfaceFont: option.font });
          }}
        />
      ))}
    </SettingsSection>
  );
}
