import { expect, it } from "vite-plus/test";
import type { PullRequestSavedView } from "../../persistence/mobile-preferences";
import { pullRequestSavedViewPreferences, pullRequestViewMatches } from "./pullRequestSavedViews";

const view = {
  id: "review",
  name: "Review queue",
  environmentId: "remote",
  query: "bug",
  controls: {
    state: "open",
    involvement: "reviewing",
    filters: {
      author: "me",
      draft: "hide",
      labels: [["bug", "fix"], ["urgent"]],
      excludedLabels: ["hold", "later"],
    },
    sort: "created",
    /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
    projects: [{ projectId: "project", environmentId: "remote" }],
    /* fork:end no3y-pr-project-multiselect */
  },
} as const satisfies PullRequestSavedView;

it("recognizes a saved view regardless of filter property or label ordering", () => {
  const controls = {
    ...view.controls,
    filters: {
      excludedLabels: ["later", "hold"],
      labels: [["urgent"], ["fix", "bug"]],
      draft: "hide",
      author: "me",
    },
  } as const;
  expect(pullRequestViewMatches(view, { ...view, query: " bug ", controls })).toBe(true);
  expect(view.controls.filters.labels).toEqual([["bug", "fix"], ["urgent"]]);
  expect(
    pullRequestViewMatches(view, {
      ...view,
      /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
      controls: { ...view.controls, projects: [{ projectId: "project", environmentId: "other" }] },
      /* fork:end no3y-pr-project-multiselect */
    }),
  ).toBe(false);
});

it("applies a view's environment and controls while keeping other environments' controls", () => {
  const local = { state: "merged", involvement: "authored", filters: {}, sort: "oldest" } as const;
  expect(
    pullRequestSavedViewPreferences(
      { pullRequestListFilters: { environmentId: "local", controls: { local } } },
      view,
    ),
  ).toEqual({
    pullRequestListFilters: {
      environmentId: "remote",
      controls: { local, remote: view.controls },
    },
  });
});
