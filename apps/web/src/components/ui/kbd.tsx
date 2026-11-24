import type * as React from "react";

import { cn } from "~/lib/utils";

/* fork:begin fork-design-row-variants — see .fork/customizations.yaml#fork-design-row-variants */
const forkKbdSizeClassName = { default: "", xs: "rounded-sm px-1.5 text-[0.625rem]" } as const;
/* fork:end fork-design-row-variants */

function Kbd({
  className,
  variant = "default",
  /* fork:begin fork-design-row-variants — see .fork/customizations.yaml#fork-design-row-variants */
  size = "default",
  reveal,
  /* fork:end fork-design-row-variants */
  ...props
}: React.ComponentProps<"kbd"> & {
  /* fork:begin fork-design-row-variants — see .fork/customizations.yaml#fork-design-row-variants */
  /** `outline` draws a physical key, so the hint stays distinct inside surrounding text.
      `faint` is a lighter fill for hints inside a dense menu row. */
  variant?: "default" | "outline" | "faint";
  size?: keyof typeof forkKbdSizeClassName;
  /** Hidden until its `group` row is hovered or highlighted. */
  reveal?: "row";
  /* fork:end fork-design-row-variants */
}) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded px-1 font-medium font-sans text-muted-foreground text-xs [&_svg:not([class*='size-'])]:size-3",
        variant === "outline"
          ? "border border-b-2 border-foreground/15 px-1.5"
          : "bg-foreground/[0.07]",
        /* fork:begin fork-design-row-variants — see .fork/customizations.yaml#fork-design-row-variants */
        variant === "faint" && "bg-foreground/4",
        forkKbdSizeClassName[size],
        reveal === "row" &&
          "opacity-0 transition-opacity group-hover:opacity-100 group-data-highlighted:opacity-100",
        /* fork:end fork-design-row-variants */
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
