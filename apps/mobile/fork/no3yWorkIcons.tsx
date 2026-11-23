/**
 * The no3y transcript's work-row icons are the desktop's Hugeicons — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Keyed by the SF Symbol upstream picks, with
 * the glyph and fill the web fork's lucide-hugeicons.tsx draws (its "themed" glyphs fill).
 */
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import BotIcon from "@hugeicons/core-free-icons/BotIcon";
import BrainIcon from "@hugeicons/core-free-icons/BrainIcon";
import CheckIcon from "@hugeicons/core-free-icons/CheckIcon";
import EyeIcon from "@hugeicons/core-free-icons/EyeIcon";
import GlobeIcon from "@hugeicons/core-free-icons/GlobeIcon";
import HammerIcon from "@hugeicons/core-free-icons/HammerIcon";
import MessageCircleIcon from "@hugeicons/core-free-icons/MessageCircleIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import SmartphoneIcon from "@hugeicons/core-free-icons/SmartphoneIcon";
import SourceCodeIcon from "@hugeicons/core-free-icons/SourceCodeIcon";
import SquareLock02Icon from "@hugeicons/core-free-icons/SquareLock02Icon";
import SquarePenIcon from "@hugeicons/core-free-icons/SquarePenIcon";
import TerminalIcon from "@hugeicons/core-free-icons/TerminalIcon";
import Wrench01Icon from "@hugeicons/core-free-icons/Wrench01Icon";
import XIcon from "@hugeicons/core-free-icons/XIcon";
import ZapIcon from "@hugeicons/core-free-icons/ZapIcon";

import type { ColorValue } from "react-native";
import { useResolveClassNames } from "uniwind";

import type { AppSymbolName } from "../src/components/ui/AppSymbol";
import { HugeIcon, type HugeIconData } from "./HugeIcon";

export interface No3yWorkIcon {
  readonly icon: HugeIconData;
  readonly filled: boolean;
}

const stroke = (icon: HugeIconData): No3yWorkIcon => ({ icon, filled: false });
const themed = (icon: HugeIconData): No3yWorkIcon => ({ icon, filled: true });

/** Upstream's work-row icon names: an SF Symbol, or one of the work log's own kinds. */
type WorkRowIconName =
  | AppSymbolName
  | "browser"
  | "computer"
  | "device"
  | "t3-code"
  | "pull-request";

const BY_SYMBOL: Readonly<Record<string, No3yWorkIcon>> = {
  browser: themed(GlobeIcon),
  device: themed(SmartphoneIcon),
  terminal: stroke(TerminalIcon),
  eye: themed(EyeIcon),
  "square.and.pencil": themed(SquarePenIcon),
  globe: themed(GlobeIcon),
  magnifyingglass: themed(Search01Icon),
  brain: stroke(BrainIcon),
  wrench: themed(Wrench01Icon),
  hammer: themed(HammerIcon),
  robot: themed(BotIcon),
  bolt: themed(ZapIcon),
  lock: themed(SquareLock02Icon),
  "bubble.left": themed(MessageCircleIcon),
  checkmark: stroke(CheckIcon),
  "exclamationmark.triangle": themed(AlertCircleIcon),
  "chevron.left.forwardslash.chevron.right": stroke(SourceCodeIcon),
  iphone: themed(SmartphoneIcon),
  xmark: stroke(XIcon),
};

/** The Hugeicon for a work row's icon, or undefined to keep upstream's. */
export function no3yWorkIcon(icon: WorkRowIconName): No3yWorkIcon | undefined {
  return BY_SYMBOL[typeof icon === "string" ? icon : icon.ios];
}

/** Draws a mapped work-row icon; only the no3y layout mounts it, so only it resolves tint classes. */
export function No3yWorkLogIcon(props: {
  readonly icon: No3yWorkIcon;
  readonly color: ColorValue;
  readonly colorClassName?: string;
}) {
  const classColor = useResolveClassNames(props.colorClassName ?? "").accentColor;
  return (
    <HugeIcon
      icon={props.icon.icon}
      filled={props.icon.filled}
      size={16}
      color={props.colorClassName === undefined ? props.color : (classColor ?? props.color)}
    />
  );
}
