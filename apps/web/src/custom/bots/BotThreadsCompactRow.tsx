/**
 * A bot panel's thread row on two lines (mark, title and time; then its pull request and model) —
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

/** @public — the row as drawn, from plain props; Storybook renders it on its own. Two lines per
    thread: mark, title and time, then its pull request as the composer's chip (its row variant)
    and the model it runs. */
export function BotThreadsCompactRowView(
  props: Omit<ComponentProps<typeof BotThreadsRowFrame>, "density" | "detail"> & {
    readonly pullRequest: ComponentProps<typeof PullRequestRowChip> | null;
    readonly model: ForkThreadModel | null;
  },
) {
  const { pullRequest, model } = props;
  return (
    <BotThreadsRowFrame
      {...props}
      density="compact"
      detail={
        pullRequest === null && model === null ? null : (
          <span className="flex min-w-0 items-center gap-4">
            {pullRequest === null ? null : <PullRequestRowChip {...pullRequest} />}
            {model === null ? null : (
              <span className="flex min-w-0 items-center gap-1 text-sm leading-5">
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
