import { describe, expect, it } from "vite-plus/test";

import { matchesDraftProjectQuery, orderDraftProjectEntries } from "./draftProjectPicker.logic";

const entry = (projectKey: string, pinned = false) => ({
  group: { projectKey, displayName: projectKey, pinned },
});
const keys = (rows: ReadonlyArray<ReturnType<typeof entry>>) =>
  rows.map((row) => row.group.projectKey);

describe("orderDraftProjectEntries", () => {
  const entries = [entry("crisp"), entry("Developer"), entry("app-10"), entry("app-9")];
  const recentKeys = ["app-9", "Developer", "crisp"];

  it("orders by recent activity, projects with none last in their given order", () => {
    expect(keys(orderDraftProjectEntries(entries, "recent", recentKeys))).toEqual([
      "app-9",
      "Developer",
      "crisp",
      "app-10",
    ]);
  });

  it("orders by name, ignoring case and reading numbers as numbers", () => {
    expect(keys(orderDraftProjectEntries(entries, "name", recentKeys))).toEqual([
      "app-9",
      "app-10",
      "crisp",
      "Developer",
    ]);
  });

  it("lists pinned projects first, in the same order", () => {
    const withPins = [
      entry("crisp", true),
      entry("Developer"),
      entry("app-10"),
      entry("app-9", true),
    ];
    expect(keys(orderDraftProjectEntries(withPins, "recent", recentKeys))).toEqual([
      "app-9",
      "crisp",
      "Developer",
      "app-10",
    ]);
  });
});

it("matchesDraftProjectQuery ignores case and surrounding space", () => {
  expect(matchesDraftProjectQuery("noey-ui", " UI ")).toBe(true);
  expect(matchesDraftProjectQuery("crisp", "noey")).toBe(false);
  expect(matchesDraftProjectQuery("crisp", "")).toBe(true);
});
