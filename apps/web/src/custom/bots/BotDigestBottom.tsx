/**
 * The bottom of every card a Petal's digest pages through — see
 * `.fork/customizations.yaml#fork-bot-digest`: what the card is about, "Show N dismissed", and a
 * dot per card between previous and next.
 */
import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { ChevronLeftIcon, ChevronRightIcon } from "../icons/lucide-hugeicons";

/** Where the card on show sits among everything the Petal has for the owner. */
export interface BotDigestPaging {
  readonly at: number;
  readonly count: number;
  readonly onPage: (index: number) => void;
}

/** What every card's bottom carries besides its own links. */
export interface BotDigestBottomState {
  readonly paging: BotDigestPaging;
  readonly hiddenCount: number;
  readonly onShowDismissed: () => void;
}

/** @public — "Show N dismissed", on a card's bottom or the status line. */
export function BotDigestShowDismissed(props: {
  readonly count: number;
  readonly onClick: () => void;
}) {
  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={props.onClick}
      data-testid="bot-digest-show-dismissed"
    >
      Show {props.count} dismissed
    </Button>
  );
}

/** Previous, a dot per card (the one on show a dash, each opening its card), next. */
function BotDigestPager(props: BotDigestPaging) {
  const { at, count, onPage } = props;
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Previous"
        disabled={at === 0}
        onClick={() => onPage(at - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="flex items-center gap-1.5 px-0.5">
        {Array.from({ length: count }, (_, index) => (
          <button
            type="button"
            key={index}
            aria-label={`${index + 1} of ${count}`}
            aria-current={index === at ? "true" : undefined}
            onClick={() => onPage(index)}
            className={cn(
              "h-1.5 cursor-pointer rounded-full transition-[width,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              index === at
                ? "w-4 bg-foreground"
                : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
            )}
          />
        ))}
      </span>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Next"
        disabled={at === count - 1}
        onClick={() => onPage(at + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </span>
  );
}

/** @public — a card's bottom: its links, then "Show N dismissed", then the pager. Ruled off like
    the question on a Questions card; inline under an approval notice's actions. Nothing draws
    when there is nothing to show. */
export function BotDigestBottom(
  props: BotDigestBottomState & {
    readonly links: ReactNode;
    readonly hasLinks: boolean;
    readonly ruled: boolean;
  },
) {
  const { paging, hiddenCount } = props;
  if (paging.count < 2 && hiddenCount === 0 && !props.hasLinks) return null;
  const contents = (
    <>
      <span className="min-w-0 flex-1">{props.links}</span>
      {hiddenCount === 0 ? null : (
        <BotDigestShowDismissed count={hiddenCount} onClick={props.onShowDismissed} />
      )}
      {paging.count < 2 ? null : <BotDigestPager {...paging} />}
    </>
  );
  return props.ruled ? (
    <div
      data-fork-bot-digest-pager=""
      className="flex min-h-10 items-center gap-2 py-1.5 ps-4 pe-2.5"
    >
      {contents}
    </div>
  ) : (
    <span className="mt-1 flex min-h-7 items-center gap-2">{contents}</span>
  );
}
