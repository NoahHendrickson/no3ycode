// Fork test — see `.fork/customizations.yaml#fork-bots`.
import { expect, it } from "@effect/vitest";

import { forkBotTaskPrompt, forkBotWakePrompt } from "./forkBotTasks.ts";

it("marks a bot's wake once", () => {
  expect(forkBotWakePrompt("Check mail.")).toBe("Scheduled wake: Check mail.");
  expect(forkBotWakePrompt("Scheduled wake: Check mail.")).toBe("Scheduled wake: Check mail.");
  expect(forkBotTaskPrompt("Check mail.")).toBe(false);
});
