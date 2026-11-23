/**
 * The selected provider's session quota as a ring in the composer's control row, opening every
 * provider's limits as a menu, and the composer's top drawer for background work — see
 * `.fork/customizations.yaml#fork-composer-usage-limits`.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";
import { memo, type ReactNode, useState } from "react";

import { UsageLimitsPooled } from "~/components/usage/UsageLimitsPooled";
import { Collapsible, CollapsiblePanel } from "~/components/ui/collapsible";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { environmentPresentations } from "~/state/presentation";
import type { ComposerDrawerSection } from "./ComposerBackgroundWork";
import { UsageCircleMeter } from "./UsageMeter";

/** The composer's usage ring, and its top drawer holding the background-work section (owned by ChatView). */
export function composerUsageDrawer(props: {
  readonly usageLimits: ServerProviderUsageLimits | undefined;
  readonly enabled: boolean;
  readonly backgroundWork: ComposerDrawerSection | null;
}) {
  const work = props.backgroundWork;
  return {
    readout: props.enabled ? <ComposerUsageLimitsReadout usageLimits={props.usageLimits} /> : null,
    drawer:
      work !== null ? (
        <ComposerUsageLimitsDrawer open={work.open} onClose={() => work.onCollapse(true)}>
          {work.content}
        </ComposerUsageLimitsDrawer>
      ) : null,
  };
}

const ComposerUsageLimitsReadout = memo(function ComposerUsageLimitsReadout(props: {
  readonly usageLimits: ServerProviderUsageLimits | undefined;
}) {
  // The menu's clock advances on open rather than ticking while it shows.
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const session = props.usageLimits?.windows.find((window) => window.kind === "session");
  if (!session) return null;
  const remaining = remainingPercent(session);
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setOpenedAt(Date.now());
      }}
    >
      <PopoverTrigger
        data-fork-composer-usage-limits="true"
        // Inlet hangs the menu from this button (theme.custom.inlet-menus.css).
        data-fork-tab-trigger=""
        aria-label={`${session.label} limit: ${remaining}% left. Show usage limits`}
        className="flex shrink-0 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <UsageCircleMeter remaining={remaining} />
      </PopoverTrigger>
      <PopoverPopup
        side="top"
        align="end"
        sideOffset={8}
        width="sm"
        padding="none"
        data-fork-tab-menu="composer"
      >
        <ComposerLimitsMenu now={openedAt} />
      </PopoverPopup>
    </Popover>
  );
});

/** Mounted only while the menu is open, so the composer never subscribes to every environment's providers. */
function ComposerLimitsMenu(props: { readonly now: number }) {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  return (
    <div
      data-fork-usage-scroller=""
      className="max-h-[min(28rem,calc(var(--available-height)-1rem))] overflow-y-auto py-1"
    >
      <UsageLimitsPooled presentations={presentations} now={props.now} compact />
    </div>
  );
}

/** The strip anchored above the composer (zero shift). It slides up out of the
    vessel's top edge, clipped there, on translate alone: a height tween relaid it out every frame.
    The Liquid Glass draft's native card follows the slide (forkDraftLiquidGlass). @public —
    Storybook fills it with the background-work view. */
export const ComposerUsageLimitsDrawer = memo(function ComposerUsageLimitsDrawer(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Collapsible open={props.open} className="overflow-hidden">
      <CollapsiblePanel
        animate={false}
        data-fork-composer-usage-drawer="true"
        className="pointer-events-auto transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-ending-style:translate-y-full data-ending-style:duration-150 data-ending-style:ease-in data-starting-style:translate-y-full motion-reduce:transition-none"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        {props.children}
      </CollapsiblePanel>
    </Collapsible>
  );
});
