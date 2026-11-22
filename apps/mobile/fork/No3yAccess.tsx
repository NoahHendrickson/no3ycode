/**
 * Access (runtime mode) on the no3y iPhone composer — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The model chip shows the mode's shield; the
 * model sheet's Access menu sets it through the thread settings session, as the full sheet did.
 */
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import ShieldCheckIcon from "@hugeicons/core-free-icons/ShieldCheckIcon";
import ShieldEnergyIcon from "@hugeicons/core-free-icons/ShieldEnergyIcon";
import ShieldHalfIcon from "@hugeicons/core-free-icons/ShieldHalfIcon";
import ShieldOffIcon from "@hugeicons/core-free-icons/ShieldOffIcon";
import type { RuntimeMode } from "@t3tools/contracts";
import type { ReactNode } from "react";

import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import type { RuntimeModeChoice } from "../src/features/threads/thread-settings-options";
import type { HugeIconData } from "./HugeIcon";

const ACCESS_ICONS: Readonly<Record<RuntimeMode, HugeIconData>> = {
  "approval-required": ShieldCheckIcon,
  "auto-accept-edits": ShieldHalfIcon,
  auto: ShieldEnergyIcon,
  "full-access": ShieldOffIcon,
};

/** The shield for a runtime mode: checked when supervised, open when it has full access. */
export function no3yAccessIcon(mode: RuntimeMode): HugeIconData {
  return ACCESS_ICONS[mode] ?? Shield01Icon;
}

/** A native menu of the runtime modes around `children`, the trigger. */
export function No3yAccessMenu(props: {
  readonly runtimeMode: RuntimeMode;
  readonly choices: ReadonlyArray<RuntimeModeChoice>;
  readonly onSelect: (mode: RuntimeMode) => void;
  readonly children: ReactNode;
}) {
  return (
    <Menu
      title="Access"
      actions={props.choices.map((choice) => ({
        id: choice.mode,
        title: choice.label,
        subtitle: choice.disabledReason ?? choice.description,
        state: choice.mode === props.runtimeMode ? ("on" as const) : ("off" as const),
        attributes: { disabled: choice.disabledReason !== undefined },
      }))}
      onPressAction={({ nativeEvent }) => {
        const choice = props.choices.find((candidate) => candidate.mode === nativeEvent.event);
        if (!choice) return;
        if (choice.disabledReason) {
          Dialog.alert(choice.label, choice.disabledReason);
          return;
        }
        props.onSelect(choice.mode);
      }}
    >
      {props.children}
    </Menu>
  );
}
