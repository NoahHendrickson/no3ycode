/**
 * The Threads screen's search pill and its filter and sort buttons, held in the bottom tray
 * above the dock — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import ArrowUpDownIcon from "@hugeicons/core-free-icons/ArrowUpDownIcon";
import ListFilterIcon from "@hugeicons/core-free-icons/ListFilterIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import XIcon from "@hugeicons/core-free-icons/XIcon";
import type { EnvironmentId } from "@t3tools/contracts";
import { Pressable, TextInput, View } from "react-native";

import { Menu } from "../src/components/ui/Menu";
import type { MenuProps } from "../src/components/ui/Menu.types";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "../src/features/home/home-list-filter-menu";
import { NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import {
  NO3Y_STATUS_FILTER_OPTIONS,
  NO3Y_THREAD_SORT_OPTIONS,
  type No3yStatusFilter,
  type No3yThreadSortOrder,
} from "./mobileStatusGrouping";
import { NO3Y_TRAY_BAR_HEIGHT } from "./No3yBottomTray";
import { No3yCircleButton } from "./No3yControls";
import { No3yGlassLayer } from "./No3yGlass";

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
    props.statusFilter !== "all";
  const sorted = props.sortOrder !== "status";

  const filterActions: MenuProps["actions"] = [
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

  const sortActions: MenuProps["actions"] = NO3Y_THREAD_SORT_OPTIONS.map((option) => ({
    id: `sort:${option.id}`,
    title: option.label,
    state: checked(option.id === props.sortOrder),
  }));

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
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          flex: 1,
          height: NO3Y_TRAY_BAR_HEIGHT,
          borderRadius: NO3Y_TRAY_BAR_HEIGHT / 2,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 14,
        }}
      >
        <No3yGlassLayer radius={NO3Y_TRAY_BAR_HEIGHT / 2} />
        <HugeIcon icon={Search01Icon} size={18} color={palette.foreground} filled />
        <TextInput
          accessibilityLabel="Search threads"
          value={props.searchQuery}
          onChangeText={props.onSearchQueryChange}
          placeholder="Search threads"
          placeholderTextColor={palette.faintInk}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            ...NO3Y_FONT.regular,
            fontSize: 14,
            color: palette.foreground,
            paddingVertical: 0,
          }}
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
      </View>
      <Menu
        title="Filter threads"
        actions={filterActions}
        onPressAction={({ nativeEvent }) => select(nativeEvent.event)}
      >
        <No3yCircleButton
          palette={palette}
          accessibilityLabel="Filter threads"
          icon={ListFilterIcon}
          selected={filtered}
        />
      </Menu>
      <Menu
        title="Sort threads"
        actions={sortActions}
        onPressAction={({ nativeEvent }) => select(nativeEvent.event)}
      >
        <No3yCircleButton
          palette={palette}
          accessibilityLabel="Sort threads"
          icon={ArrowUpDownIcon}
          selected={sorted}
        />
      </Menu>
    </View>
  );
}
