/**
 * A bot panel's thread row on two lines (mark, title and time; then its pull requests and model) —
 * the sprint panel's (`fork-sprints`) and the coordinator's (`fork-coordinator-threads`); a Petal's
 * panel keeps BotThreadsPanel's row.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ProviderDriverKind, ScopedThreadRef } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";
import { serverEnvironment } from "~/state/server";

import { PullRequestRowChip } from "../ComposerPullRequestChip";
import { type ForkThreadModel, useForkThreadModel } from "../ForkSubagentGroup";
import { ForkProviderMarkOr } from "../icons/ModelPickerProviderGlyph";
import { BotThreadsRowFrame, useBotThreadsRow } from "./BotThreadsPanel";
import type { BotWorkRow } from "./botWork";

export function BotThreadsCompactRow(props: {
  readonly row: BotWorkRow;
  readonly current: boolean;
  readonly onOpenThread: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  return (
    <BotThreadsCompactRowView
      {...useBotThreadsRow(props.row, props.current, props.onOpenThread)}
      model={useForkThreadModel(props.row.thread)}
    />
  );
}

/** The thread's own chip and one merged one; more fold into "+N", so the line fits the narrowest
    panel. */
const ROW_CHIP_LIMIT = 2;

/** @public — the row as drawn, from plain props; Storybook renders it on its own. Two lines per
    thread: mark, title and time, then its pull request as the composer's chip (its row variant),
    its other merged ones, and the model it runs. */
export function BotThreadsCompactRowView(
  props: Omit<ComponentProps<typeof BotThreadsRowFrame>, "density" | "detail"> & {
    /** Its own pull request, then its other merged ones, newest first. */
    readonly pullRequests: ReadonlyArray<ComponentProps<typeof PullRequestRowChip>>;
    readonly model: ForkThreadModel | null;
  },
) {
  const { pullRequests, model } = props;
  const hiddenMerged = pullRequests.length - ROW_CHIP_LIMIT;
  return (
    <BotThreadsRowFrame
      {...props}
      density="compact"
      detail={
        pullRequests.length === 0 && model === null ? null : (
          <span className="flex min-w-0 items-center gap-4">
            {pullRequests.length === 0 ? null : (
              <span className="flex shrink-0 items-center gap-1">
                {pullRequests.slice(0, ROW_CHIP_LIMIT).map((pullRequest, index) => (
                  // oxlint-disable-next-line react/no-array-index-key -- positional: own chip, then newest merged
                  <PullRequestRowChip key={index} {...pullRequest} />
                ))}
                {hiddenMerged > 0 ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span aria-hidden>+{hiddenMerged}</span>
                    {/* oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog) */}
                    <span className="sr-only">{`${hiddenMerged} more merged`}</span>
                  </span>
                ) : null}
              </span>
            )}
            {model === null ? null : (
              <span className="flex min-w-0 items-center gap-1 overflow-hidden text-sm leading-5">
                <ForkProviderMarkOr
                  driver={model.driver}
                  size="0.875rem"
                  fallback={
                    model.driver === null ? null : (
                      <ProviderLogo model={model} driver={model.driver} />
                    )
                  }
                />
                <span className="truncate text-foreground">{model.label}</span>
                {model.effort === null ? null : (
                  <span className="shrink-0 text-muted-foreground">{model.effort}</span>
                )}
              </span>
            )}
          </span>
        )
      }
    />
  );
}

/** The provider's own logo, for a driver the fork draws no mark for; reads its provider entry
    only then. */
function ProviderLogo(props: {
  readonly model: ForkThreadModel;
  readonly driver: ProviderDriverKind;
}) {
  const { environmentId, instanceId } = props.model;
  const provider = useAtomValue(serverEnvironment.providersValueAtom(environmentId), (all) =>
    all?.find((candidate) => candidate.instanceId === instanceId),
  );
  return (
    <ProviderInstanceIcon
      driverKind={props.driver}
      displayName={provider?.displayName ?? props.model.label}
      accentColor={provider?.accentColor}
      acpRegistryIconUrl={provider?.iconUrl}
      className="z-auto"
      iconClassName="size-3.5"
    />
  );
}
