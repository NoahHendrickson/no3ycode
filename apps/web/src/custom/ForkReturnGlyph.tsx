/**
 * The return arrow the fork's send button carries in place of upstream's up
 * arrow — see `.fork/customizations.yaml#fork-composer-shell`. Uses Hugeicons'
 * `CornerDownLeftIcon` bumped to a thicker stroke so it reads crisply inside
 * the 24px send square. Shared by the open composer's send and the collapsed
 * phone row's.
 */
import { CornerDownLeftIcon } from "./icons/lucide-hugeicons";

export function ForkReturnGlyph() {
  return <CornerDownLeftIcon className="size-3.5" strokeWidth={2.4} aria-hidden="true" />;
}
