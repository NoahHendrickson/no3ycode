/**
 * The Agents sheet's rows as the transcript's subagent card (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * the provider tile with its status mark, the title over model and effort, the elapsed time, and a
 * quiet round stop button while the agent can be stopped. Workflow groups keep upstream's rows.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import { useAtomValue } from "@effect/atom-react";
import {
  resolveSubagentMetadata,
  subagentCardDetail,
} from "@t3tools/client-runtime/state/subagent-display";
import { formatSubagentEffort } from "@t3tools/client-runtime/state/thread-execution";
import type { EnvironmentId, OrchestrationV2Subagent } from "@t3tools/contracts";
import { T, useGT, Var } from "gt-react-native";
import { useState, type ReactElement } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  resolveSubagentRowPresentation,
  resolveSubagentStopTarget,
  subagentThreadTarget,
  type SubagentThreadTarget,
} from "../src/features/threads/threadAgentsPresentation";
import { subagentCardElapsed } from "../src/features/threads/subagent-card-presentation";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { useLinkedThreadReach } from "../src/state/linkedThread";
import { useEnvironmentServerConfig } from "../src/state/entities";
import { orchestrationEnvironment } from "../src/state/orchestration";
import { threadEnvironment } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { useNo3yBottomNavEnabled } from "./no3yBottomNavEnabled";
import { Elapsed, No3ySubagentTile } from "./No3ySubagentCards";
import { no3ySubagentSpec } from "./no3ySubagentCard";
import { no3ySubagentMarkKind } from "./no3yStatusSegments";

interface RowProps {
  readonly environmentId: EnvironmentId;
  readonly subagent: OrchestrationV2Subagent;
  readonly onOpen: (child: SubagentThreadTarget, title: string | null) => void;
}

/** Draws the no3y card in place of the upstream row it wraps while the redesign is on. */
export function No3yAgentsSheetRowSwap(props: RowProps & { readonly children: ReactElement }) {
  const enabled = useNo3yBottomNavEnabled();
  if (!enabled) return props.children;
  return (
    <No3yAgentsSheetRow
      environmentId={props.environmentId}
      subagent={props.subagent}
      onOpen={props.onOpen}
    />
  );
}

function No3yAgentsSheetRow(props: RowProps) {
  const { subagent } = props;
  const gt = useGT();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const reach = useLinkedThreadReach(props.environmentId, [subagent]);
  // A task in a linked environment runs a provider instance of that environment.
  const config = useEnvironmentServerConfig(
    subagent.remoteChild?.environmentId ?? props.environmentId,
  );
  const provider = config?.providers.find(
    (candidate) => candidate.instanceId === subagent.providerInstanceId,
  );
  const target = subagentThreadTarget(
    subagent,
    props.environmentId,
    reach.ownConnection,
    reach.isLinked,
  );
  const presentation = resolveSubagentRowPresentation(subagent, target !== null);
  const { modelLabel, modelSlug } = resolveSubagentMetadata({
    model: subagent.model,
    modelSelection: subagent.modelSelection,
    provider,
  });
  const effort = formatSubagentEffort({
    modelSlug,
    modelSelection: subagent.modelSelection,
    provider,
  });
  const spec = no3ySubagentSpec({ modelLabel, effort, statusLabel: presentation.statusLabel });
  const mark = no3ySubagentMarkKind(subagent.status);
  const failed = mark === "failed";
  // A stopped or failed agent keeps its outcome word; the model line would otherwise hide it.
  const outcome =
    (presentation.tone === "stopped" || failed) && spec !== presentation.statusLabel
      ? presentation.statusLabel
      : null;
  // Live progress and failures; a finished agent's reply belongs in its thread, unless it has none.
  const detail =
    presentation.live || failed || target === null ? subagentCardDetail(presentation.detail) : null;
  const elapsed = subagentCardElapsed([subagent], useVisibleSecondClock(presentation.live));
  const driver =
    provider?.driver ?? (subagent.remoteChild === undefined ? subagent.driver : undefined);
  const stop = useNo3yAgentStop(props.environmentId, subagent, presentation.title);

  // The stop button sits beside the link, not inside it, so VoiceOver reaches both.
  return (
    <View
      style={{
        marginTop: 8,
        flexDirection: "row",
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.controlBorder,
        backgroundColor: palette.controlSurface,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole={target === null ? undefined : "link"}
        accessibilityLabel={[
          presentation.title,
          presentation.statusLabel,
          spec === presentation.statusLabel ? null : spec,
          presentation.runsOn === null ? null : `${gt("Runs on")} ${presentation.runsOn}`,
          elapsed,
          detail,
        ]
          .filter(Boolean)
          .join(", ")}
        accessibilityHint={
          target === null
            ? gt("Provider-managed agent. Its work appears in the transcript.")
            : target.linked === undefined
              ? gt("Opens this agent's thread")
              : gt("Opens a read-only view of this agent's thread on {label}", {
                  label: target.linked.label,
                })
        }
        disabled={target === null}
        onPress={() => {
          if (target !== null) props.onOpen(target, subagent.title);
        }}
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          paddingLeft: 12,
          paddingRight: stop === null ? 8 : 10,
          paddingVertical: 10,
          backgroundColor: pressed ? palette.rowSelected : "transparent",
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <No3ySubagentTile
            driver={driver}
            iconUrl={provider?.iconUrl}
            knownProvider={provider !== undefined}
            mark={mark}
            palette={palette}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, ...NO3Y_FONT.medium, color: palette.titleInk }}
            >
              {presentation.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                color:
                  failed && spec === presentation.statusLabel
                    ? palette.statusFailed
                    : palette.metaInk,
              }}
            >
              {spec}
              {outcome !== null ? (
                <Text style={{ color: failed ? palette.statusFailed : palette.metaInk }}>
                  {` · ${outcome}`}
                </Text>
              ) : null}
              {presentation.runsOn !== null ? (
                <>
                  {" · "}
                  <T>
                    on <Var>{presentation.runsOn}</Var>
                  </T>
                </>
              ) : null}
            </Text>
          </View>
          {subagent.startedAt ? <Elapsed agents={[subagent]} palette={palette} /> : null}
          {stop === null && target !== null ? (
            <View style={{ width: 20, alignItems: "center" }}>
              <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.faintInk} />
            </View>
          ) : null}
        </View>
        {detail ? (
          <Text
            numberOfLines={2}
            style={{
              marginTop: 8,
              marginLeft: 42,
              marginRight: 4,
              fontSize: 13,
              lineHeight: 18,
              color: failed ? palette.statusFailed : palette.metaInk,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </Pressable>
      {stop !== null ? (
        <View style={{ paddingTop: 12, paddingRight: 8 }}>
          <StopGlyphButton palette={palette} {...stop} />
        </View>
      ) : null}
    </View>
  );
}

const STOP_SIZE = 28;

/**
 * Upstream's SubagentStopButton behavior for a single agent, for a quiet round button in place of
 * its red tile. Workflows never reach this row; the sheet draws them as ThreadWorkflowGroup.
 */
function useNo3yAgentStop(
  environmentId: EnvironmentId,
  subagent: OrchestrationV2Subagent,
  label: string,
): Omit<StopGlyphButtonProps, "palette"> | null {
  const gt = useGT();
  const target = resolveSubagentStopTarget(subagent);
  const canStop = useAtomValue(orchestrationEnvironment.stopWorkflow.permissionAtom(environmentId));
  const interruptTurn = useAtomCommand(threadEnvironment.interruptTurn);
  const [stopping, setStopping] = useState(false);

  if (target?.kind !== "subagent" || !canStop) return null;

  const stop = async () => {
    setStopping(true);
    const result = await interruptTurn({ environmentId, input: target.input }).finally(() =>
      setStopping(false),
    );
    if (result._tag === "Failure") Dialog.alert(gt("Could not stop agent"));
  };

  return {
    disabled: stopping,
    accessibilityLabel: stopping
      ? gt("Stopping agent {label}", { label })
      : gt("Stop agent {label}", { label }),
    onPress: () =>
      Dialog.confirm({
        title: gt("Stop agent?"),
        message: gt("Stop {label}?", { label }),
        confirmText: gt("Stop", { $context: "verb, confirm button" }),
        destructive: true,
        onConfirm: () => void stop(),
      }),
  };
}

interface StopGlyphButtonProps {
  readonly palette: FlatGlassPalette;
  readonly disabled: boolean;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

function StopGlyphButton(props: StopGlyphButtonProps) {
  const { palette } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      hitSlop={8}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: STOP_SIZE,
        height: STOP_SIZE,
        borderRadius: STOP_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? palette.rowSelected : palette.circleFill,
        opacity: props.disabled ? 0.5 : 1,
      })}
    >
      <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: palette.foreground }} />
    </Pressable>
  );
}
