/**
 * New agent on no3y iPhone: project glass rows collapse into a top dropdown with "What should we
 * do?" below once picked, plus worktree/branch/machine pills above the composer — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useAtomValue } from "@effect/atom-react";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
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
import { GlassContainer } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { KeyboardController, useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

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
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../src/native/native-glass";
import { useServerConfigs } from "../src/state/entities";
import { projectEnvironment } from "../src/state/projects";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { useRemoteConnectionStatus } from "../src/state/use-remote-environment-registry";
import { useNo3ySentChats } from "./no3yChatTagging";
import {
  flatGlassPalette,
  NO3Y_BOTTOM_NAV_CLEARANCE,
  NO3Y_FONT,
  type FlatGlassPalette,
} from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import type { No3yDraftSurface } from "./No3yDraftSurface";
import { No3yBottomFade } from "./No3yBottomFade";
import { No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_IN, NO3Y_LAYOUT, useNo3yToggleProgress } from "./no3yMotion";
import { No3yNewAgentHeader } from "./No3yScreenHeader";
import {
  isNo3yProjectPickerExpanded,
  no3yCollapsedRowTranslateY,
  no3yExpandScrollOffset,
  no3yRowVisibleForCollapse,
  rankNo3yProjectTiles,
} from "./no3yProjectTiles";

const PILL_HEIGHT = 34;
const ROW_HEIGHT = 48;
const ROW_GAP = 8;
const ROW_PITCH = ROW_HEIGHT + ROW_GAP;
const TOP_FADE = 20;
const SECTION_LABEL_HEIGHT = 18;
const LIST_HEADER_OFFSET = SECTION_LABEL_HEIGHT + ROW_GAP;
/** Below ROW_GAP so rows stay distinct pills at rest and liquid-merge as they collapse together. */
const GLASS_MERGE_SPACING = 6;
const MORPH_TIMING = {
  duration: 260,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.System,
} as const;

type PickerPhase = "expanded" | "collapsing" | "collapsed" | "expanding";

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
  readonly rowIndex: number;
  readonly label: string;
  readonly leading: ReactNode;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly palette: FlatGlassPalette;
  readonly phase: PickerPhase;
  readonly participatesInCollapse: boolean;
  readonly collapse: SharedValue<number>;
  readonly anchorScrollY: SharedValue<number>;
  readonly onPress: () => void;
}) {
  const { palette, rowIndex, selected, participatesInCollapse, collapse, anchorScrollY } = props;
  // The picked row brightens and shows its hairline over the glass while expanded, easing out as
  // it settles into the collapsed dropdown pill.
  const lift = useNo3yToggleProgress(selected);
  const liftStyle = useAnimatedStyle(() => {
    const strength = lift.get() * (1 - collapse.get());
    return {
      backgroundColor: interpolateColor(
        strength,
        [0, 1],
        ["rgba(255,255,255,0)", palette.activePillSurface],
      ),
      borderColor: interpolateColor(strength, [0, 1], ["rgba(255,255,255,0)", palette.hairline]),
    };
  });
  const rowStyle = useAnimatedStyle(() => {
    const progress = collapse.get();
    if (!participatesInCollapse || progress === 0) {
      return { transform: [{ translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }] };
    }
    const deltaY = no3yCollapsedRowTranslateY({
      rowIndex,
      scrollY: anchorScrollY.get(),
      headerOffset: LIST_HEADER_OFFSET,
      rowPitch: ROW_PITCH,
    });
    if (selected) {
      return { transform: [{ translateY: progress * deltaY }, { scaleX: 1 }, { scaleY: 1 }] };
    }
    return {
      transform: [
        { translateY: progress * deltaY },
        { scaleX: interpolate(progress, [0, 1], [1, 0.94], Extrapolation.CLAMP) },
        { scaleY: interpolate(progress, [0, 1], [1, 0.86], Extrapolation.CLAMP) },
      ],
    };
  });
  // Only sibling content fades — never an ancestor of No3yGlassLayer, or UIGlassEffect drops out.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: selected ? 1 : interpolate(collapse.get(), [0, 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.get(), [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.get(), [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { rotate: `${interpolate(collapse.get(), [0.45, 1], [-90, 0], Extrapolation.CLAMP)}deg` },
    ],
  }));
  return (
    <Animated.View
      layout={props.phase === "expanded" ? NO3Y_LAYOUT : undefined}
      style={{ zIndex: selected && props.phase !== "expanded" ? 20 : 1 }}
    >
      <Animated.View style={rowStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.label}
          accessibilityState={{ selected, disabled: props.disabled }}
          disabled={props.disabled}
          onPress={props.onPress}
          style={({ pressed }) => ({
            height: ROW_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <No3yGlassLayer
            radius={ROW_HEIGHT / 2}
            active={selected || props.phase !== "collapsing"}
          />
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
          <Animated.View
            style={[
              { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
              contentStyle,
            ]}
          >
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
          </Animated.View>
          {selected ? (
            <View
              style={{
                width: 20,
                height: 20,
                marginLeft: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: "absolute", alignItems: "center", justifyContent: "center" },
                  tickStyle,
                ]}
              >
                <HugeIcon icon={Tick02Icon} size={16} color={palette.metaInk} strokeWidth={2} />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: "absolute", alignItems: "center", justifyContent: "center" },
                  chevronStyle,
                ]}
              >
                <HugeIcon
                  icon={ArrowDown01Icon}
                  size={18}
                  color={palette.metaInk}
                  strokeWidth={2}
                />
              </Animated.View>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
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
  const reducedMotion = useReducedMotion();
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
  const selectedScope =
    selected === null
      ? null
      : (scopes.find((scope) =>
          scope.projectRefs.some(
            (ref) => ref.environmentId === selected.environmentId && ref.projectId === selected.id,
          ),
        ) ?? null);
  const selectedScopeKey = selectedScope?.key ?? null;
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
  const searching = searchQuery.trim().length > 0;
  const noProjectRow =
    scratchOption === null ||
    (searching && !"no project".includes(searchQuery.trim().toLowerCase()))
      ? null
      : scratchOption;

  const [pickerOpen, setPickerOpen] = useState(false);
  const expanded = isNo3yProjectPickerExpanded({ picked, pickerOpen, searchOpen });
  const [phase, setPhase] = useState<PickerPhase>(() => (expanded ? "expanded" : "collapsed"));
  const collapse = useSharedValue(expanded ? 0 : 1);
  const anchorScrollY = useSharedValue(0);
  const scrollYRef = useRef(0);
  const pickingScratchRef = useRef(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [expandScrollY, setExpandScrollY] = useState(0);
  const [transitionScrollY, setTransitionScrollY] = useState(0);
  const prevExpandedRef = useRef(expanded);

  const rowOffset = noProjectRow === null ? 0 : 1;
  const rowCount = rowOffset + tiles.length;
  const selectedIndex = !picked
    ? -1
    : flow.isScratchDraft
      ? noProjectRow === null
        ? -1
        : 0
      : selectedScopeKey === null
        ? -1
        : (() => {
            const tileIndex = tiles.findIndex((tile) => tile.scope.key === selectedScopeKey);
            return tileIndex < 0 ? -1 : tileIndex + rowOffset;
          })();

  useEffect(() => {
    if (expanded === prevExpandedRef.current) return;
    prevExpandedRef.current = expanded;
    if (!expanded) {
      if (reducedMotion || selectedIndex < 0) {
        collapse.set(1);
        scrollYRef.current = 0;
        // oxlint-disable-next-line react/set-state-in-effect -- settles immediately under Reduce Motion or when the selected project is outside the current list
        setPhase("collapsed");
        if (search.searchQuery.length > 0) setSearch({ searchQuery: "" });
        return;
      }
      const capturedScroll = scrollYRef.current;
      anchorScrollY.set(capturedScroll);
      setTransitionScrollY(capturedScroll);
      setPhase("collapsing");
      return;
    }
    const targetScroll =
      phase === "collapsing"
        ? scrollYRef.current
        : searchOpen
          ? 0
          : no3yExpandScrollOffset({
              selectedIndex,
              rowCount,
              rowPitch: ROW_PITCH,
              topPadding: TOP_FADE,
              headerOffset: LIST_HEADER_OFFSET,
              bottomInset: props.bottomInset,
              viewportHeight,
            });
    scrollYRef.current = targetScroll;
    anchorScrollY.set(targetScroll);
    setExpandScrollY(targetScroll);
    setTransitionScrollY(targetScroll);
    if (reducedMotion) {
      collapse.set(0);
      setPhase("expanded");
      return;
    }
    setPhase("expanding");
  }, [
    anchorScrollY,
    collapse,
    expanded,
    phase,
    props.bottomInset,
    reducedMotion,
    rowCount,
    searchOpen,
    selectedIndex,
    viewportHeight,
  ]);

  useEffect(() => {
    const finishCollapse = () => {
      scrollYRef.current = 0;
      setPhase("collapsed");
      if (search.searchQuery.length > 0) setSearch({ searchQuery: "" });
    };
    const finishExpand = () => {
      setPhase("expanded");
    };
    if (phase === "collapsing") {
      collapse.set(
        withTiming(1, MORPH_TIMING, (finished) => {
          if (finished) scheduleOnRN(finishCollapse);
        }),
      );
    } else if (phase === "expanding") {
      collapse.set(
        withTiming(0, MORPH_TIMING, (finished) => {
          if (finished) scheduleOnRN(finishExpand);
        }),
      );
    }
  }, [collapse, phase]);

  const closePickerAfterPick = () => {
    setPickerOpen(false);
    // Close the search bar immediately while keeping searchQuery until the collapse settles so
    // the rows on screen morph together instead of flashing the full list for one frame.
    if (searchOpen) setSearch({ searching: false });
  };

  const pickScope = (scope: HomeProjectScope) => {
    if (locked) return;
    void Haptics.selectionAsync().catch(() => {});
    if (!picked || scope.key !== selectedScopeKey) {
      flow.setProject(
        getProjectScopeSelectionTarget(scope, flow.selectedEnvironmentId, connectedIds),
      );
    }
    closePickerAfterPick();
  };

  const pickNoProject = async () => {
    if (!scratchOption?.ready || locked || pickingScratchRef.current) return;
    void Haptics.selectionAsync().catch(() => {});
    if (picked && flow.isScratchDraft) {
      closePickerAfterPick();
      return;
    }
    pickingScratchRef.current = true;
    const result = await openScratch({ environmentId: scratchOption.environmentId, input: {} });
    pickingScratchRef.current = false;
    if (result._tag === "Success") {
      flow.setProject(result.value);
      closePickerAfterPick();
    } else if (!isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      Dialog.alert(
        "Could not start without a project",
        error instanceof Error ? error.message : "The No-project workspace could not be opened.",
      );
    }
  };

  const reopenPicker = () => {
    if (locked) return;
    void Haptics.selectionAsync().catch(() => {});
    void KeyboardController.dismiss({ animated: true });
    setPickerOpen(true);
  };

  const sectionLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(collapse.get(), [0, 0.35], [0, -8], Extrapolation.CLAMP) },
    ],
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.get(), [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(collapse.get(), [0.45, 1], [10, 0], Extrapolation.CLAMP) },
    ],
  }));

  const selectedLabel = flow.isScratchDraft
    ? "No project"
    : (selectedScope?.title ?? flow.selectedProject?.title ?? "Project");
  const selectedLeading = flow.isScratchDraft ? (
    <HugeIcon icon={Folder01Icon} size={20} color={palette.quietInk} />
  ) : flow.selectedProject ? (
    <ProjectFavicon
      environmentId={
        selectedScope?.representative.environmentId ?? flow.selectedProject.environmentId
      }
      faviconPath={selectedScope?.representative.faviconPath ?? flow.selectedProject.faviconPath}
      projectIcon={selectedScope?.representative.projectIcon ?? flow.selectedProject.projectIcon}
      projectTitle={selectedLabel}
      workspaceRoot={
        selectedScope?.representative.workspaceRoot ?? flow.selectedProject.workspaceRoot
      }
      size={20}
    />
  ) : (
    <HugeIcon icon={Folder01Icon} size={20} color={palette.quietInk} />
  );

  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const insets = useSafeAreaInsets();
  // When the keyboard is up, KeyboardStickyView moves the composer over the dock band that
  // bottomInset still counts, so subtract that overlap when centring the prompt above it.
  const heroBottomInset = keyboardVisible
    ? Math.max(0, props.bottomInset - (insets.bottom + NO3Y_BOTTOM_NAV_CLEARANCE))
    : props.bottomInset;
  const availableHeroHeight =
    viewportHeight > 0 ? viewportHeight - (TOP_FADE + ROW_HEIGHT) - heroBottomInset : 120;
  const showHero = picked && availableHeroHeight >= 40;

  const listRows = (
    <>
      {noProjectRow === null ? null : (
        <ProjectRow
          rowIndex={0}
          label="No project"
          leading={<HugeIcon icon={Folder01Icon} size={20} color={palette.quietInk} />}
          selected={picked && flow.isScratchDraft}
          disabled={locked || !noProjectRow.ready}
          palette={palette}
          phase={phase}
          participatesInCollapse={
            (picked && flow.isScratchDraft) ||
            no3yRowVisibleForCollapse({
              rowIndex: 0,
              scrollY: transitionScrollY,
              headerOffset: LIST_HEADER_OFFSET,
              rowPitch: ROW_PITCH,
              viewportHeight,
            })
          }
          collapse={collapse}
          anchorScrollY={anchorScrollY}
          onPress={() => void pickNoProject()}
        />
      )}
      {tiles.map((tile, index) => {
        const rowIndex = index + rowOffset;
        const isSelected = tile.scope.key === selectedScopeKey;
        return (
          <ProjectRow
            key={tile.scope.key}
            rowIndex={rowIndex}
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
            selected={isSelected}
            disabled={locked}
            palette={palette}
            phase={phase}
            participatesInCollapse={
              isSelected ||
              no3yRowVisibleForCollapse({
                rowIndex,
                scrollY: transitionScrollY,
                headerOffset: LIST_HEADER_OFFSET,
                rowPitch: ROW_PITCH,
                viewportHeight,
              })
            }
            collapse={collapse}
            anchorScrollY={anchorScrollY}
            onPress={() => pickScope(tile.scope)}
          />
        );
      })}
    </>
  );

  return (
    // The list runs to the screen bottom, under the composer (whose scrim fades it) and the
    // keyboard, and pads its end clear of them: its frame never depends on the keyboard or the
    // composer's measured height, which once left it three rows tall after a search.
    <>
      {showHero ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: props.topInset + TOP_FADE + ROW_HEIGHT,
              bottom: heroBottomInset,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            },
            heroStyle,
          ]}
        >
          <Text
            style={{
              ...NO3Y_FONT.medium,
              fontSize: 22,
              lineHeight: 28,
              letterSpacing: -0.3,
              color: palette.foreground,
              textAlign: "center",
            }}
          >
            What should we do?
          </Text>
        </Animated.View>
      ) : null}

      {phase === "collapsed" ? (
        <View
          pointerEvents="box-none"
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            top: props.topInset,
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: TOP_FADE,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Project: ${selectedLabel}`}
            accessibilityHint="Opens the project list"
            accessibilityState={{ expanded: false, disabled: locked }}
            disabled={locked}
            onPress={reopenPicker}
            style={({ pressed }) => ({
              height: ROW_HEIGHT,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 16,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <No3yGlassLayer radius={ROW_HEIGHT / 2} />
            {selectedLeading}
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
              {selectedLabel}
            </Text>
            <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
              <HugeIcon icon={ArrowDown01Icon} size={18} color={palette.metaInk} strokeWidth={2} />
            </View>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ position: "absolute", top: props.topInset, bottom: 0, left: 0, right: 0 }}
          contentOffset={{ x: 0, y: expandScrollY }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "flex-start",
            paddingHorizontal: 16,
            paddingTop: TOP_FADE,
            paddingBottom: props.bottomInset,
          }}
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          onScroll={(event) => {
            scrollYRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          scrollEnabled={phase === "expanded"}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              {
                height: SECTION_LABEL_HEIGHT,
                marginBottom: ROW_GAP,
                justifyContent: "center",
                paddingHorizontal: 4,
              },
              sectionLabelStyle,
            ]}
          >
            <Text
              style={{
                ...NO3Y_FONT.medium,
                fontSize: 13,
                color: palette.sectionInk,
              }}
            >
              {picked ? "Projects" : "Pick a project"}
            </Text>
          </Animated.View>
          {NATIVE_LIQUID_GLASS_SUPPORTED ? (
            <GlassContainer spacing={GLASS_MERGE_SPACING} style={{ gap: ROW_GAP }}>
              {listRows}
            </GlassContainer>
          ) : (
            <View style={{ gap: ROW_GAP }}>{listRows}</View>
          )}
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
      )}
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
