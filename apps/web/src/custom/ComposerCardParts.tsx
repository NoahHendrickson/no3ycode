import { Trash2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { Button } from "~/components/ui/button";

/** A composer card's header label (the queue card, the stash): the name, its count beside it. */
export function ComposerCardTitle(props: { readonly children: ReactNode; readonly count: number }) {
  return (
    <ComposerBanner.Content className="text-sm/5 font-medium text-muted-foreground">
      {props.children}
      <span className="font-normal text-muted-foreground/70 tabular-nums">{` ${props.count}`}</span>
    </ComposerBanner.Content>
  );
}

/** A composer card row's remove action: a muted trash icon button. */
export function ComposerCardRemoveButton({ children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button size="icon-xs" variant="ghost-muted" {...props}>
      {children ?? <Trash2Icon weight="stroke" />}
    </Button>
  );
}
