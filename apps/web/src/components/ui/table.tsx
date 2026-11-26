import * as React from "react";

import { cn } from "~/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({
  className,
  /* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
  interactive = true,
  /* fork:end fork-design-primitives */
  ...props
}: React.ComponentProps<"tr"> & {
  /* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
  /** False for rows that only label or report (group headers, empty and error notices). */
  interactive?: boolean;
  /* fork:end fork-design-primitives */
}) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        /* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
        !interactive && "hover:bg-transparent",
        /* fork:end fork-design-primitives */
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

/* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
const forkTableCellToneClassName = {
  default: "",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
} as const;
/* fork:end fork-design-primitives */

function TableCell({
  className,
  /* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
  tone = "default",
  truncate = false,
  /* fork:end fork-design-primitives */
  ...props
}: React.ComponentProps<"td"> & {
  /* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
  tone?: keyof typeof forkTableCellToneClassName;
  truncate?: boolean;
  /* fork:end fork-design-primitives */
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        /* fork:begin fork-design-primitives — see .fork/customizations.yaml#fork-design-primitives */
        truncate && "truncate",
        forkTableCellToneClassName[tone],
        /* fork:end fork-design-primitives */
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
