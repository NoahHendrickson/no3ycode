/**
 * The Pull requests filters in the bottom tray above the dock on the no3y iPhone layout, where a
 * thumb reaches them — see `.fork/customizations.yaml#no3y-pr-list-bottom-filters`. Upstream's
 * chips (usePullRequestListFilters' `chips`), led by author and project; Project has its own chip
 * here, so the Filters menu leaves it out.
 */
import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import {
  FilterChipMenu,
  type usePullRequestListFilters,
} from "../src/features/pull-requests/PullRequestListFilters";

export function No3yPullRequestFilterBar(props: {
  readonly filters: ReturnType<typeof usePullRequestListFilters>;
  readonly savedViewsMenu: ReactNode;
}) {
  const { chips, select } = props.filters;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Edge to edge under the tray's 16pt gutter, so chips scroll out past the screen's edge.
      style={{ marginHorizontal: -16, overflow: "visible" }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}
    >
      {[
        chips.author,
        chips.project,
        chips.state,
        chips.involvement,
        chips.labels,
        chips.environment,
        {
          ...chips.filters,
          actions: [...props.filters.moreWithoutProject, props.filters.reset(false)],
        },
      ].map((chip) =>
        chip ? <FilterChipMenu key={chip.key} chip={chip} onSelect={select} /> : null,
      )}
      {props.savedViewsMenu}
    </ScrollView>
  );
}
