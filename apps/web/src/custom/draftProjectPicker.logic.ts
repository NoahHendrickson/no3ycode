/** How the draft's project picker lists its rows — see
    `.fork/customizations.yaml#fork-new-agent-draft`. */

export type DraftProjectSort = "recent" | "name";

interface PickerEntry {
  readonly group: { readonly projectKey: string; readonly displayName: string };
}

/** The rows a query leaves, pinned ones first, each part in the chosen order. `recentKeys` is
    every project key, most recently used first. */
export function arrangeDraftProjectEntries<TEntry extends PickerEntry>(input: {
  readonly entries: readonly TEntry[];
  readonly query: string;
  readonly sort: DraftProjectSort;
  readonly pinnedKeys: readonly string[];
  readonly recentKeys: readonly string[];
}): { readonly pinned: TEntry[]; readonly rest: TEntry[] } {
  const matching = input.entries.filter((entry) =>
    matchesDraftProjectQuery(entry.group.displayName, input.query),
  );
  const recentRank = new Map(input.recentKeys.map((key, index) => [key, index] as const));
  const sorted =
    input.sort === "name"
      ? matching.toSorted((left, right) =>
          left.group.displayName.localeCompare(right.group.displayName, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        )
      : matching.toSorted(
          (left, right) =>
            (recentRank.get(left.group.projectKey) ?? Infinity) -
            (recentRank.get(right.group.projectKey) ?? Infinity),
        );
  const pinnedKeys = new Set(input.pinnedKeys);
  return {
    pinned: sorted.filter((entry) => pinnedKeys.has(entry.group.projectKey)),
    rest: sorted.filter((entry) => !pinnedKeys.has(entry.group.projectKey)),
  };
}

export function matchesDraftProjectQuery(label: string, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return needle === "" || label.toLocaleLowerCase().includes(needle);
}

export function toggleDraftProjectPin(pinnedKeys: readonly string[], key: string): string[] {
  return pinnedKeys.includes(key)
    ? pinnedKeys.filter((pinned) => pinned !== key)
    : [...pinnedKeys, key];
}
