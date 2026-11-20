/**
 * Circular quota ring trigger + upward-opening inline usage tray above the
 * composer — see `.fork/customizations.yaml#fork-composer-usage-limits`.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import {
  collectExternalUsageLinks,
  collectLimitAccounts,
  collectLimitPools,
  cursorUsageWindowDetails,
  displayLimitWindows,
  formatResetsIn,
  type LimitPool,
  type LimitPoolWindow,
  remainingPercent,
} from "@t3tools/shared/usageLimits";
import { AlertTriangleIcon, ExternalLinkIcon } from "lucide-react";
import { Fragment, memo, type RefObject, useRef, useState } from "react";

import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";
import { providerClients } from "~/components/settings/providerDriverMeta";
import { Collapsible, CollapsiblePanel } from "~/components/ui/collapsible";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { ensureLocalApi } from "~/localApi";
import { environmentPresentations } from "~/state/presentation";
import { XIcon } from "./icons/lucide-hugeicons";
import { ForkProviderMark, hasForkProviderMark } from "./icons/ModelPickerProviderGlyph";
import { actionableLimitNotices } from "./usageLimitNotices";
import { UsageCircleMeter, UsageMeter } from "./UsageMeter";

const FIVE_HOURS_MINS = 300;
const SEVEN_DAYS_MINS = 7 * 24 * 60;

/** Owns the composer usage drawer's atomic open/clock state and focus restoration. */
export function useComposerUsageDrawer(props: {
  readonly usageLimits: ServerProviderUsageLimits | undefined;
  readonly enabled: boolean;
}) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const open = props.enabled && openedAt !== null;

  const toggle = () => {
    setOpenedAt((current) => (current === null ? Date.now() : null));
  };

  const close = (restoreFocus = false) => {
    setOpenedAt(null);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  return {
    readout: props.enabled ? (
      <ComposerUsageLimitsReadout
        triggerRef={triggerRef}
        usageLimits={props.usageLimits}
        open={open}
        onToggle={toggle}
        onClose={() => close(false)}
      />
    ) : null,
    drawer: props.enabled ? (
      <ComposerUsageLimitsDrawer open={open} openedAt={openedAt ?? 0} onClose={() => close(true)} />
    ) : null,
  };
}

const ComposerUsageLimitsReadout = memo(function ComposerUsageLimitsReadout({
  triggerRef,
  usageLimits,
  open,
  onToggle,
  onClose,
}: {
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
  readonly usageLimits: ServerProviderUsageLimits | undefined;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onClose?: () => void;
}) {
  const session = usageLimits?.windows.find((window) => window.kind === "session");
  if (!session) return null;
  const remaining = remainingPercent(session);
  return (
    <button
      ref={triggerRef}
      type="button"
      data-fork-composer-usage-limits="true"
      aria-expanded={open}
      data-pressed={open ? "" : undefined}
      aria-label={`${session.label} limit: ${remaining}% left. ${open ? "Hide" : "Show"} usage limits`}
      className="flex shrink-0 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onToggle}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          onClose?.();
        }
      }}
    >
      <UsageCircleMeter remaining={remaining} />
    </button>
  );
});

/** Smoothly expanding single-line vessel strip anchored above the composer (grows upward, zero shift). */
const ComposerUsageLimitsDrawer = memo(function ComposerUsageLimitsDrawer(props: {
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

/** Full descriptive label for tooltips and accessible text. */
function fullWindowLabel(pool: LimitPool, window: LimitPoolWindow): string {
  const details = pool.driver === "cursor" ? cursorUsageWindowDetails(window.id, pool) : undefined;
  return (details?.label ?? window.label).replaceAll(" · ", " ");
}

/** Reported duration in minutes when every member in the pool agrees on one duration. */
function uniformWindowDurationMins(window: LimitPoolWindow): number | null {
  let shared: number | null = null;
  for (const member of window.members) {
    // Weekly suppression clears member.window.windowDurationMins; recover the account's original duration.
    const mins =
      member.window.windowDurationMins ??
      member.account.limits.windows.find(
        (candidate) => candidate.id === member.window.id && candidate.kind === member.window.kind,
      )?.windowDurationMins;
    if (mins === undefined) return null;
    if (shared === null) shared = mins;
    else if (shared !== mins) return null;
  }
  return shared;
}

/** Compact inline label (`5hr`, `7d`) derived from typed window metadata, falling back to the provider label. */
export function compactWindowLabel(pool: LimitPool, window: LimitPoolWindow): string {
  if (pool.driver === "cursor") return fullWindowLabel(pool, window);
  const durationMins = uniformWindowDurationMins(window);
  if (
    durationMins === FIVE_HOURS_MINS &&
    (pool.driver !== "antigravity" || window.id === "five_hour")
  ) {
    return "5hr";
  }
  if (
    window.id === "seven_day" ||
    (durationMins === SEVEN_DAYS_MINS &&
      window.kind === "weekly" &&
      pool.driver !== "claudeAgent" &&
      pool.driver !== "antigravity")
  ) {
    return "7d";
  }
  return fullWindowLabel(pool, window);
}

/** Windows shown in the compact composer strip (omits Claude's Fable weekly breakdown by id). */
export function compactTrayWindows(pool: LimitPool): readonly LimitPoolWindow[] {
  const windows = displayLimitWindows(pool);
  if (pool.driver !== "claudeAgent") return windows;
  return windows.filter((window) => window.id !== "seven_day_fable");
}

/** Mounted only while the strip is open, so the composer never subscribes to every environment's providers. */
function ComposerLimitsTray(props: { readonly now: number; readonly onClose: () => void }) {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const pools = collectLimitPools(collectLimitAccounts(presentations), props.now);
  const notices = actionableLimitNotices(presentations);
  const externalLinks = collectExternalUsageLinks(presentations);
  const hasContent = pools.length > 0 || notices.length > 0 || externalLinks.length > 0;

  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-2">
      {!hasContent ? (
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
            {externalLinks.map((link, index) => (
              <Fragment key={link.url}>
                {pools.length > 0 || index > 0 ? (
                  <span aria-hidden className="h-3.5 w-px shrink-0 bg-border" />
                ) : null}
                <button
                  type="button"
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xs text-xs text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void ensureLocalApi().shell.openExternal(link.url)}
                >
                  <span>{link.label}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                </button>
              </Fragment>
            ))}
            {notices.length > 0 ? (
              <>
                {pools.length > 0 || externalLinks.length > 0 ? (
                  <span aria-hidden className="h-3.5 w-px shrink-0 bg-border" />
                ) : null}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        data-fork-usage-notices="true"
                        aria-label={`Usage warnings: ${notices.join(" ")}`}
                        className="inline-flex min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-xs text-xs text-amber-600 dark:text-amber-400 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="max-w-56 truncate">
                          {pools.length === 0
                            ? notices[0]
                            : notices.length === 1
                              ? "1 issue"
                              : `${notices.length} issues`}
                        </span>
                      </button>
                    }
                  />
                  <TooltipPopup side="top" className="max-w-xs space-y-1 text-left">
                    {notices.map((notice) => (
                      <div key={notice} className="break-words">
                        {notice}
                      </div>
                    ))}
                  </TooltipPopup>
                </Tooltip>
              </>
            ) : null}
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
  const providerLabel = providerClients.get(pool.driver)?.label ?? pool.driver;
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
                  ? "inline-flex size-4 shrink-0 translate-y-px items-center justify-center [--fork-mark-size:14px]"
                  : "inline-flex size-4 shrink-0 items-center justify-center [--fork-mark-size:14px]"
              }
            >
              {hasForkProviderMark(pool.driver) ? (
                <ForkProviderMark driver={pool.driver} />
              ) : (
                <ProviderInstanceIcon
                  driverKind={pool.driver}
                  displayName={providerLabel}
                  indicatorBackground="var(--card)"
                  className="size-4"
                  iconClassName="size-3.5 text-foreground/80"
                />
              )}
            </span>
          }
        />
        <TooltipPopup side="top">{providerLabel}</TooltipPopup>
      </Tooltip>
      <div className="flex shrink-0 items-center gap-2.5">
        {windows.map((window) => {
          const nextRefill = window.resets.find((reset) => reset.restoresPercent > 0);
          const nextReset = nextRefill ?? window.resets[0];
          const resetsIn = nextReset ? formatResetsIn(nextReset.member.window, now) : null;
          const fullLabel = fullWindowLabel(pool, window);
          const shortLabel = compactWindowLabel(pool, window);
          const accessibleLabel = `${providerLabel} ${fullLabel}: ${window.remainingPercent}% left${resetsIn ? `, ${resetsIn}` : ""}`;
          return (
            <Tooltip key={`${window.kind}:${window.id}`}>
              <TooltipTrigger
                render={
                  <span
                    tabIndex={0}
                    role="group"
                    aria-label={accessibleLabel}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {shortLabel}
                    </span>
                    <UsageMeter
                      remaining={window.remainingPercent}
                      className="h-2.5 w-7 rounded-[3px] border border-border bg-muted/70"
                      fillClassName="rounded-none"
                    />
                  </span>
                }
              />
              <TooltipPopup side="top" className="tabular-nums">
                {`${fullLabel}: ${window.remainingPercent}% left${resetsIn ? ` · ${resetsIn}` : ""}`}
              </TooltipPopup>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
