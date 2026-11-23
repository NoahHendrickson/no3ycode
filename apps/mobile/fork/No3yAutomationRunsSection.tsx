/** Automation runs section for the mobile Automations screen (mirrors Mac Automations runs). */
import { useAtomValue } from "@effect/atom-react";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ProjectFavicon } from "../src/components/ProjectFavicon";
import { AppText as Text } from "../src/components/ui/AppText";
import { useSelectWorkspaceDetail } from "../src/features/layout/workspace/useSelectWorkspaceDetail";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { SettingsSection } from "../src/features/settings/components/SettingsSection";
import { relativeTime } from "../src/lib/time";
import { useProjects } from "../src/state/entities";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { flatGlassPalette } from "./flatGlassTheme";
import {
  listNo3yAutomationRunThreads,
  resolveNo3yThreadCardStatusKind,
} from "./mobileStatusGrouping";
import { No3yStatusMark } from "./No3yStatusMark";

const MAX_RECENT_RUNS = 25;

export function No3yAutomationRunsSection(props: {
  readonly environmentIds: ReadonlyArray<EnvironmentId>;
  readonly projectKeys: ReadonlySet<string> | null;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const selectDetail = useSelectWorkspaceDetail();
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const projects = useProjects();

  const projectByKey = useMemo(
    () =>
      new Map(
        projects.map((project) => [`${project.environmentId}:${project.id}`, project] as const),
      ),
    [projects],
  );

  const environmentIdSet = useMemo(
    () => (props.environmentIds.length > 0 ? new Set(props.environmentIds) : null),
    [props.environmentIds],
  );

  const runs = useMemo(
    () =>
      listNo3yAutomationRunThreads({
        threads,
        environmentIds: environmentIdSet,
        projectKeys: props.projectKeys,
      }).slice(0, MAX_RECENT_RUNS),
    [threads, environmentIdSet, props.projectKeys],
  );

  const nowIso = useThreadListNow(runs);

  return (
    <SettingsSection title={`Recent runs${runs.length > 0 ? ` (${runs.length})` : ""}`}>
      {runs.length === 0 ? (
        <Text className="p-4 text-sm text-foreground-muted">
          No automation runs yet. Runs launched by scheduled tasks appear here instead of Threads.
        </Text>
      ) : (
        runs.map((thread, index) => {
          const project = projectByKey.get(`${thread.environmentId}:${thread.projectId}`) ?? null;
          const statusKind = resolveNo3yThreadCardStatusKind(thread, { now: nowIso });
          const seed = `${thread.environmentId}:${thread.id}`;
          return (
            <View key={seed}>
              {index > 0 ? (
                <View
                  style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={thread.title}
                onPress={() =>
                  selectDetail({
                    name: "Thread",
                    params: {
                      environmentId: String(thread.environmentId),
                      threadId: String(thread.id),
                    },
                  })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  backgroundColor: pressed ? palette.rowPressed : "transparent",
                })}
              >
                {project ? (
                  <ProjectFavicon
                    environmentId={thread.environmentId}
                    faviconPath={project.faviconPath}
                    projectIcon={project.projectIcon}
                    size={16}
                    projectTitle={project.title}
                    workspaceRoot={project.workspaceRoot}
                  />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
                      lineHeight: 18,
                      fontWeight: "400",
                      color: palette.titleInk,
                    }}
                  >
                    {thread.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      lineHeight: 16,
                      color: palette.quietInk,
                    }}
                  >
                    {[
                      project?.title,
                      relativeTime(resolveThreadActivityTimestamp(thread) ?? thread.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <No3yStatusMark kind={statusKind} palette={palette} idleMode="dot" />
              </Pressable>
            </View>
          );
        })
      )}
    </SettingsSection>
  );
}
