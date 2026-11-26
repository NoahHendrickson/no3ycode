/** How the draft's project picker orders its rows — see
    `.fork/customizations.yaml#fork-new-agent-draft`. */

export const DRAFT_PROJECT_SORTS = ["recent", "name"] as const;
export type DraftProjectSort = (typeof DRAFT_PROJECT_SORTS)[number];

interface PickerEntry {
  readonly group: {
    readonly projectKey: string;
    readonly displayName: string;
    readonly pinned: boolean;
  };
}

/** Pinned projects first, each part in the chosen order. `recentKeys` ranks the projects with
    recent activity; the rest follow in their given order. */
export function orderDraftProjectEntries<TEntry extends PickerEntry>(
  entries: readonly TEntry[],
  sort: DraftProjectSort,
  recentKeys: readonly string[],
): TEntry[] {
  const recentRank = new Map(recentKeys.map((key, index) => [key, index] as const));
  const sorted =
    sort === "name"
      ? entries.toSorted((left, right) =>
          left.group.displayName.localeCompare(right.group.displayName, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        )
      : entries.toSorted(
          (left, right) =>
            (recentRank.get(left.group.projectKey) ?? Infinity) -
            (recentRank.get(right.group.projectKey) ?? Infinity),
        );
  return [
    ...sorted.filter((entry) => entry.group.pinned),
    ...sorted.filter((entry) => !entry.group.pinned),
  ];
}

export function matchesDraftProjectQuery(label: string, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return needle === "" || label.toLocaleLowerCase().includes(needle);
}
