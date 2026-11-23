/**
 * New agent on no3y iPhone: a "New agent" header with Search, No project and every project as
 * glass rows scrolling above the composer, none picked until the user picks, and glass worktree,
 * branch and machine pills directly above the composer card once one is — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useAtomValue } from "@effect/atom-react";
import Folder01Icon from "@hugeicons/core-free-icons/Folder01Icon";
import FolderTreeIcon from "@hugeicons/core-free-icons/FolderTreeIcon";
import GitBranchIcon from "@hugeicons/core-free-icons/GitBranchIcon";
import LaptopIcon from "@hugeicons/core-free-icons/LaptopIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { useNavigation } from "@react-navigation/native";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useSyncExternalStore, type ReactNode } from "react";
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
import { useServerConfigs } from "../src/state/entities";
import { projectEnvironment } from "../src/state/projects";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { useRemoteConnectionStatus } from "../src/state/use-remote-environment-registry";
import { useNo3ySentChats } from "./no3yChatTagging";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import type { No3yDraftSurface } from "./No3yDraftSurface";
import { No3yBottomFade } from "./No3yBottomFade";
import { No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_IN, NO3Y_LAYOUT, useNo3yToggleProgress } from "./no3yMotion";
import { No3yNewAgentHeader } from "./No3yScreenHeader";
import { rankNo3yProjectTiles } from "./no3yProjectTiles";

const PILL_HEIGHT = 34;
const ROW_HEIGHT = 48;
const ROW_GAP = 8;
const TOP_FADE = 20;

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

function ProjectRow(props: {
  readonly label: string;
  readonly leading: ReactNode;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
}) {
  const { palette } = props;
  // The picked row brightens and shows its hairline over the glass, eased rather than cut.
  const lift = useNo3yToggleProgress(props.selected);
  const liftStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      lift.get(),
      [0, 1],
      ["rgba(255,255,255,0)", palette.activePillSurface],
    ),
    borderColor: interpolateColor(lift.get(), [0, 1], ["rgba(255,255,255,0)", palette.hairline]),
  }));
  return (
    // Glass only ever moves by transform, so the row grows in rather than fading.
    <Animated.View layout={NO3Y_LAYOUT} entering={NO3Y_GLASS_IN}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label}
        accessibilityState={{ selected: props.selected, disabled: props.disabled }}
        disabled={props.disabled}
        onPress={props.onPress}
        style={({ pressed }) => ({
          height: ROW_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <No3yGlassLayer radius={ROW_HEIGHT / 2} />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              borderRadius: ROW_HEIGHT / 2,
              borderWidth: 1,
            },
            liftStyle,
          ]}
        />
        {props.leading}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            ...NO3Y_FONT.medium,
            fontSize: 16,
            lineHeight: 20,
            color: palette.titleInk,
          }}
        >
          {props.label}
        </Text>
        {props.selected ? (
          <HugeIcon icon={Tick02Icon} size={16} color={palette.metaInk} strokeWidth={2} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function ProjectTiles(props: {
  readonly topInset: number;
  readonly bottomInset: number;
  /** Only a project the user picked reads as selected (New agent's tab starts with none). */
  readonly requirePick: boolean;
}) {
  const flow = useNewTaskFlow();
  const { searching: searchOpen, searchQuery } = useNewAgentSearch();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const serverConfigs = useServerConfigs();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, { reportFailure: false });
  const sentChatKeys = useNo3ySentChats();
  const scopes = pickableProjectGroups(flow.projectScopes).filter(
    (scope) =>
      !scope.projects.every((project) =>
        isScratchProject(project, serverConfigs.get(project.environmentId)?.scratchWorkspaceRoot),
      ),
  );
  const picked = !props.requirePick || flow.selectedProjectKey !== null;
  const selected = !picked || flow.isScratchDraft ? null : flow.selectedProject;
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
    searchQuery,
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
  const searching = searchQuery.trim().length > 0;
  const noProjectRow =
    scratchOption === null ||
    (searching && !"no project".includes(searchQuery.trim().toLowerCase()))
      ? null
      : scratchOption;

  return (
    // The list runs to the screen bottom, under the composer (whose scrim fades it) and the
    // keyboard, and pads its end clear of them: its frame never depends on the keyboard or the
    // composer's measured height, which once left it three rows tall after a search.
    <>
      <ScrollView
        style={{ position: "absolute", top: props.topInset, bottom: 0, left: 0, right: 0 }}
        contentContainerStyle={{
          flexGrow: 1,
          // At rest the rows sit just above the composer; a search lists its matches from the top.
          justifyContent: searchOpen ? "flex-start" : "flex-end",
          gap: ROW_GAP,
          paddingHorizontal: 16,
          paddingTop: TOP_FADE,
          paddingBottom: props.bottomInset,
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
          {picked ? "Projects" : "Pick a project"}
        </Text>
        {noProjectRow === null ? null : (
          <ProjectRow
            label="No project"
            leading={<HugeIcon icon={Folder01Icon} size={20} color={palette.quietInk} />}
            selected={picked && flow.isScratchDraft}
            disabled={locked || !noProjectRow.ready}
            palette={palette}
            onPress={() => void pickNoProject()}
          />
        )}
        {tiles.map((tile) => (
          <ProjectRow
            key={tile.scope.key}
            label={tile.scope.title}
            leading={
              <ProjectFavicon
                environmentId={tile.scope.representative.environmentId}
                faviconPath={tile.scope.representative.faviconPath}
                projectIcon={tile.scope.representative.projectIcon}
                projectTitle={tile.scope.title}
                workspaceRoot={tile.scope.representative.workspaceRoot}
                size={20}
              />
            }
            selected={tile.scope.key === selectedScopeKey}
            disabled={locked}
            palette={palette}
            onPress={() => pickScope(tile.scope)}
          />
        ))}
        {tiles.length === 0 && noProjectRow === null ? (
          <Text
            style={{
              ...NO3Y_FONT.regular,
              fontSize: 14,
              lineHeight: 20,
              color: palette.quietInk,
              paddingHorizontal: 4,
            }}
          >
            {searching ? "No matching projects" : "No projects yet"}
          </Text>
        ) : null}
      </ScrollView>
      {/* Rows scroll out under the header through a fade, not a cut. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: props.topInset,
          left: 0,
          right: 0,
          height: TOP_FADE,
          transform: [{ scaleY: -1 }],
        }}
      >
        <No3yBottomFade color={palette.stageBackground} height={TOP_FADE} />
      </View>
    </>
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
function DraftPills(props: { readonly requirePick: boolean }) {
  const flow = useNewTaskFlow();
  const navigation = useNavigation();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  // Nothing to set up for until a project is picked.
  if (flow.selectedProject === null || (props.requirePick && flow.selectedProjectKey === null)) {
    return null;
  }
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
    <ProjectTiles topInset={headerInset} bottomInset={bottomInset} requirePick={false} />
  ),
  controls: <DraftPills requirePick={false} />,
};

/** New agent's Home tab: it starts with no project and waits for one to be picked on its rows. */
export const NO3Y_NEW_AGENT_TAB_SURFACE: No3yDraftSurface = {
  header: <NewAgentHeader />,
  content: (headerInset, bottomInset) => (
    <ProjectTiles topInset={headerInset} bottomInset={bottomInset} requirePick />
  ),
  controls: <DraftPills requirePick />,
  picksProjectInPlace: true,
};
