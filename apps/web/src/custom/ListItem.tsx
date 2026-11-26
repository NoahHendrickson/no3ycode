import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { menuRowClassName, menuRowToneClassName } from "~/components/ui/menu";
import { cn } from "~/lib/utils";

/** A row in a list that is always on screen (the new agent launchpad, a panel's list), drawn as a
    menu row from MenuItem's own class string, with hover and keyboard focus standing in for the
    menu's highlight. Themes style it with the menu rows. */
export function ListItem({
  tone = "default",
  className,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> & {
  readonly tone?: keyof typeof menuRowToneClassName;
  readonly className?: string;
}) {
  return (
    <ButtonPrimitive
      data-slot="list-item"
      className={cn(
        menuRowClassName,
        "w-full min-w-0 text-left hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
        menuRowToneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}
