/**
 * The selected provider's session quota as a small circular meter at the far
 * right of the composer's control row, plus an upward-opening single-line
 * vessel strip above the prompt input showing inline `5hr` / `7d` quota bars
 * per provider — see `.fork/customizations.yaml#fork-composer-usage-limits`.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import {
  collectLimitAccounts,
  collectLimitPools,
  cursorUsageWindowDetails,
  displayLimitWindows,
  formatResetsIn,
  type LimitPool,
  type LimitPoolWindow,
  remainingPercent,
} from "@t3tools/shared/usageLimits";
import { Fragment, memo, type CSSProperties } from "react";

import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";
import { providerClients } from "~/components/settings/providerDriverMeta";
import { Collapsible, CollapsiblePanel } from "~/components/ui/collapsible";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { environmentPresentations } from "~/state/presentation";
import { XIcon } from "./icons/lucide-hugeicons";
import { ForkProviderMark, hasForkProviderMark } from "./icons/ModelPickerProviderGlyph";
import { UsageCircleMeter, UsageMeter } from "./UsageMeter";

const MARK_SIZE_STYLE = { "--fork-mark-size": "14px" } as CSSProperties;

export const ComposerUsageLimitsReadout = memo(function ComposerUsageLimitsReadout(props: {
  readonly usageLimits: ServerProviderUsageLimits | undefined;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const session = props.usageLimits?.windows.find((window) => window.kind === "session");
  if (!session) return null;
  const remaining = remainingPercent(session);
  return (
    <button
      type="button"
      data-fork-composer-usage-limits="true"
      aria-expanded={props.open}
      data-pressed={props.open ? "" : undefined}
      aria-label={`${session.label} limit: ${remaining}% left. ${props.open ? "Hide" : "Show"} usage limits`}
      className="flex shrink-0 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={props.onToggle}
    >
      <UsageCircleMeter remaining={remaining} />
    </button>
  );
});

/** Smoothly expanding single-line vessel strip anchored above the composer (grows upward, zero shift). */
export const ComposerUsageLimitsDrawer = memo(function ComposerUsageLimitsDrawer(props: {
  readonly open: boolean;
  readonly openedAt: number;
  readonly onClose: () => void;
}) {
  return (
    <Collapsible open={props.open}>
      <CollapsiblePanel
        data-fork-composer-usage-drawer="true"
        className="pointer-events-auto"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        <ComposerLimitsTray now={props.openedAt} onClose={props.onClose} />
      </CollapsiblePanel>
    </Collapsible>
  );
});

/** Full descriptive label for hover tooltips. */
function fullWindowLabel(pool: LimitPool, window: LimitPoolWindow): string {
  const details = pool.driver === "cursor" ? cursorUsageWindowDetails(window.id, pool) : undefined;
  return (details?.label ?? window.label).replaceAll(" · ", " ");
}

/** Ultra-compact inline label (`5hr`, `7d`) for the single-line usage strip. */
function shortWindowLabel(pool: LimitPool, window: LimitPoolWindow): string {
  const full = fullWindowLabel(pool, window);
  if (full === "Session" || full === "5-hour") return "5hr";
  if (full === "Weekly") return "7d";
  return full.replace(/\b5-hour\b/giu, "5hr").replace(/\bWeekly\b/giu, "7d");
}

/** Windows shown in the compact composer strip (omits Claude's Fable weekly breakdown). */
function compactTrayWindows(pool: LimitPool): readonly LimitPoolWindow[] {
  const windows = displayLimitWindows(pool);
  if (pool.driver !== "claudeAgent") return windows;
  return windows.filter(
    (window) => window.id !== "seven_day_fable" && !window.label.toLowerCase().includes("fable"),
  );
}

/** Mounted only while the strip is open, so the composer never subscribes to every environment's providers. */
function ComposerLimitsTray(props: { readonly now: number; readonly onClose: () => void }) {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const pools = collectLimitPools(collectLimitAccounts(presentations), props.now);

  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-2">
      {pools.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          No provider reports subscription limits.
        </span>
      ) : (
        <TooltipProvider delay={120} closeDelay={0}>
          <div
            data-fork-usage-scroller=""
            className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {pools.map((pool, index) => (
              <Fragment key={pool.driver}>
                {index > 0 ? <span aria-hidden className="h-3.5 w-px shrink-0 bg-border" /> : null}
                <CompactProviderStrip pool={pool} now={props.now} />
              </Fragment>
            ))}
          </div>
        </TooltipProvider>
      )}
      <button
        type="button"
        aria-label="Close usage limits"
        className="ml-auto inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={props.onClose}
      >
        <XIcon className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function CompactProviderStrip(props: { readonly pool: LimitPool; readonly now: number }) {
  const { pool, now } = props;
  const providerLabel = providerClients.get(pool.driver)?.label ?? String(pool.driver);
  const windows = compactTrayWindows(pool);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              aria-label={providerLabel}
              className={
                pool.driver === "claudeAgent"
                  ? "inline-flex size-4 shrink-0 translate-y-px items-center justify-center"
                  : "inline-flex size-4 shrink-0 items-center justify-center"
              }
              style={MARK_SIZE_STYLE}
            >
              {hasForkProviderMark(pool.driver) ? (
                <ForkProviderMark driver={pool.driver} />
              ) : (
                <ProviderInstanceIcon
                  driverKind={pool.driver}
                  displayName={providerLabel}
                  indicatorBackground="var(--card)"
                  className="size-4 shrink-0"
                  iconClassName="size-3.5 text-foreground/85"
                />
              )}
            </span>
          }
        />
        <TooltipPopup side="top">{providerLabel}</TooltipPopup>
      </Tooltip>
      <div className="flex shrink-0 items-center gap-2">
        {windows.map((window) => {
          const rowLabel = shortWindowLabel(pool, window);
          const nextRefill = window.resets.find((reset) => reset.restoresPercent > 0);
          const nextReset = nextRefill ?? window.resets[0];
          const resetsIn = nextReset ? formatResetsIn(nextReset.member.window, now) : null;
          return (
            <Tooltip key={`${window.kind}:${window.id}`}>
              <TooltipTrigger
                render={
                  <div className="flex shrink-0 items-center gap-1.5 text-[11px] leading-4">
                    <span className="whitespace-nowrap font-medium text-muted-foreground">
                      {rowLabel}
                    </span>
                    <UsageMeter
                      remaining={window.remainingPercent}
                      radiusClassName="rounded-[3px]"
                      fillClassName="rounded-none"
                      className="h-2.5 w-7 shrink-0 border border-border"
                    />
                  </div>
                }
              />
              <TooltipPopup side="top">
                {window.remainingPercent}%{resetsIn ? ` · ${resetsIn}` : ""}
              </TooltipPopup>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
