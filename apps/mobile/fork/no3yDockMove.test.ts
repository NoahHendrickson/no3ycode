import { describe, expect, it } from "vite-plus/test";

import { no3yRoutesUnderSheets } from "./no3yDockMove";

describe("no3y dock under sheets", () => {
  const isSheet = (name: string) => name === "No3yUsage" || name === "NewTaskThreadSettings";
  const names = (routes: ReadonlyArray<{ readonly name: string }>) =>
    no3yRoutesUnderSheets(routes, isSheet).map((route) => route.name);

  it("reads the routes beneath any sheets on top, so a sheet never hides the dock", () => {
    expect(names([{ name: "Home" }, { name: "No3yUsage" }])).toEqual(["Home"]);
    expect(
      names([
        { name: "Home" },
        { name: "Thread" },
        { name: "NewTaskThreadSettings" },
        { name: "No3yUsage" },
      ]),
    ).toEqual(["Home", "Thread"]);
  });

  it("leaves pages and full-screen modals for the dock's own rules", () => {
    expect(names([{ name: "Home" }, { name: "ConnectOnboarding" }])).toEqual([
      "Home",
      "ConnectOnboarding",
    ]);
  });
});
