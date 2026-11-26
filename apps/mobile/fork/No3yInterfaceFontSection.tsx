/**
 * Settings → Appearance → Font on the iPhone — see `.fork/customizations.yaml#no3y-mobile-interface-font`.
 */
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { ListChoiceRow } from "../src/components/ui/ListChoiceRow";
import { SettingsSection } from "../src/features/settings/components/SettingsSection";
import { mobilePreferencesAtom, saveMobilePreferences } from "../src/state/preferences";
import { useAtomCommand } from "../src/state/use-atom-command";
import { NO3Y_INTERFACE_FONT_OPTIONS } from "./no3yInterfaceFont";
import { useNo3yInterfaceFont } from "./no3yInterfaceFontState";

export function No3yInterfaceFontSection() {
  const ready = AsyncResult.isSuccess(useAtomValue(mobilePreferencesAtom));
  const savePreferences = useAtomCommand(saveMobilePreferences);
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
          onPress={() => void savePreferences({ interfaceFont: option.font })}
        />
      ))}
    </SettingsSection>
  );
}
