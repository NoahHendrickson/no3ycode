import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { cn } from "~/lib/utils";

const TONE = { default: "text-foreground", muted: "text-muted-foreground" } as const;

/** A row in a list that is always on screen (the new agent launchpad, a panel's list), drawn as a
    menu row: MenuItem's height, padding, type, icon treatment and row corner token, with hover
    and keyboard focus standing in for the menu's highlight. Themes style it with the menu rows. */
export function ListItem({
  tone = "default",
  className,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> & {
  readonly tone?: keyof typeof TONE;
  readonly className?: string;
}) {
  return (
    <ButtonPrimitive
      data-slot="list-item"
      className={cn(
        "[&>svg]:-mx-0.5 flex min-h-8 w-full min-w-0 cursor-pointer select-none items-center gap-2 rounded-(--fork-menu-row-radius,var(--radius-sm)) px-2 py-1 text-left text-base outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg:not([class*='text-'])]:text-muted-foreground [&>svg]:pointer-events-none [&>svg]:shrink-0",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
