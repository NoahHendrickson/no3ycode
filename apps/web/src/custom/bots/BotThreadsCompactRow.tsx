/**
 * A bot panel's thread row on two lines (mark, title and time; then its pull request and model) —
 * the sprint panel's (`fork-sprints`) and the coordinator's (`fork-coordinator-threads`); a Petal's
 * panel keeps BotThreadsPanel's row.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { formatSubagentEffort } from "@t3tools/client-runtime/state/thread-execution";
import type {
  ProviderDriverKind,
  PullRequestChecksState,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { resolveSelectableModel } from "@t3tools/shared/model";
import type { ComponentProps } from "react";

import { getTriggerDisplayModelName } from "~/components/chat/providerIconUtils";
import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { cn } from "~/lib/utils";
import { serverEnvironment } from "~/state/server";

import { PullRequestChipControl } from "../ComposerPullRequestChip";
import type { PullRequestChipState } from "../composerPullRequestChip.logic";
import { formatForkSubagentModel } from "../forkSubagentTree";
import { ForkProviderMarkOr } from "../icons/ModelPickerProviderGlyph";
import { ListItem } from "../ListItem";
import { SidebarV2StatusMark } from "../SidebarV2StatusIndicator";
import { type BotThreadsRowView, useBotThreadsRow } from "./BotThreadsPanel";
import type { BotWorkRow } from "./botWork";

export function BotThreadsCompactRow(props: {
  readonly row: BotWorkRow;
  readonly current: boolean;
  readonly onOpenThread: ((ref: ScopedThreadRef) => void) | undefined;
}) {
  return (
    <BotThreadsCompactRowView
      {...useBotThreadsRow(props.row, props.current, props.onOpenThread)}
      model={useBotThreadModel(props.row.thread)}
    />
  );
}

/** The model a thread runs, in the picker's words, with its effort; null before providers load. */
function useBotThreadModel(thread: EnvironmentThreadShell): BotThreadModel | null {
  const selection = thread.modelSelection;
  const instanceId = thread.runtime?.providerInstanceId ?? selection.instanceId;
  const provider = useAtomValue(serverEnvironment.providersValueAtom(thread.environmentId), (all) =>
    all?.find((candidate) => candidate.instanceId === instanceId),
  );
  // An alias or a stale slug resolves the way the picker resolves it.
  const slug =
    (provider === undefined
      ? null
      : resolveSelectableModel(provider.driver, selection.model, provider.models)) ??
    selection.model.trim();
  const model = provider?.models.find((candidate) => candidate.slug === slug);
  const label = model
    ? getTriggerDisplayModelName(model, provider?.driver)
    : formatForkSubagentModel(selection.model);
  if (label === null) return null;
  return {
    driver: provider?.driver ?? null,
    providerName: provider?.displayName ?? label,
    accentColor: provider?.accentColor,
    iconUrl: provider?.iconUrl,
    label,
    effort: formatSubagentEffort({
      modelSlug: slug,
      modelSelection: selection,
      provider,
    }),
  };
}

interface BotThreadModel {
  readonly driver: ProviderDriverKind | null;
  /** Names the provider's logo where the fork draws no mark of its own. */
  readonly providerName: string;
  readonly accentColor?: string | undefined;
  readonly iconUrl?: string | undefined;
  readonly label: string;
  readonly effort: string | null;
}

/** @public — the row as drawn, from plain props; Storybook renders it on its own. Two lines per
    thread: mark, title and time, then its pull request as the composer's chip (its row variant)
    and the model it runs. */
export function BotThreadsCompactRowView(
  props: Omit<ComponentProps<typeof BotThreadsRowView>, "pullRequest"> & {
    readonly pullRequest:
      | (ComponentProps<typeof BotThreadsRowView>["pullRequest"] & {
          readonly chipState?: PullRequestChipState | undefined;
          readonly checks?: PullRequestChecksState | null | undefined;
        })
      | null;
    readonly model: BotThreadModel | null;
  },
) {
  const { pullRequest, model } = props;
  const Icon = pullRequest?.state?.Icon ?? PullRequestGlyph.pullRequest;
  return (
    <li>
      <ListItem
        aria-current={props.current ? "page" : undefined}
        onClick={props.onOpen}
        onContextMenu={props.onContextMenu}
        className={cn(
          "items-start gap-2 px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          props.current && "bg-accent",
        )}
        data-testid="bot-threads-row"
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">
          <SidebarV2StatusMark status={props.status} seed={props.seed} idle="dot" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-base leading-5 text-foreground">
              {props.title}
            </span>
            <span className="shrink-0 text-base leading-5 text-foreground tabular-nums">
              {props.time}
            </span>
          </span>
          {pullRequest === null && model === null ? null : (
            <span className="flex min-w-0 items-center gap-4">
              {pullRequest === null ? null : (
                <PullRequestChipControl
                  variant="row"
                  render={<span />}
                  checks={pullRequest.checks ?? null}
                  size="xs"
                  data-fork-composer-status-chip="pull-request"
                  data-fork-pr-chip
                  data-pr-state={pullRequest.chipState}
                >
                  {/* The chip is a span inside the row's button, so its words are read in place. */}
                  <span className="sr-only">
                    {pullRequest.state === null
                      ? "Pull request"
                      : `${pullRequest.state.label} pull request`}
                  </span>
                  <span
                    className={cn(
                      "contents font-normal text-xs tabular-nums",
                      pullRequest.state?.toneClassName,
                    )}
                  >
                    <Icon aria-hidden className="size-3 shrink-0" />
                    <span>{pullRequest.number}</span>
                  </span>
                </PullRequestChipControl>
              )}
              {model === null ? null : (
                <span className="flex min-w-0 items-center gap-1 text-sm leading-5">
                  <ForkProviderMarkOr
                    driver={model.driver}
                    size="0.875rem"
                    fallback={
                      model.driver === null ? null : (
                        <ProviderInstanceIcon
                          driverKind={model.driver}
                          displayName={model.providerName}
                          accentColor={model.accentColor}
                          acpRegistryIconUrl={model.iconUrl}
                          className="z-auto"
                          iconClassName="size-3.5"
                        />
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
          )}
        </span>
      </ListItem>
    </li>
  );
}
