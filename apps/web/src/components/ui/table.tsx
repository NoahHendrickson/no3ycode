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
  /* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
  interactive = true,
  /* fork:end fork-design-table-alert-variants */
  ...props
}: React.ComponentProps<"tr"> & {
  /* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
  /** False for rows that only label or report (group headers, empty and error notices). */
  interactive?: boolean;
  /* fork:end fork-design-table-alert-variants */
}) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        /* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
        !interactive && "hover:bg-transparent",
        /* fork:end fork-design-table-alert-variants */
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

/* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
const forkTableCellToneClassName = {
  default: "",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
} as const;
/* fork:end fork-design-table-alert-variants */

function TableCell({
  className,
  /* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
  tone = "default",
  truncate = false,
  /* fork:end fork-design-table-alert-variants */
  ...props
}: React.ComponentProps<"td"> & {
  /* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
  tone?: keyof typeof forkTableCellToneClassName;
  truncate?: boolean;
  /* fork:end fork-design-table-alert-variants */
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        /* fork:begin fork-design-table-alert-variants — see .fork/customizations.yaml#fork-design-table-alert-variants */
        truncate && "truncate",
        forkTableCellToneClassName[tone],
        /* fork:end fork-design-table-alert-variants */
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
