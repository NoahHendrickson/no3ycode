/**
 * The parts every card a Petal's digest pages through shares — see
 * `.fork/customizations.yaml#fork-bot-digest`: the banner it draws in, and its bottom (what the
 * card is about, "Show N dismissed", and a dot per card between previous and next).
 */
import type { BotDigestLinks } from "@t3tools/client-runtime/fork-bot-digest-links";
import type { EnvironmentId } from "@t3tools/contracts";
import type { ReactNode } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { ChevronLeftIcon, ChevronRightIcon } from "../icons/lucide-hugeicons";
import { BotDigestLinkRow } from "./BotDigestItem";

/** The banner card a digest card draws in, in the dock above the composer with its other cards.
    Outside the composer's own focus: a tap here never expands the collapsed phone composer. */
export function BotDigestBanner(props: { readonly children: ReactNode }) {
  return (
    <ComposerBanner.Attachment data-fork-composer-aside="true">
      <ComposerBanner.Root data-chat-composer-top-drawer="true" variant="info">
        {props.children}
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

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

/** A card's bottom, besides its own links. */
export type BotDigestBottomProps = BotDigestBottomState & {
  /** What the card is about: the threads and pull requests its link row shows. */
  readonly links: BotDigestLinks;
  readonly environmentId: EnvironmentId;
};

/** Its links, then "Show N dismissed", then the pager; null when there is nothing to show. */
function bottomContents(props: BotDigestBottomProps): ReactNode {
  const { paging, hiddenCount, links } = props;
  const hasLinks = links.threads.length > 0 || links.pullRequests.length > 0;
  if (paging.count < 2 && hiddenCount === 0 && !hasLinks) return null;
  return (
    <>
      <span className="min-w-0 flex-1">
        <BotDigestLinkRow links={links} environmentId={props.environmentId} />
      </span>
      {hiddenCount === 0 ? null : (
        <BotDigestShowDismissed count={hiddenCount} onClick={props.onShowDismissed} />
      )}
      {paging.count < 2 ? null : <BotDigestPager {...paging} />}
    </>
  );
}

/** @public — a Questions card's bottom, ruled off like its question. */
export function BotDigestBottom(props: BotDigestBottomProps) {
  const contents = bottomContents(props);
  return contents === null ? null : (
    <div
      data-fork-bot-digest-pager=""
      className="flex min-h-10 items-center gap-2 py-1.5 ps-4 pe-2.5"
    >
      {contents}
    </div>
  );
}

/** @public — an approval notice's bottom, inline under its actions. */
export function BotDigestBottomInline(props: BotDigestBottomProps) {
  const contents = bottomContents(props);
  return contents === null ? null : (
    <span className="mt-1 flex min-h-7 items-center gap-2">{contents}</span>
  );
}
