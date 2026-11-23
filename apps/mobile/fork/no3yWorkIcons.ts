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

import type { HugeIconData } from "./HugeIcon";

export interface No3yWorkIcon {
  readonly icon: HugeIconData;
  readonly filled: boolean;
}

const stroke = (icon: HugeIconData): No3yWorkIcon => ({ icon, filled: false });
const themed = (icon: HugeIconData): No3yWorkIcon => ({ icon, filled: true });

const BY_SYMBOL: Readonly<Record<string, No3yWorkIcon>> = {
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

/** The Hugeicon for a work row's SF Symbol, or undefined to keep the symbol. */
export function no3yWorkIcon(symbol: string | { readonly ios?: string }): No3yWorkIcon | undefined {
  const name = typeof symbol === "string" ? symbol : symbol.ios;
  return name === undefined ? undefined : BY_SYMBOL[name];
}
