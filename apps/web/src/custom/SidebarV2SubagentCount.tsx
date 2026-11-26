/**
 * The card's running-subagent mark, in the trailing cell — see
 * `.fork/customizations.yaml#sidebar-v2-card-rows`. Decorative: the row's
 * aria-label overrides its contents, so the row adds the count to that label.
 */
import { StrokeGlyphs } from "./icons/lucide-hugeicons";

export function SidebarV2SubagentCount(props: { readonly count: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center gap-0.5 text-sidebar-caption text-foreground tabular-nums"
    >
      {props.count}
      <StrokeGlyphs.ChatBot className="size-3 shrink-0" />
    </span>
  );
}
