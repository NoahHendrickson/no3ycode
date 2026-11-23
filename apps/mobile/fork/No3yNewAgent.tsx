/**
 * New agent on no3y iPhone: a "New agent" header with Search, recent projects as tiles above the
 * composer (No project and All projects under them), and glass worktree, branch and machine pills
 * directly above the composer card — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useAtomValue } from "@effect/atom-react";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Folder01Icon from "@hugeicons/core-free-icons/Folder01Icon";
import FolderTreeIcon from "@hugeicons/core-free-icons/FolderTreeIcon";
import GitBranchIcon from "@hugeicons/core-free-icons/GitBranchIcon";
import LaptopIcon from "@hugeicons/core-free-icons/LaptopIcon";
import { useNavigation } from "@react-navigation/native";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useSyncExternalStore } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { KeyboardController } from "react-native-keyboard-controller";

import { ProjectFavicon } from "../src/components/ProjectFavicon";
import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import type { HomeProjectScope } from "../src/features/home/homeThreadList";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  resolveNewTaskBranchLabel,
  resolveNewTaskWorkspaceLabel,
} from "../src/features/threads/new-task-context-presentation";
import { useNewTaskFlow } from "../src/features/threads/new-task-flow-provider";
import {
  getProjectScopeSelectionTarget,
  resolveNewTaskScratchOption,
} from "../src/features/threads/new-task-project-selection";
import { resolveProjectThreadCreationBranch } from "../src/features/threads/projectThreadCreationValidation";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { useServerConfigs } from "../src/state/entities";
import { projectEnvironment } from "../src/state/projects";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { useRemoteConnectionStatus } from "../src/state/use-remote-environment-registry";
import { useNo3ySentChats } from "./no3yChatTagging";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import type { No3yDraftSurface } from "./No3yDraftSurface";
import { No3yGlassLayer } from "./No3yGlass";
import { NO3Y_FADE_IN, NO3Y_GLASS_IN, NO3Y_LAYOUT, useNo3yToggleProgress } from "./no3yMotion";
import { No3yNewAgentHeader } from "./No3yScreenHeader";
import {
  no3yProjectTileStatus,
  rankNo3yProjectTiles,
  type No3yProjectTile,
} from "./no3yProjectTiles";

const TILE_LIMIT = 8;
const PILL_HEIGHT = 34;

// The header and the tiles are published separately into the thread screen, so they share search
// through this store rather than props.
let search = { searching: false, searchQuery: "" };
const searchListeners = new Set<() => void>();
function setSearch(patch: Partial<typeof search>) {
  search = { ...search, ...patch };
  for (const listener of searchListeners) listener();
}
function subscribeSearch(listener: () => void) {
  searchListeners.add(listener);
  return () => {
    searchListeners.delete(listener);
  };
}
function useNewAgentSearch() {
  return useSyncExternalStore(subscribeSearch, () => search);
}

function NewAgentHeader() {
  // The search stays with New agent's Home tab, as it was left, across dock switches.
  const { searching, searchQuery } = useNewAgentSearch();
  return (
    <No3yNewAgentHeader
      searching={searching}
      searchQuery={searchQuery}
      onSearchingChange={(next) => setSearch({ searching: next })}
      onSearchQueryChange={(next) => setSearch({ searchQuery: next })}
    />
  );
}

function ProjectTile(props: {
  readonly tile: No3yProjectTile;
  readonly status: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
}) {
  const { palette, tile } = props;
  const project = tile.scope.representative;
  // The picked tile lifts: its wash brightens and its hairline shows, eased rather than cut.
  const lift = useNo3yToggleProgress(props.selected);
  const liftStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      lift.get(),
      [0, 1],
      [palette.cardWash, palette.activePillSurface],
    ),
    borderColor: interpolateColor(lift.get(), [0, 1], ["rgba(255,255,255,0)", palette.hairline]),
  }));
  return (
    <Animated.View
      layout={NO3Y_LAYOUT}
      entering={NO3Y_FADE_IN}
      style={[{ flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1 }, liftStyle]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tile.scope.title}, ${props.status}`}
        accessibilityState={{ selected: props.selected, disabled: props.disabled }}
        disabled={props.disabled}
        onPress={props.onPress}
        style={({ pressed }) => ({
          gap: 10,
          padding: 13,
          borderRadius: 15,
          backgroundColor: pressed ? palette.rowPressed : "transparent",
        })}
      >
        <ProjectFavicon
          environmentId={project.environmentId}
          faviconPath={project.faviconPath}
          projectIcon={project.projectIcon}
          projectTitle={tile.scope.title}
          workspaceRoot={project.workspaceRoot}
          size={28}
        />
        <View style={{ gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ ...NO3Y_FONT.medium, fontSize: 15, lineHeight: 20, color: palette.titleInk }}
          >
            {tile.scope.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...NO3Y_FONT.regular, fontSize: 13, lineHeight: 17, color: palette.metaInk }}
          >
            {props.status}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ProjectTiles(props: { readonly topInset: number; readonly bottomInset: number }) {
  const flow = useNewTaskFlow();
  const navigation = useNavigation();
  const { searchQuery } = useNewAgentSearch();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const serverConfigs = useServerConfigs();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, { reportFailure: false });
  const nowIso = useThreadListNow(threads);

  const sentChatKeys = useNo3ySentChats();
  const scopes = pickableProjectGroups(flow.projectScopes).filter(
    (scope) =>
      !scope.projects.every((project) =>
        isScratchProject(project, serverConfigs.get(project.environmentId)?.scratchWorkspaceRoot),
      ),
  );
  const selected = flow.isScratchDraft ? null : flow.selectedProject;
  const selectedScopeKey =
    selected === null
      ? null
      : (scopes.find((scope) =>
          scope.projectRefs.some(
            (ref) => ref.environmentId === selected.environmentId && ref.projectId === selected.id,
          ),
        )?.key ?? null);
  const tiles = rankNo3yProjectTiles({
    scopes,
    threads,
    sentChatKeys,
    now: nowIso,
    searchQuery,
    selectedScopeKey,
    limit: TILE_LIMIT,
  });
  const connectedIds = new Set(
    connectedEnvironments
      .filter((environment) => environment.connectionState === "connected")
      .map((environment) => environment.environmentId),
  );
  const scratchOption = resolveNewTaskScratchOption({
    environments: connectedEnvironments,
    serverConfigs,
    selectedEnvironmentId: flow.selectedEnvironmentId,
  });
  const locked = flow.submitting;
  const nowMs = Date.parse(nowIso);

  const pickScope = (scope: HomeProjectScope) =>
    flow.setProject(
      getProjectScopeSelectionTarget(scope, flow.selectedEnvironmentId, connectedIds),
    );
  const pickNoProject = async () => {
    if (!scratchOption?.ready || locked) return;
    const result = await openScratch({ environmentId: scratchOption.environmentId, input: {} });
    if (result._tag === "Success") {
      flow.setProject(result.value);
    } else if (!isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      Dialog.alert(
        "Could not start without a project",
        error instanceof Error ? error.message : "The No-project workspace could not be opened.",
      );
    }
  };
  const openAllProjects = () => {
    if (locked) return;
    void KeyboardController.dismiss({ animated: true });
    navigation.navigate("NewTaskProject");
  };

  const rows: Array<ReadonlyArray<No3yProjectTile>> = [];
  for (let index = 0; index < tiles.length; index += 2) rows.push(tiles.slice(index, index + 2));
  const linkStyle = { ...NO3Y_FONT.regular, fontSize: 14, lineHeight: 20 };

  return (
    <ScrollView
      style={{
        position: "absolute",
        top: props.topInset,
        bottom: props.bottomInset,
        left: 0,
        right: 0,
      }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "flex-end",
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
      }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          ...NO3Y_FONT.medium,
          fontSize: 13,
          color: palette.sectionInk,
          paddingHorizontal: 4,
        }}
      >
        {searchQuery.trim().length > 0 ? "Projects" : "Recent projects"}
      </Text>
      {rows.map((row) => (
        <Animated.View
          key={row[0]!.scope.key}
          layout={NO3Y_LAYOUT}
          style={{ flexDirection: "row", gap: 10 }}
        >
          {row.map((tile) => (
            <ProjectTile
              key={tile.scope.key}
              tile={tile}
              status={no3yProjectTileStatus(tile, nowMs)}
              selected={tile.scope.key === selectedScopeKey}
              disabled={locked}
              palette={palette}
              onPress={() => pickScope(tile.scope)}
            />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </Animated.View>
      ))}
      {tiles.length === 0 ? (
        <Text style={{ ...linkStyle, color: palette.quietInk, paddingHorizontal: 4 }}>
          {searchQuery.trim().length > 0 ? "No matching projects" : "No projects yet"}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
        {scratchOption !== null ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="No project"
              accessibilityState={{ selected: flow.isScratchDraft }}
              disabled={locked || !scratchOption.ready}
              hitSlop={8}
              onPress={() => void pickNoProject()}
            >
              <Text
                style={{
                  ...linkStyle,
                  color: flow.isScratchDraft ? palette.titleInk : palette.metaInk,
                }}
              >
                No project
              </Text>
            </Pressable>
            <Text style={{ ...linkStyle, color: palette.faintInk }}>·</Text>
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`All projects, ${scopes.length}`}
          disabled={locked}
          hitSlop={8}
          onPress={openAllProjects}
          style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
        >
          <Text style={{ ...linkStyle, color: palette.metaInk }}>
            All projects ({scopes.length})
          </Text>
          <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.metaInk} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DraftPill(props: {
  readonly icon: HugeIconData;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
}) {
  const { palette } = props;
  return (
    <Animated.View
      layout={NO3Y_LAYOUT}
      entering={NO3Y_GLASS_IN}
      style={{ maxWidth: "100%", flexShrink: 1 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        disabled={props.disabled}
        onPress={props.onPress}
        style={({ pressed }) => ({
          height: PILL_HEIGHT,
          maxWidth: "100%",
          flexShrink: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          opacity: props.disabled ? 0.45 : pressed ? 0.6 : 1,
        })}
      >
        <No3yGlassLayer radius={PILL_HEIGHT / 2} />
        <HugeIcon icon={props.icon} size={16} color={palette.foreground} filled />
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}
        >
          {props.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** The worktree, base branch and (with 2+ machines) machine pills; gone once the thread starts. */
function DraftPills() {
  const flow = useNewTaskFlow();
  const navigation = useNavigation();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  if (flow.selectedProject === null) return null;
  const showWorkspace = flow.canChooseWorkspace && flow.isGitRepo;
  const showMachine = flow.environments.length > 1;
  if (!showWorkspace && !showMachine) return null;

  const availableCurrentBranchName =
    flow.availableBranches.find((branch) => branch.current)?.name ??
    flow.availableBranches.find((branch) => branch.isDefault)?.name ??
    null;
  const branchName = resolveProjectThreadCreationBranch({
    workspaceMode: flow.workspaceMode,
    selectedBranch:
      flow.selectedBranchName ??
      (flow.workspaceMode === "worktree" ? availableCurrentBranchName : null),
    currentCheckoutBranch: flow.currentCheckoutBranchName,
  });
  const branchLabel = resolveNewTaskBranchLabel({
    branchName,
    startFromOrigin: flow.startFromOrigin,
    workspaceMode: flow.workspaceMode,
    pullRequestReference: flow.pullRequestReference,
  });
  const workspaceLabel = resolveNewTaskWorkspaceLabel({
    workspaceMode: flow.workspaceMode,
    worktreePath: flow.selectedWorktreePath,
  });
  const machineLabel =
    flow.environments.find(
      (environment) => environment.environmentId === flow.selectedEnvironmentId,
    )?.environmentLabel ?? "Machine";
  const locked = flow.submitting;
  const open = (route: "NewTaskBranch" | "NewTaskEnvironment") => {
    if (locked) return;
    void KeyboardController.dismiss({ animated: true });
    navigation.navigate(route);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        paddingBottom: 8,
      }}
    >
      {showWorkspace ? (
        <>
          <DraftPill
            icon={flow.workspaceMode === "worktree" ? FolderTreeIcon : Folder01Icon}
            label={workspaceLabel}
            accessibilityLabel={`${workspaceLabel}. Switches to ${flow.workspaceMode === "local" ? "a new worktree" : "the current checkout"}`}
            disabled={locked}
            palette={palette}
            onPress={() =>
              flow.setWorkspaceMode(flow.workspaceMode === "local" ? "worktree" : "local")
            }
          />
          <DraftPill
            icon={GitBranchIcon}
            label={flow.pullRequestReference ? branchLabel : (branchName ?? branchLabel)}
            accessibilityLabel={`${flow.workspaceMode === "worktree" ? "Base branch" : "Branch"}: ${branchLabel}`}
            disabled={locked}
            palette={palette}
            onPress={() => open("NewTaskBranch")}
          />
        </>
      ) : null}
      {showMachine ? (
        <DraftPill
          icon={LaptopIcon}
          label={machineLabel}
          accessibilityLabel={`Machine: ${machineLabel}. Choose machine`}
          disabled={locked}
          palette={palette}
          onPress={() => open("NewTaskEnvironment")}
        />
      ) : null}
    </View>
  );
}

export const NO3Y_NEW_AGENT_SURFACE: No3yDraftSurface = {
  header: <NewAgentHeader />,
  content: (headerInset, bottomInset) => (
    <ProjectTiles topInset={headerInset} bottomInset={bottomInset} />
  ),
  controls: <DraftPills />,
};
