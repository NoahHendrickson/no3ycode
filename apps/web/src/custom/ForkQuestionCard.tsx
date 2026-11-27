/**
 * The fork Questions card's frame — see `.fork/customizations.yaml#fork-pending-user-input`. The
 * thread's own question (the override's ComposerPendingUserInputPanel) and a Petal's digest cards
 * (fork-bot-digest) fill its slots, so its markup and the theme hooks it carries exist once.
 */
import type { ComponentProps, ReactNode } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { cn } from "~/lib/utils";

export function ForkQuestionCard(props: {
  readonly dir?: ComponentProps<"div">["dir"];
  /** The question box's contents; a long one scrolls in place and unbroken words wrap. */
  readonly question: ReactNode;
  /** Beside the question: a counter, a dismiss button. */
  readonly aside?: ReactNode;
  /** The option rows, under their hint; none draws no options block. */
  readonly options?: ReactNode;
  readonly hint?: string;
  readonly multiSelect?: boolean;
  /** The card's buttons, bottom left; none draws no footer row. */
  readonly actions?: ReactNode;
  /** Drawn last inside the card. */
  readonly footer?: ReactNode;
}) {
  const hasOptions = props.options !== undefined && props.options !== null;
  return (
    <div data-fork-pending-user-input="true" dir={props.dir} className="flex flex-col">
      {/* The question is the card's header, ruled off from its options. */}
      <div data-fork-pending-user-input-question className="flex items-start gap-4 px-4 py-3">
        <div className="flex max-h-40 min-w-0 flex-1 flex-col gap-1 overflow-y-auto text-sm wrap-anywhere">
          {props.question}
        </div>
        {props.aside}
      </div>
      {hasOptions ? (
        <ComposerBanner.Scroll>
          <div className="flex flex-col px-2 pt-2 pb-3 wrap-anywhere">
            {/* The selection hint heads the options it describes, aligned with their labels. */}
            {props.hint === undefined ? null : (
              <p data-fork-question-hint className="px-2 pb-1 text-xs text-muted-foreground">
                {props.hint}
              </p>
            )}
            <div className="flex flex-col gap-1" role={props.multiSelect ? "group" : "radiogroup"}>
              {props.options}
            </div>
          </div>
        </ComposerBanner.Scroll>
      ) : null}
      {props.actions === undefined ? null : (
        <div
          data-fork-pending-user-input-footer
          className={cn("flex items-center justify-start gap-2 px-4 pb-3", !hasOptions && "pt-3")}
        >
          {props.actions}
        </div>
      )}
      {props.footer}
    </div>
  );
}
