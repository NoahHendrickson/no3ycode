import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SymbolView } from "../../components/ui/AppSymbol";
import { ListFilterMenu } from "../layout/workspace/ListFilterMenu";
import type { EnvironmentId } from "@t3tools/contracts";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "./home-list-filter-menu";
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette } from "../../../fork/flatGlassTheme";
import {
  NO3Y_STATUS_FILTER_OPTIONS,
  NO3Y_THREAD_SORT_OPTIONS,
  type No3yStatusFilter,
  type No3yThreadSortOrder,
} from "../../../fork/mobileStatusGrouping";
/* fork:end no3y-mobile-redesign */

export function ThreadListFilters(props: {
  readonly environments: ReadonlyArray<HomeListFilterMenuEnvironment>;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  /** List padding the scroller bleeds through so pills start where row content does. */
  readonly gutter: number;
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  readonly searchQuery?: string;
  readonly onSearchQueryChange?: (query: string) => void;
  readonly statusFilter?: No3yStatusFilter;
  readonly onStatusFilterChange?: (filter: No3yStatusFilter) => void;
  readonly sortOrder?: No3yThreadSortOrder;
  readonly onSortOrderChange?: (order: No3yThreadSortOrder) => void;
  /* fork:end no3y-mobile-redesign */
}) {
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const statusFilter = props.statusFilter ?? "all";
  const sortOrder = props.sortOrder ?? "status";
  const selectedStatusLabel =
    NO3Y_STATUS_FILTER_OPTIONS.find((opt) => opt.id === statusFilter)?.label ?? "All statuses";
  const selectedSortLabel =
    NO3Y_THREAD_SORT_OPTIONS.find((opt) => opt.id === sortOrder)?.label ?? "Default (Mac order)";
  const hasAnyActiveFilter =
    props.selectedEnvironmentId !== null ||
    props.selectedProjectKey !== null ||
    statusFilter !== "all" ||
    sortOrder !== "status";
  /* fork:end no3y-mobile-redesign */
  const selectedEnvironment = props.environments.find(
    (environment) => environment.environmentId === props.selectedEnvironmentId,
  );
  const selectedProject = props.projects.find(
    (project) => project.key === props.selectedProjectKey,
  );
  return (
    <View>
      {/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */}
      {props.onSearchQueryChange ? (
        <View style={{ paddingHorizontal: 14 - props.gutter, paddingTop: 4, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              height: 38,
              borderRadius: 12,
              paddingHorizontal: 12,
              backgroundColor: palette.controlSurface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.controlBorder,
            }}
          >
            <SymbolView
              name="magnifyingglass"
              size={14}
              tintColor={palette.faintInk}
              type="monochrome"
            />
            <TextInput
              accessibilityLabel="Search threads"
              value={props.searchQuery ?? ""}
              onChangeText={props.onSearchQueryChange}
              placeholder="Search threads"
              placeholderTextColor={palette.faintInk}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                fontSize: 14,
                color: palette.foreground,
                paddingVertical: 0,
              }}
            />
            {(props.searchQuery?.length ?? 0) > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear thread search"
                hitSlop={8}
                onPress={() => props.onSearchQueryChange?.("")}
              >
                <SymbolView
                  name="xmark.circle.fill"
                  size={15}
                  tintColor={palette.faintInk}
                  type="monochrome"
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {/* fork:end no3y-mobile-redesign */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -props.gutter, overflow: "visible" }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 2, paddingBottom: 8, gap: 8 }}
      >
        {/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */}
        {props.onStatusFilterChange ? (
          <ListFilterMenu
            label={statusFilter === "all" ? "Status" : selectedStatusLabel}
            accessibilityLabel="Filter threads by status"
            active={statusFilter !== "all"}
            actions={NO3Y_STATUS_FILTER_OPTIONS.map((option) => ({
              id: option.id,
              title: option.label,
              state: option.id === statusFilter ? ("on" as const) : ("off" as const),
            }))}
            onSelect={(id) => {
              const option = NO3Y_STATUS_FILTER_OPTIONS.find((candidate) => candidate.id === id);
              if (option) props.onStatusFilterChange?.(option.id);
            }}
          />
        ) : null}
        {props.onSortOrderChange ? (
          <ListFilterMenu
            label={sortOrder === "status" ? "Sort" : selectedSortLabel}
            accessibilityLabel="Sort threads"
            active={sortOrder !== "status"}
            actions={NO3Y_THREAD_SORT_OPTIONS.map((option) => ({
              id: option.id,
              title: option.label,
              state: option.id === sortOrder ? ("on" as const) : ("off" as const),
            }))}
            onSelect={(id) => {
              const option = NO3Y_THREAD_SORT_OPTIONS.find((candidate) => candidate.id === id);
              if (option) props.onSortOrderChange?.(option.id);
            }}
          />
        ) : null}
        {/* fork:end no3y-mobile-redesign */}
        <ListFilterMenu
          label={selectedEnvironment?.label ?? "All environments"}
          accessibilityLabel="Filter threads by environment"
          active={selectedEnvironment !== undefined}
          actions={[
            {
              id: "all",
              title: "All environments",
              state: props.selectedEnvironmentId === null ? "on" : "off",
            },
            ...props.environments.map((environment) => ({
              id: JSON.stringify(environment.environmentId),
              title: environment.label,
              state:
                environment.environmentId === props.selectedEnvironmentId
                  ? ("on" as const)
                  : ("off" as const),
            })),
          ]}
          onSelect={(id) => {
            if (id === "all") props.onEnvironmentChange(null);
            else {
              const environment = props.environments.find(
                (candidate) => JSON.stringify(candidate.environmentId) === id,
              );
              if (environment) props.onEnvironmentChange(environment.environmentId);
            }
          }}
        />
        <ListFilterMenu
          label={selectedProject?.label ?? "All projects"}
          accessibilityLabel="Filter threads by project"
          active={selectedProject !== undefined}
          actions={[
            {
              id: "all",
              title: "All projects",
              state: props.selectedProjectKey === null ? "on" : "off",
            },
            ...props.projects.map((project) => ({
              id: JSON.stringify(project.key),
              title: project.label,
              state: project.key === props.selectedProjectKey ? ("on" as const) : ("off" as const),
            })),
          ]}
          onSelect={(id) => {
            if (id === "all") props.onProjectChange(null);
            else {
              const project = props.projects.find(
                (candidate) => JSON.stringify(candidate.key) === id,
              );
              if (project) props.onProjectChange(project.key);
            }
          }}
        />
        {hasAnyActiveFilter ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset thread filters"
            className="h-8 w-8 items-center justify-center"
            onPress={() => {
              props.onEnvironmentChange(null);
              props.onProjectChange(null);
              /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
              props.onStatusFilterChange?.("all");
              props.onSortOrderChange?.("status");
              /* fork:end no3y-mobile-redesign */
            }}
          >
            <SymbolView name="xmark.circle.fill" size={18} tintColorClassName="accent-icon-muted" />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
