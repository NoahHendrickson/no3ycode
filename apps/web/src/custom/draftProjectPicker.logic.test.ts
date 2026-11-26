import { describe, expect, it } from "vite-plus/test";

import { arrangeDraftProjectEntries, toggleDraftProjectPin } from "./draftProjectPicker.logic";

const entry = (projectKey: string, displayName = projectKey) => ({
  group: { projectKey, displayName },
});
const entries = [entry("crisp"), entry("Developer"), entry("app-10"), entry("app-9")];
const keys = (rows: ReadonlyArray<ReturnType<typeof entry>>) =>
  rows.map((row) => row.group.projectKey);

describe("arrangeDraftProjectEntries", () => {
  const arrange = (overrides: Partial<Parameters<typeof arrangeDraftProjectEntries>[0]>) =>
    arrangeDraftProjectEntries({
      entries,
      query: "",
      sort: "recent",
      pinnedKeys: [],
      recentKeys: ["app-9", "Developer", "crisp"],
      ...overrides,
    });

  it("orders by recent use, projects never used last", () => {
    expect(keys(arrange({}).rest)).toEqual(["app-9", "Developer", "crisp", "app-10"]);
  });

  it("orders by name, ignoring case and reading numbers as numbers", () => {
    expect(keys(arrange({ sort: "name" }).rest)).toEqual(["app-9", "app-10", "crisp", "Developer"]);
  });

  it("lists pinned projects first, in the same order", () => {
    const { pinned, rest } = arrange({ pinnedKeys: ["crisp", "app-9", "gone"] });
    expect(keys(pinned)).toEqual(["app-9", "crisp"]);
    expect(keys(rest)).toEqual(["Developer", "app-10"]);
  });

  it("keeps only names matching the query, pinned or not", () => {
    const { pinned, rest } = arrange({ query: " APP", pinnedKeys: ["app-10"] });
    expect(keys(pinned)).toEqual(["app-10"]);
    expect(keys(rest)).toEqual(["app-9"]);
  });
});

it("toggleDraftProjectPin adds and removes a pin", () => {
  expect(toggleDraftProjectPin(["a"], "b")).toEqual(["a", "b"]);
  expect(toggleDraftProjectPin(["a", "b"], "a")).toEqual(["b"]);
});
