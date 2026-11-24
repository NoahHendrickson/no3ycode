/**
 * The Pull requests filters in the bottom tray above the dock on the no3y iPhone layout, where a
 * thumb reaches them — see `.fork/customizations.yaml#no3y-pr-list-bottom-filters`. The same chips
 * and menus as upstream's row (PullRequestListFilters), led by author and project.
 */
import { useGT } from "gt-react-native";
import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import type { usePullRequestListFilters } from "../src/features/pull-requests/PullRequestListFilters";
import { ListFilterMenu } from "../src/features/layout/workspace/ListFilterMenu";

const STATE_LABELS = {
  open: "Open",
  closed: "Closed",
  merged: "Merged",
  all: "All states",
} as const;
const INVOLVEMENT_LABELS = {
  all: "All PRs",
  reviewing: "Your review",
  authored: "By you",
} as const;

export function No3yPullRequestFilterBar(props: {
  readonly filters: ReturnType<typeof usePullRequestListFilters>;
  readonly savedViewsMenu: ReactNode;
}) {
  const { filters } = props;
  const gt = useGT();
  const { select, author, selectedLabelCount, count } = filters;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Edge to edge under the tray's 16pt gutter, so chips scroll out past the screen's edge.
      style={{ marginHorizontal: -16, overflow: "visible" }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}
    >
      <ListFilterMenu
        label={
          author === "me" ? gt("By you") : (author ?? gt("Author", { $context: "filter menu" }))
        }
        active={Boolean(author)}
        accessibilityLabel={gt("Filter by author")}
        actions={filters.authorActions}
        onSelect={select}
      />
      <ListFilterMenu
        label={filters.projectLabel}
        active={filters.projectCount > 0}
        accessibilityLabel="Filter by project"
        actions={filters.projectActions}
        onSelect={select}
      />
      <ListFilterMenu
        label={STATE_LABELS[filters.state]}
        active={filters.state !== "open"}
        accessibilityLabel={gt("Filter by state")}
        actions={filters.stateActions}
        onSelect={select}
      />
      <ListFilterMenu
        label={INVOLVEMENT_LABELS[filters.involvement]}
        active={filters.involvement !== "all"}
        accessibilityLabel={gt("Filter by involvement")}
        actions={filters.involvementActions}
        onSelect={select}
      />
      <ListFilterMenu
        label={
          selectedLabelCount
            ? gt("Labels {count}", { count: selectedLabelCount })
            : gt("Labels", { $context: "filter menu" })
        }
        active={selectedLabelCount > 0}
        accessibilityLabel={gt("Filter by label")}
        actions={filters.labelActions}
        onSelect={select}
      />
      {filters.environmentLabel !== null ? (
        <ListFilterMenu
          label={filters.environmentLabel}
          accessibilityLabel={gt("Choose pull request environment")}
          actions={filters.environmentActions}
          onSelect={select}
        />
      ) : null}
      <ListFilterMenu
        label={count ? String(count) : gt("Filters")}
        icon
        active={count > 0}
        accessibilityLabel={
          count
            ? gt("{count, plural, one {Filters, {count} active} other {Filters, {count} active}}", {
                count,
              })
            : gt("More filters")
        }
        // Projects have their own chip here.
        actions={[
          ...filters.more.filter((action) => action.id !== "projects"),
          filters.reset(false),
        ]}
        onSelect={select}
      />
      {props.savedViewsMenu}
    </ScrollView>
  );
}
