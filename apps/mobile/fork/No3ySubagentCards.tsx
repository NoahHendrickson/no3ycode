/**
 * The transcript's subagents as the Mac fork's subagent card (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * the provider's mark in a tile with the Threads list's status mark at its corner, the title over
 * model and effort, the elapsed time, and the latest activity line. A tap opens the agent's thread.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Robot01Icon from "@hugeicons/core-free-icons/Robot01Icon";
import { useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  resolveSubagentMetadata,
  summarizeSubagentStatuses,
} from "@t3tools/client-runtime/state/subagent-display";
import { isActiveSubagentStatus } from "@t3tools/client-runtime/state/subagentRuntime";
import { formatSubagentEffort } from "@t3tools/client-runtime/state/thread-execution";
import type {
  EnvironmentId,
  OrchestrationV2Subagent,
  OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import { type ReactElement } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import type { ThreadFeedActivity } from "../src/lib/threadActivity";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { subagentCardElapsed } from "../src/features/threads/subagent-card-presentation";
import { useOpenThreadInspector } from "../src/features/threads/thread-inspector-navigation";
import {
  resolveSubagentRowPresentation,
  subagentThreadTarget,
} from "../src/features/threads/threadAgentsPresentation";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { WorkLogBlock } from "../src/features/threads/work-log-layout";
import { useEnvironments } from "../src/state/environments";
import { useEnvironmentServerConfig } from "../src/state/entities";
import { environmentThreadDetails } from "../src/state/threads";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { hasNo3yProviderMark, No3yProviderMark } from "./No3yProviderMark";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { No3yStatusMark } from "./No3yStatusMark";
import { no3ySubagentActivity, no3ySubagentSpec } from "./no3ySubagentCard";
import { no3ySubagentMarkKind } from "./no3yStatusSegments";

type SubagentItem = Extract<OrchestrationV2TurnItem, { type: "subagent" }>;
type AgentTiming = Pick<OrchestrationV2Subagent, "status" | "startedAt" | "completedAt">;

interface CardsProps {
  readonly activities: ReadonlyArray<ThreadFeedActivity>;
  readonly environmentId: EnvironmentId;
}

/** Draws the no3y cards in place of the upstream group it wraps while the redesign is on. */
export function No3ySubagentCardsSwap(props: CardsProps & { readonly children: ReactElement }) {
  const enabled = useNo3yBottomNavEnabled();
  if (!enabled) return props.children;
  return <No3ySubagentCards activities={props.activities} environmentId={props.environmentId} />;
}

function No3ySubagentCards(props: CardsProps) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const members = props.activities.flatMap(({ projectedItem }) =>
    projectedItem.item.type === "subagent" ? [projectedItem.item] : [],
  );
  const liveAgents = useAtomValue(
    environmentThreadDetails.threadAtom(scopeThreadRef(props.environmentId, members[0]!.threadId)),
    (thread) => thread?.projection.subagents,
  );
  const agents = members.map((item) => {
    const live = liveAgents?.find((agent) => agent.id === item.subagentId);
    return {
      ...item,
      item,
      status: live?.status ?? item.status,
      startedAt: live?.startedAt ?? item.startedAt,
      completedAt: live?.completedAt ?? item.completedAt,
      result: live?.result ?? item.result,
      progress: live?.progress ?? item.progress,
      model: live?.model ?? null,
      modelSelection: live?.modelSelection,
    };
  });
  return (
    <WorkLogBlock>
      <View style={{ gap: 8, paddingVertical: 4 }}>
        {agents.length > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <HugeIcon icon={Robot01Icon} size={16} color={palette.foreground} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 14, ...NO3Y_FONT.medium, color: palette.titleInk }}
            >
              {`Kicked off ${agents.length} subagents`}
              <Text style={{ ...NO3Y_FONT.regular, color: palette.metaInk }}>
                {`  ${summarizeSubagentStatuses(agents.map((agent) => agent.status))}`}
              </Text>
            </Text>
            <Elapsed agents={agents} palette={palette} />
          </View>
        ) : null}
        {agents.map((agent) => (
          <SubagentCard
            key={agent.item.id}
            agent={agent}
            environmentId={props.environmentId}
            palette={palette}
          />
        ))}
      </View>
    </WorkLogBlock>
  );
}

function Elapsed(props: {
  readonly agents: ReadonlyArray<AgentTiming>;
  readonly palette: FlatGlassPalette;
}) {
  const live = props.agents.some((agent) => isActiveSubagentStatus(agent.status));
  const nowMs = useVisibleSecondClock(live);
  const elapsed = subagentCardElapsed(props.agents, nowMs);
  return elapsed ? (
    <Text
      style={{
        fontSize: 13,
        ...NO3Y_FONT.medium,
        fontVariant: ["tabular-nums"],
        color: props.palette.foreground,
      }}
    >
      {elapsed}
    </Text>
  ) : null;
}

const TILE = 32;

function SubagentCard(props: {
  readonly agent: SubagentItem &
    Pick<OrchestrationV2Subagent, "model" | "modelSelection"> & { readonly item: SubagentItem };
  readonly environmentId: EnvironmentId;
  readonly palette: FlatGlassPalette;
}) {
  const { agent, palette } = props;
  const navigation = useNavigation();
  const openInspector = useOpenThreadInspector();
  const { presentationById } = useEnvironments();
  // A task in a linked environment runs a provider instance of that environment.
  const config = useEnvironmentServerConfig(
    agent.remoteChild?.environmentId ?? props.environmentId,
  );
  const provider = config?.providers.find(
    (candidate) => candidate.instanceId === agent.providerInstanceId,
  );
  const presentation = resolveSubagentRowPresentation(agent);
  const { modelLabel, modelSlug } = resolveSubagentMetadata({
    model: agent.model,
    modelSelection: agent.modelSelection,
    provider,
  });
  const effort = formatSubagentEffort({
    modelSlug,
    modelSelection: agent.modelSelection,
    provider,
  });
  const spec = no3ySubagentSpec({ modelLabel, effort, statusLabel: presentation.statusLabel });
  const mark = no3ySubagentMarkKind(agent.status);
  const activity = no3ySubagentActivity({
    active: isActiveSubagentStatus(agent.status),
    progress: agent.progress,
    result: agent.result,
  });
  const failed = mark === "failed";
  // A task in a linked environment opens there, if this app is connected to it.
  const target = subagentThreadTarget(agent, props.environmentId, (id) => presentationById.has(id));
  const driver = provider?.driver ?? (agent.remoteChild === undefined ? agent.driver : undefined);
  const open = () => {
    if (target === null) return;
    if (
      openInspector(
        { environmentId: props.environmentId, threadId: agent.threadId },
        { type: "thread", environmentId: target.environmentId, threadId: target.threadId },
      )
    )
      return;
    navigation.dispatch(
      StackActions.push("Thread", {
        environmentId: String(target.environmentId),
        threadId: String(target.threadId),
      }),
    );
  };
  return (
    <Pressable
      accessibilityRole={target === null ? undefined : "link"}
      accessibilityLabel={`${presentation.title}, ${presentation.statusLabel}${spec === presentation.statusLabel ? "" : `, ${spec}`}`}
      accessibilityHint={
        target !== null
          ? "Opens this agent's thread"
          : agent.remoteChild !== undefined
            ? `Runs on ${agent.remoteChild.label}`
            : "Provider-managed agent"
      }
      disabled={target === null}
      onPress={open}
      style={({ pressed }) => ({
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.controlBorder,
        backgroundColor: pressed ? palette.rowSelected : palette.controlSurface,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: TILE,
            height: TILE,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.circleFill,
          }}
        >
          {driver !== undefined && (hasNo3yProviderMark(driver) || provider !== undefined) ? (
            <No3yProviderMark provider={driver} iconUrl={provider?.iconUrl} size={20} />
          ) : (
            <HugeIcon icon={Robot01Icon} size={18} color={palette.foreground} />
          )}
          <View
            style={{
              position: "absolute",
              right: -5,
              bottom: -5,
              width: 18,
              height: 18,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.stageBackground,
            }}
          >
            <No3yStatusMark kind={mark} palette={palette} size={14} />
          </View>
        </View>
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
            {presentation.runsOn !== null ? ` · on ${presentation.runsOn}` : ""}
          </Text>
        </View>
        {agent.startedAt ? <Elapsed agents={[agent]} palette={palette} /> : null}
        {target !== null ? (
          <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.faintInk} />
        ) : null}
      </View>
      {activity !== null ? (
        <Text
          numberOfLines={activity.shape === "path" ? 1 : 2}
          ellipsizeMode={activity.shape === "path" ? "middle" : "tail"}
          style={{ fontSize: 13, color: failed ? palette.statusFailed : palette.quietInk }}
        >
          {activity.text}
        </Text>
      ) : null}
    </Pressable>
  );
}
