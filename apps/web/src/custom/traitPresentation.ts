/**
 * How the model menu shows a trait, keyed by its descriptor id — see
 * `.fork/customizations.yaml#fork-model-picker`. One table for the icon (beside its checkbox, and
 * on the selected row while on) and any label the provider's own does not suit.
 */
import { BrainIcon, CodeIcon, type LucideIcon, ShieldIcon, ZapIcon } from "lucide-react";

export const TRAIT_PRESENTATION: Readonly<Record<string, { icon: LucideIcon; label?: string }>> = {
  fastMode: { icon: ZapIcon },
  serviceTier: { icon: ZapIcon },
  ultracode: { icon: CodeIcon },
  cyberAccessProgram: { icon: ShieldIcon, label: "Cyber mode" },
  thinking: { icon: BrainIcon },
};
