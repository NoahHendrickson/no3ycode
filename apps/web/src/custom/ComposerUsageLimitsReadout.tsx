/**
 * The selected provider's session quota as a ring in the composer's control row, opening every
 * provider's limits as a menu — see `.fork/customizations.yaml#fork-composer-usage-limits`.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";
import { useGT } from "gt-react";
import { memo, useState } from "react";

import { UsageLimitsPooled } from "~/components/usage/UsageLimitsPooled";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { environmentPresentations } from "~/state/presentation";
import { UsageCircleMeter } from "./UsageMeter";

/** The composer's usage ring, or nothing while the footer is compact. */
export function composerUsageReadout(props: {
  readonly usageLimits: ServerProviderUsageLimits | undefined;
  readonly enabled: boolean;
}) {
  return props.enabled ? <ComposerUsageLimitsReadout usageLimits={props.usageLimits} /> : null;
}

const ComposerUsageLimitsReadout = memo(function ComposerUsageLimitsReadout(props: {
  readonly usageLimits: ServerProviderUsageLimits | undefined;
}) {
  const gt = useGT();
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
        aria-label={gt("Usage limits")}
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
