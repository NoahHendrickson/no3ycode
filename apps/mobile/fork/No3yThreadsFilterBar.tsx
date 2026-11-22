/**
 * The Threads screen's search field and filter/sort menu, held in the bottom tray above the
 * dock — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import ListFilterIcon from "@hugeicons/core-free-icons/ListFilterIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import XIcon from "@hugeicons/core-free-icons/XIcon";
import type { EnvironmentId } from "@t3tools/contracts";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { GlassSurface } from "../src/components/ui/GlassSurface";
import { Menu } from "../src/components/ui/Menu";
import type { MenuProps } from "../src/components/ui/Menu.types";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "../src/features/home/home-list-filter-menu";
import type { FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import {
  NO3Y_STATUS_FILTER_OPTIONS,
  NO3Y_THREAD_SORT_OPTIONS,
  type No3yStatusFilter,
  type No3yThreadSortOrder,
} from "./mobileStatusGrouping";
import { NO3Y_TRAY_BAR_HEIGHT } from "./No3yBottomTray";

const checked = (on: boolean) => (on ? ("on" as const) : ("off" as const));

export function No3yThreadsFilterBar(props: {
  readonly palette: FlatGlassPalette;
  readonly environments: ReadonlyArray<HomeListFilterMenuEnvironment>;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly statusFilter: No3yStatusFilter;
  readonly onStatusFilterChange: (filter: No3yStatusFilter) => void;
  readonly sortOrder: No3yThreadSortOrder;
  readonly onSortOrderChange: (order: No3yThreadSortOrder) => void;
}) {
  const { palette } = props;
  const filtered =
    props.selectedEnvironmentId !== null ||
    props.selectedProjectKey !== null ||
    props.statusFilter !== "all" ||
    props.sortOrder !== "status";

  const actions: MenuProps["actions"] = [
    {
      id: "status",
      title: "Status",
      displayInline: true,
      subactions: NO3Y_STATUS_FILTER_OPTIONS.map((option) => ({
        id: `status:${option.id}`,
        title: option.label,
        state: checked(option.id === props.statusFilter),
      })),
    },
    {
      id: "sort",
      title: "Sort",
      displayInline: true,
      subactions: NO3Y_THREAD_SORT_OPTIONS.map((option) => ({
        id: `sort:${option.id}`,
        title: option.label,
        state: checked(option.id === props.sortOrder),
      })),
    },
    {
      id: "environment",
      title: "Environment",
      subtitle:
        props.environments.find(
          (environment) => environment.environmentId === props.selectedEnvironmentId,
        )?.label ?? "All environments",
      subactions: [
        {
          id: "environment:all",
          title: "All environments",
          state: checked(props.selectedEnvironmentId === null),
        },
        ...props.environments.map((environment) => ({
          id: `environment:${JSON.stringify(environment.environmentId)}`,
          title: environment.label,
          state: checked(environment.environmentId === props.selectedEnvironmentId),
        })),
      ],
    },
    {
      id: "project",
      title: "Project",
      subtitle:
        props.projects.find((project) => project.key === props.selectedProjectKey)?.label ??
        "All projects",
      subactions: [
        {
          id: "project:all",
          title: "All projects",
          state: checked(props.selectedProjectKey === null),
        },
        ...props.projects.map((project) => ({
          id: `project:${JSON.stringify(project.key)}`,
          title: project.label,
          state: checked(project.key === props.selectedProjectKey),
        })),
      ],
    },
    ...(filtered ? [{ id: "reset", title: "Reset filters" }] : []),
  ];

  const select = (id: string) => {
    const split = id.indexOf(":");
    const group = split < 0 ? id : id.slice(0, split);
    const value = split < 0 ? "" : id.slice(split + 1);
    if (group === "status") {
      const option = NO3Y_STATUS_FILTER_OPTIONS.find((candidate) => candidate.id === value);
      if (option) props.onStatusFilterChange(option.id);
    } else if (group === "sort") {
      const option = NO3Y_THREAD_SORT_OPTIONS.find((candidate) => candidate.id === value);
      if (option) props.onSortOrderChange(option.id);
    } else if (group === "environment") {
      if (value === "all") return props.onEnvironmentChange(null);
      const environment = props.environments.find(
        (candidate) => JSON.stringify(candidate.environmentId) === value,
      );
      if (environment) props.onEnvironmentChange(environment.environmentId);
    } else if (group === "project") {
      if (value === "all") return props.onProjectChange(null);
      const project = props.projects.find((candidate) => JSON.stringify(candidate.key) === value);
      if (project) props.onProjectChange(project.key);
    } else if (group === "reset") {
      props.onEnvironmentChange(null);
      props.onProjectChange(null);
      props.onStatusFilterChange("all");
      props.onSortOrderChange("status");
    }
  };

  const glass = {
    glassEffectStyle: "regular" as const,
    tintColor: palette.panelTint,
    fallbackColor: palette.panelFallback,
  };
  const pill = {
    height: NO3Y_TRAY_BAR_HEIGHT,
    borderRadius: NO3Y_TRAY_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.panelBorder,
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <GlassSurface
        {...glass}
        style={{
          ...pill,
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 14,
          paddingRight: 10,
        }}
      >
        <HugeIcon icon={Search01Icon} size={16} color={palette.faintInk} />
        <TextInput
          accessibilityLabel="Search threads"
          value={props.searchQuery}
          onChangeText={props.onSearchQueryChange}
          placeholder="Search threads"
          placeholderTextColor={palette.faintInk}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, fontSize: 15, color: palette.foreground, paddingVertical: 0 }}
        />
        {props.searchQuery.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear thread search"
            hitSlop={8}
            onPress={() => props.onSearchQueryChange("")}
          >
            <HugeIcon icon={XIcon} size={16} color={palette.quietInk} />
          </Pressable>
        ) : null}
      </GlassSurface>
      <Menu
        title="Filter and sort threads"
        actions={actions}
        onPressAction={({ nativeEvent }) => select(nativeEvent.event)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter and sort threads"
          accessibilityState={{ selected: filtered }}
          hitSlop={4}
        >
          <GlassSurface
            {...glass}
            style={{
              ...pill,
              width: NO3Y_TRAY_BAR_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
              borderColor: filtered ? palette.peekRing : palette.panelBorder,
            }}
          >
            <HugeIcon
              icon={ListFilterIcon}
              size={18}
              color={filtered ? palette.foreground : palette.quietInk}
            />
          </GlassSurface>
        </Pressable>
      </Menu>
    </View>
  );
}
