/**
 * Fork shadow of components/usage/UsageLimitsPooled.tsx — see
 * `.fork/customizations.yaml#fork-usage-limits-surface`. One ScheduledCard
 * per provider with a compact row per window and a thin, fully rounded
 * meter toned by share left; each account's details live in its segment's popover.
 */
import {
  CHATGPT_USAGE_URL,
  collectLimitAccounts,
  collectLimitPools,
  displayLimitWindows,
  type LimitAccount,
  type LimitPool,
  type LimitPoolMember,
  type LimitPoolWindow,
  paceRemainingPercent,
  remainingPercent,
  type ResetCreditChoice,
} from "@t3tools/shared/usageLimits";
import { T, useGT, useMessages } from "gt-react";
import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { AlertTriangleIcon, ChevronRightIcon, ExternalLinkIcon, TicketIcon } from "lucide-react";
import {
  createContext,
  Fragment,
  type ReactNode,
  type RefObject,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ensureLocalApi } from "../../localApi";
import { usePrimarySettings } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { formatUpcomingTimestamp } from "../../timestampFormat";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { providerClients } from "../settings/providerDriverMeta";
import { RedactedSensitiveText } from "../settings/RedactedSensitiveText";
import { Button } from "../ui/button";
import { OpenAI } from "../Icons";
import { Alert, AlertTitle } from "../ui/alert";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Popover, PopoverCreateHandle, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { ForkProviderMark, hasForkProviderMark } from "~/custom/icons/ModelPickerProviderGlyph";
import { ScheduledCard } from "~/custom/scheduled/scheduledPageChrome";
import { UsageMeter } from "~/custom/UsageMeter";
import { actionableLimitNotices } from "~/custom/usageLimitNotices";
import { PaceIcon, ResetCreditDialog, useResetCredit } from "./UsageLimits";
import {
  collectExternalUsageLinks,
  cursorUsageWindowDetails,
  formatResetsIn,
  resetCreditChoices,
} from "@t3tools/shared/usageLimitsCopy";

function accountInitials(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local[0] ?? ""}${domain[0] ?? ""}`.toUpperCase() || "?";
}

function accountHue(email: string): number {
  let hash = 0;
  for (let index = 0; index < email.length; index += 1) {
    hash = (hash * 31 + email.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}

function AccountChip({ email }: { readonly email: string }) {
  const hue = accountHue(email);
  const gt = useGT();
  return (
    <span
      role="img"
      aria-label={gt("Account {initials}", { initials: accountInitials(email) })}
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-3xs leading-none font-semibold"
      style={{ backgroundColor: `oklch(0.85 0.08 ${hue})`, color: `oklch(0.35 0.1 ${hue})` }}
    >
      {accountInitials(email)}
    </span>
  );
}

function AccountAvatar({
  account,
  className,
}: {
  readonly account: LimitAccount;
  readonly className?: string;
}) {
  if (account.redeem) {
    return (
      <ProviderInstanceIcon
        driverKind={account.driver}
        displayName={
          account.displayName ??
          providerClients.get(account.driver)?.label ??
          String(account.driver)
        }
        accentColor={account.accentColor}
        showBadge={Boolean(account.displayName)}
        indicatorBackground="var(--popover)"
        className={cn("size-5", className)}
        iconClassName="size-4 text-foreground/80"
      />
    );
  }
  return account.email ? <AccountChip email={account.email} /> : null;
}

function AccountName({
  account,
  className,
}: {
  readonly account: LimitAccount;
  readonly className?: string;
}) {
  if (account.displayName) return <span className={className}>{account.displayName}</span>;
  if (account.email) {
    return (
      <span className={cn("inline-flex min-w-0 items-center", className)}>
        <AccountChip email={account.email} />
      </span>
    );
  }
  return (
    <span className={className}>
      {providerClients.get(account.driver)?.label ?? String(account.driver)}
    </span>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground tabular-nums">{children}</span>
    </div>
  );
}

function SegmentPopover({
  account,
  window,
  reset,
  now,
  redeem,
  onRedeem,
}: {
  readonly account: LimitAccount;
  readonly window: LimitPoolMember["window"];
  readonly reset: LimitPoolWindow["resets"][number] | undefined;
  readonly now: number;
  readonly redeem: ReturnType<typeof useResetCredit> | null;
  readonly onRedeem: (choice: ResetCreditChoice) => void;
}) {
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const gt = useGT();
  const m = useMessages();
  const remaining = remainingPercent(window);
  const timeLeft = paceRemainingPercent(window, now);
  const resetsIn = formatResetsIn(window, now, m, "in");
  const where =
    account.environments.length > 0
      ? account.environments.map((environment) => environment.label).join(", ")
      : account.sourceLabel;
  const choices =
    redeem && account.redeem && account.limits.resetCredits?.availableCount
      ? resetCreditChoices(account.limits.resetCredits, account.redeem.input, now, true, m)
      : [];
  return (
    <div className="flex w-72 max-w-[calc(100vw-3rem)] flex-col gap-2.5 text-xs">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AccountAvatar account={account} />
          <span className="truncate">
            {account.displayName ?? providerClients.get(account.driver)?.label ?? account.driver}
          </span>
        </span>
        {account.email ? (
          <RedactedSensitiveText
            value={account.email}
            ariaLabel={gt("Toggle account email visibility")}
            revealTooltip={gt("Click to reveal email")}
            hideTooltip={gt("Click to hide email")}
            className="w-fit"
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1 border-t border-border/60 pt-2.5">
        {account.plan ? (
          <Row label={gt("Plan", { $context: "subscription plan" })}>{account.plan}</Row>
        ) : null}
        {where ? (
          <Row
            label={
              account.environments.length > 0
                ? gt("Signed in")
                : gt("Via", { $context: "signed in through a source" })
            }
          >
            {where}
          </Row>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 border-t border-border/60 pt-2.5">
        <Row label={gt("Left", { $context: "remaining usage" })}>{remaining}%</Row>
        {window.resetsAt ? (
          <Row label={gt("Resets", { $context: "when the usage window resets" })}>
            {formatUpcomingTimestamp(window.resetsAt, timestampFormat, now, undefined, m)}
            {resetsIn ? ` · ${resetsIn}` : ""}
          </Row>
        ) : null}
        {timeLeft !== null ? (
          <Row label={gt("Even pace")}>{gt("{timeLeft}% left by now", { timeLeft })}</Row>
        ) : null}
        {reset && reset.restoresPercent > 0 ? (
          <Row label={gt("Restores", { $context: "a reset credit restores part of the pool" })}>
            {gt("+{percent}% of pool", { percent: reset.restoresPercent })}
          </Row>
        ) : null}
      </div>
      {choices.length > 0 && redeem ? (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5 text-muted-foreground">
          {choices.map((choice) => (
            <span key={choice.key} className="flex items-center gap-3">
              <span className="tabular-nums">{choice.summary}</span>
              {choice.availableCount > 0 ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={redeem.busy || !redeem.canManageProviders}
                  className="ms-auto"
                  onClick={() => onRedeem(choice)}
                >
                  {redeem.busy ? gt("Using…") : choice.actionLabel}
                </Button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Every segment on the page shares one popover, so hovering or clicking another
 * segment moves it instead of opening a second one. The payload is the segment
 * it currently describes.
 */
type SegmentPayload = Omit<Parameters<typeof SegmentPopover>[0], "now" | "onRedeem">;
const SegmentPopoverContext = createContext<ReturnType<
  typeof PopoverCreateHandle<SegmentPayload>
> | null>(null);

function ActiveSegmentPopover({
  handle,
  actions,
  payload,
  pools,
  now,
  compact,
}: {
  readonly handle: ReturnType<typeof PopoverCreateHandle<SegmentPayload>>;
  readonly actions: RefObject<PopoverPrimitive.Root.Actions | null>;
  readonly payload: SegmentPayload;
  readonly pools: readonly LimitPool[];
  readonly now: number;
  readonly compact: boolean;
}) {
  const available = pools.some((pool) =>
    displayLimitWindows(pool).some((window) =>
      window.members.some(
        (member) =>
          member.account.key === payload.account.key &&
          member.window.id === payload.window.id &&
          member.window.kind === payload.window.kind &&
          Boolean(member.account.redeem && !compact) === Boolean(payload.redeem),
      ),
    ),
  );
  // The trigger is gone, so the popup has nothing to anchor to: an exit transition would
  // slide it to the viewport origin. Unmount it outright, which also clears Base UI's
  // active-trigger bookkeeping so the segment can open again when it comes back.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- closes the popover handle and unmounts the Base UI popup before paint when its trigger is gone
  useLayoutEffect(() => {
    if (available) return;
    handle.close();
    actions.current?.unmount();
  }, [available, handle, actions]);
  return (
    <PopoverPopup side="top" sideOffset={6}>
      <SegmentPopover
        {...payload}
        now={now}
        onRedeem={(choice) => {
          handle.close();
          payload.redeem?.confirm(choice);
        }}
      />
    </PopoverPopup>
  );
}

/**
 * One account's share of one pooled window: a thin fully rounded meter, its
 * popover, and the reset confirm. The button is taller than the bar it draws
 * so the strip stays easy to hover and tap. The confirm is a sibling of the
 * popover, not a child: dialogs stack under popovers, and the popover closes
 * as the confirm opens.
 */
function PoolSegment({
  account,
  ...props
}: {
  readonly account: LimitAccount;
  readonly window: LimitPoolMember["window"];
  readonly reset: LimitPoolWindow["resets"][number] | undefined;
  readonly now: number;
  readonly compact: boolean;
}) {
  // The composer's menu is itself a popover, which would stack above the confirm dialog, so
  // credits are spent from the Usage page only.
  return account.redeem && !props.compact ? (
    <RedeemableSegment account={account} redeemAt={account.redeem} {...props} />
  ) : (
    <SegmentTriggers account={account} redeem={null} {...props} />
  );
}

function RedeemableSegment({
  redeemAt,
  ...props
}: Omit<Parameters<typeof SegmentTriggers>[0], "redeem"> & {
  readonly redeemAt: NonNullable<LimitAccount["redeem"]>;
}) {
  const redeem = useResetCredit(redeemAt.environmentId);
  const gt = useGT();
  return (
    <>
      <SegmentTriggers redeem={redeem} {...props} />
      <ResetCreditDialog
        open={redeem.confirming}
        onOpenChange={redeem.setConfirming}
        choice={redeem.choice}
        onConfirm={() => void redeem.redeem()}
        disabled={!redeem.canManageProviders}
      />
      {/* The popover closed before the confirm, so progress and the outcome need
          a home outside it: last in the wrapping row, so the segments keep their columns. */}
      {redeem.busy || redeem.status ? (
        <span role="status" className="order-last basis-full text-xs text-muted-foreground">
          <AccountName account={props.account} className="font-medium text-foreground" />{" "}
          {redeem.busy ? gt("Using reset credit…") : redeem.status}
        </span>
      ) : null}
    </>
  );
}

function SegmentTriggers({
  account,
  window,
  reset,
  redeem,
  now,
  compact,
}: SegmentPayload & {
  readonly now: number;
  readonly compact: boolean;
}) {
  const popover = use(SegmentPopoverContext) ?? undefined;
  const payload: SegmentPayload = { account, window, reset, redeem };
  const remaining = remainingPercent(window);
  const timeLeft = paceRemainingPercent(window, now);
  const m = useMessages();
  const resetsIn = formatResetsIn(window, now, m);
  const credits = account.limits.resetCredits?.availableCount ?? 0;
  const gt = useGT();
  const segmentLabel = [
    gt("{name}: {remaining}% left", {
      name:
        account.displayName ?? (account.email ? accountInitials(account.email) : account.driver),
      remaining,
    }),
    resetsIn,
    timeLeft === null ? null : gt("{timeLeft}% of the window left", { timeLeft }),
    credits
      ? gt(
          "{count, plural, one {{count} reset credit banked} other {{count} reset credits banked}}",
          { count: credits },
        )
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <PopoverTrigger
      handle={popover}
      payload={payload}
      openOnHover
      render={
        <button
          type="button"
          aria-label={segmentLabel}
          className={cn(
            "group/segment flex min-w-0 flex-1 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "h-3" : "h-4",
          )}
        />
      }
    >
      <UsageMeter
        remaining={remaining}
        className={cn("w-full", compact ? "h-1" : "h-1.5")}
        fillClassName="opacity-85 group-hover/segment:opacity-100 group-data-[popup-open]/segment:opacity-100"
      />
    </PopoverTrigger>
  );
}

function PoolWindowRow({
  pool,
  now,
  label,
  description,
  compact,
}: {
  readonly pool: LimitPoolWindow;
  readonly now: number;
  readonly label?: string | null | undefined;
  readonly description?: string | undefined;
  readonly compact: boolean;
}) {
  const restores = new Map(pool.resets.map((reset) => [reset.member.account.key, reset]));
  // The soonest reset that hands anything back; an untouched account resets to no effect.
  const nextRefill = pool.resets.find((reset) => reset.restoresPercent > 0);
  const nextReset = nextRefill ?? pool.resets[0];
  const m = useMessages();
  const gt = useGT();
  const resetsIn = nextReset ? formatResetsIn(nextReset.member.window, now, m, "refill") : null;
  const pooled = pool.columns.length > 1;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        className={cn(
          "flex min-w-0 items-center justify-between gap-3",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {/* "Weekly · Fable" reads as one label here; the dot is for inline use. */}
        {label !== null ? (
          <span className="truncate text-foreground">
            {(label ?? pool.label).replaceAll(" · ", " ")}
          </span>
        ) : null}
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
          {pool.pace ? <PaceIcon pace={pool.pace} /> : null}
          <span className="font-medium text-foreground">{pool.remainingPercent}%</span>
          <span className="sr-only">
            <T context="remaining usage percentage">left</T>
          </span>
          {resetsIn ? (
            <span className="font-medium text-muted-foreground">
              {pooled && nextRefill ? `+${nextRefill.restoresPercent}% ` : ""}
              {resetsIn}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1">
        {pool.columns.map((member) =>
          member.window ? (
            <PoolSegment
              key={member.account.key}
              account={member.account}
              window={member.window}
              reset={restores.get(member.account.key)}
              now={now}
              compact={compact}
            />
          ) : pool.kind === "monthly" && member.account.limits.zeroSpendCap ? (
            <span
              key={member.account.key}
              className="flex h-4 min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted-foreground"
            >
              {pooled ? (
                <AccountName account={member.account} className="min-w-0 truncate" />
              ) : null}
              {gt("$0 cap")}
            </span>
          ) : (
            <UsageMeter
              key={member.account.key}
              remaining={null}
              className={cn("min-w-0 flex-1", compact ? "h-1" : "h-1.5")}
            />
          ),
        )}
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** The composer's limits menu opens these providers; every other one starts collapsed. */
const COMPACT_EXPANDED_DRIVERS: ReadonlySet<string> = new Set(["codex", "claudeAgent"]);

/**
 * One card per provider: the provider's mark and name, banked reset credits
 * across its accounts, then one compact row per window. Compact (the
 * composer's limits menu) drops the card for a divider between providers,
 * and folds each provider to its header, Codex and Claude starting open.
 */
function PoolSection({
  pool,
  now,
  compact,
}: {
  readonly pool: LimitPool;
  readonly now: number;
  readonly compact: boolean;
}) {
  const label = providerClients.get(pool.driver)?.label ?? String(pool.driver);
  const windows = displayLimitWindows(pool);
  const credits = pool.accounts.reduce(
    (total, account) => total + (account.limits.resetCredits?.availableCount ?? 0),
    0,
  );
  const gt = useGT();
  const m = useMessages();
  const header = (
    <>
      {compact && hasForkProviderMark(pool.driver) ? (
        <span
          aria-hidden
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center [--fork-mark-size:14px]",
            pool.driver === "claudeAgent" && "translate-y-px",
          )}
        >
          <ForkProviderMark driver={pool.driver} />
        </span>
      ) : (
        <ProviderInstanceIcon
          driverKind={pool.driver}
          displayName={label}
          indicatorBackground={compact ? "var(--popover)" : "var(--background)"}
          className={compact ? "size-4" : "size-5"}
          iconClassName={cn(compact ? "size-3.5" : "size-4", "text-foreground/80")}
        />
      )}
      {label}
      <span className="ms-auto flex items-center gap-1 text-xs font-normal text-muted-foreground tabular-nums">
        {credits ? (
          <span className="inline-flex items-center gap-1">
            <TicketIcon className="size-3.5" aria-hidden />
            <span aria-hidden>{credits}</span>
            <span className="sr-only">
              {gt(
                "{count, plural, one {{count} reset credit banked} other {{count} reset credits banked}}",
                { count: credits },
              )}
            </span>
          </span>
        ) : null}
        {compact ? (
          <>
            {/* collectLimitAccounts drops accounts with no windows, so a pool always has one. */}
            <span className="group-data-panel-open/provider:hidden">
              {Math.min(...windows.map((window) => window.remainingPercent))}%
              <span className="sr-only">
                {" "}
                <T context="remaining usage percentage">left</T>
              </span>
            </span>
            <ChevronRightIcon
              className="size-3.5 group-data-panel-open/provider:rotate-90"
              aria-hidden
            />
          </>
        ) : null}
      </span>
    </>
  );
  const rows = (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {windows.map((window) => {
        const details =
          pool.driver === "cursor" ? cursorUsageWindowDetails(window.id, pool, m) : undefined;
        return (
          <PoolWindowRow
            key={`${window.kind}:${window.id}`}
            pool={window}
            now={now}
            label={details?.label}
            description={details?.description}
            compact={compact}
          />
        );
      })}
    </div>
  );
  return compact ? (
    <LimitsCard compact>
      <Collapsible
        className="flex flex-col"
        defaultOpen={COMPACT_EXPANDED_DRIVERS.has(pool.driver)}
      >
        <h2>
          <CollapsibleTrigger className="group/provider flex w-full items-center gap-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            {header}
          </CollapsibleTrigger>
        </h2>
        <CollapsiblePanel animate={false}>
          <div className="pt-2">{rows}</div>
        </CollapsiblePanel>
      </Collapsible>
    </LimitsCard>
  ) : (
    <LimitsCard compact={false} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">{header}</h2>
      {rows}
    </LimitsCard>
  );
}

/** A provider's block: a card on the Usage page, a divided section in the compact menu. */
function LimitsCard({
  compact,
  className,
  children,
}: {
  readonly compact: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return compact ? (
    <section className={cn("px-3 py-2.5", className)}>{children}</section>
  ) : (
    <ScheduledCard className={cn("p-4", className)}>{children}</ScheduledCard>
  );
}

export function UsageLimitsPooled({
  presentations,
  now,
  compact = false,
}: {
  readonly presentations: Parameters<typeof collectLimitAccounts>[0];
  readonly now: number;
  /** The composer's limits menu: providers split by dividers instead of cards, smaller type. */
  readonly compact?: boolean;
}) {
  const gt = useGT();
  const m = useMessages();
  const [segmentPopover] = useState(() => PopoverCreateHandle<SegmentPayload>());
  const segmentPopoverActions = useRef<PopoverPrimitive.Root.Actions | null>(null);
  const pools = collectLimitPools(collectLimitAccounts(presentations), now);
  const notices = actionableLimitNotices(presentations, m);
  const externalLinks = collectExternalUsageLinks(presentations, m);
  return (
    <div className={compact ? "flex flex-col divide-y divide-border" : "flex flex-col gap-4"}>
      {pools.length === 0 && notices.length === 0 && externalLinks.length === 0 ? (
        <p className={cn("text-muted-foreground", compact ? "px-3 py-2.5 text-xs" : "text-sm")}>
          <T>No provider on the selected environments reports subscription limits.</T>
        </p>
      ) : null}
      <SegmentPopoverContext value={segmentPopover}>
        {pools.map((pool) => (
          <Fragment key={pool.driver}>
            <PoolSection pool={pool} now={now} compact={compact} />
          </Fragment>
        ))}
      </SegmentPopoverContext>
      <Popover handle={segmentPopover} actionsRef={segmentPopoverActions}>
        {({ payload }) =>
          payload ? (
            <ActiveSegmentPopover
              handle={segmentPopover}
              actions={segmentPopoverActions}
              payload={payload}
              pools={pools}
              now={now}
              compact={compact}
            />
          ) : null
        }
      </Popover>
      {externalLinks.map((link) => (
        <LimitsCard
          key={link.url}
          compact={compact}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {link.url === CHATGPT_USAGE_URL ? (
              <OpenAI className="size-5 shrink-0" aria-hidden="true" />
            ) : null}
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-medium">{link.label}</h2>
              <p className="text-xs break-words text-muted-foreground">
                {link.accounts.join(", ")}
              </p>
              {link.url === CHATGPT_USAGE_URL ? (
                <p className="text-xs text-muted-foreground">
                  <T>View usage in ChatGPT with your connected account.</T>
                </p>
              ) : link.message ? (
                <p className="max-w-xl text-xs text-muted-foreground">{link.message}</p>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost-muted"
            size="xs"
            onClick={() => void ensureLocalApi().shell.openExternal(link.url)}
          >
            {gt("Manage usage")}
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </LimitsCard>
      ))}
      {notices.length > 0 ? (
        <div className={cn(compact && "px-3 py-2.5")}>
          <LimitNotices notices={notices} />
        </div>
      ) : null}
    </div>
  );
}

function LimitNotices({ notices }: { readonly notices: readonly string[] }) {
  return (
    <Alert variant="warning" controlAlignment="first-line">
      <AlertTriangleIcon />
      {notices.map((notice) => (
        <AlertTitle key={notice} className="break-words">
          {notice}
        </AlertTitle>
      ))}
    </Alert>
  );
}
