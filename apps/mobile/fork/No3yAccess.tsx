/**
 * Access (runtime mode) on the no3y iPhone composer — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The model chip shows the mode's icon; the
 * model sheet's Access menu sets it through the thread settings session, as the full sheet did.
 */
import PenLineIcon from "@hugeicons/core-free-icons/PenLineIcon";
import ShieldCheckIcon from "@hugeicons/core-free-icons/ShieldCheckIcon";
import ShieldOffIcon from "@hugeicons/core-free-icons/ShieldOffIcon";
import SquareLock02Icon from "@hugeicons/core-free-icons/SquareLock02Icon";
import type { RuntimeMode } from "@t3tools/contracts";
import type { ReactNode } from "react";

import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import type { RuntimeModeChoice } from "../src/features/threads/thread-settings-options";
import { HugeIcon, type HugeIconData } from "./HugeIcon";

/**
 * The Mac's access icons (runtimeModeConfig.ts through lucide-hugeicons.tsx) with its weights:
 * the themed ones fill, Full access's crossed shield has no filled weight and stays a stroke.
 */
const ACCESS_ICONS: Readonly<
  Record<RuntimeMode, { readonly icon: HugeIconData; readonly filled: boolean }>
> = {
  "approval-required": { icon: SquareLock02Icon, filled: true },
  "auto-accept-edits": { icon: PenLineIcon, filled: true },
  auto: { icon: ShieldCheckIcon, filled: true },
  "full-access": { icon: ShieldOffIcon, filled: false },
};

/** A runtime mode's icon at the Mac's weight. */
export function No3yAccessIcon(props: {
  readonly mode: RuntimeMode;
  readonly size: number;
  readonly color: string;
}) {
  const access = ACCESS_ICONS[props.mode] ?? ACCESS_ICONS["approval-required"];
  return (
    <HugeIcon icon={access.icon} size={props.size} color={props.color} filled={access.filled} />
  );
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
