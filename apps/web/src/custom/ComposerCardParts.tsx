import { Trash2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** A composer card's header label (the queue card, the stash): the name, its count beside it. */
export function ComposerCardTitle(props: { readonly children: ReactNode; readonly count: number }) {
  return (
    <ComposerBanner.Content className="text-sm/5 font-medium text-muted-foreground">
      {props.children}
      <span className="font-normal text-muted-foreground/70 tabular-nums">{` ${props.count}`}</span>
    </ComposerBanner.Content>
  );
}

/** A composer card row's icon action: a 28px muted ghost with the sidebar's hover tint. */
export function ComposerCardIconButton({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      variant="ghost-muted"
      size="icon-sm"
      // The card's --accent is the composer's faint control hover, which barely reads on Flat Glass.
      className={cn("[:hover,[data-pressed]]:bg-foreground/10", className)}
      {...props}
    />
  );
}

/** A composer card row's remove action: a muted trash icon button. */
export function ComposerCardRemoveButton({
  children,
  ...props
}: ComponentProps<typeof ComposerCardIconButton>) {
  return (
    <ComposerCardIconButton {...props}>
      {children ?? <Trash2Icon weight="stroke" />}
    </ComposerCardIconButton>
  );
}
