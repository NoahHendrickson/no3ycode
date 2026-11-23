/**
 * The Petals view menu's List / Grid choice — see `.fork/customizations.yaml#fork-bots`. Each
 * option draws its layout in miniature, so the choice reads before it is made.
 */
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import * as Schema from "effect/Schema";
import type { ComponentType } from "react";

import { cn } from "~/lib/utils";

export const PetalLayout = Schema.Literals(["list", "grid"]);
export type PetalLayout = typeof PetalLayout.Type;
const isPetalLayout = Schema.is(PetalLayout);

/** A mascot tile beside a name line, three times: the list. */
function ListSketch() {
  return (
    <svg aria-hidden width={64} height={40} viewBox="0 0 64 40" className="text-current">
      {[5, 16, 27].map((y) => (
        <g key={y}>
          <rect x={8} y={y} width={8} height={8} rx={2} fill="currentColor" opacity={0.5} />
          <rect x={20} y={y + 2} width={34} height={4} rx={2} fill="currentColor" opacity={0.28} />
        </g>
      ))}
    </svg>
  );
}

/** Mascot tiles over their names, three across and two down: the grid. */
function GridSketch() {
  return (
    <svg aria-hidden width={64} height={40} viewBox="0 0 64 40" className="text-current">
      {[4, 22].flatMap((y) =>
        [10, 27, 44].map((x) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width={10} height={10} rx={2.5} fill="currentColor" opacity={0.5} />
            <rect
              x={x + 1}
              y={y + 12}
              width={8}
              height={2}
              rx={1}
              fill="currentColor"
              opacity={0.28}
            />
          </g>
        )),
      )}
    </svg>
  );
}

const OPTIONS = [
  { value: "list", label: "List", Sketch: ListSketch },
  { value: "grid", label: "Grid", Sketch: GridSketch },
] as const satisfies ReadonlyArray<{ value: PetalLayout; label: string; Sketch: ComponentType }>;

export function PetalLayoutPicker(props: {
  readonly layout: PetalLayout;
  readonly onLayoutChange: (layout: PetalLayout) => void;
}) {
  return (
    <MenuPrimitive.RadioGroup
      value={props.layout}
      onValueChange={(value) => {
        if (isPetalLayout(value)) props.onLayoutChange(value);
      }}
      aria-label="Petal layout"
      className="grid grid-cols-2 gap-1.5 p-1.5"
    >
      {OPTIONS.map((option) => {
        const selected = props.layout === option.value;
        return (
          <MenuPrimitive.RadioItem
            key={option.value}
            value={option.value}
            closeOnClick={false}
            data-testid={`sidebar-v2-petal-layout-${option.value}`}
            className={cn(
              // The menu rows' hover (theme.custom.css): an 8% wash, not the palette's opaque accent.
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-1 pt-2 pb-1.5 text-xs font-medium outline-none select-none data-highlighted:bg-foreground/8",
              selected
                ? "border-primary text-foreground"
                : "border-border text-muted-foreground data-highlighted:text-foreground",
            )}
          >
            <option.Sketch />
            {option.label}
          </MenuPrimitive.RadioItem>
        );
      })}
    </MenuPrimitive.RadioGroup>
  );
}
