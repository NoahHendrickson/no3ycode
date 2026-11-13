import { EnvironmentId, MessageId, ThreadId, type AssistantCitation } from "@t3tools/contracts";
import type { AnyRouter } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import {
  assistantCitationFromLocation,
  assistantCitationNavigation,
} from "../../lib/assistantCitationNavigation";
import {
  startMainAppLocationTracking,
  useCloseAppModal,
  useNavigateToMainApp,
} from "./mainAppLocation";

const THREAD_PATH = "/environment-one/thread-one";

const citation: AssistantCitation = {
  version: 1,
  environmentId: EnvironmentId.make("environment-one"),
  threadId: ThreadId.make("thread-one"),
  messageId: MessageId.make("assistant-one"),
  text: "quoted reply",
  start: 0,
  end: 12,
  prefix: "",
  suffix: "",
};

function ReturnControls() {
  const closeAppModal = useCloseAppModal();
  const navigateToMainApp = useNavigateToMainApp();
  return (
    <>
      <button type="button" onClick={() => void closeAppModal()}>
        Close modal
      </button>
      <button type="button" onClick={() => void navigateToMainApp()}>
        Back to app
      </button>
    </>
  );
}

// The tracker records on onResolved, which the router emits only once React commits the page.
async function settled(router: AnyRouter, navigation: Promise<void>) {
  await navigation;
  await vi.waitFor(() =>
    expect(router.state.resolvedLocation?.href).toBe(router.state.location.href),
  );
}

describe("main app return location", () => {
  it("returns to the thread without re-opening the quote source it was opened at", async () => {
    await using screen = await render(<ReturnControls />, { router: THREAD_PATH });
    const router = screen.router!;
    using _tracking = { [Symbol.dispose]: startMainAppLocationTracking(router) };

    const returnLocation = async (from: string, control: string) => {
      await settled(router, router.navigate(assistantCitationNavigation(citation, null)));
      expect(assistantCitationFromLocation(router.state.location.href)).toEqual(citation);
      await settled(router, router.navigate({ href: from }));
      await userEvent.click(screen.getByRole("button", { name: control }));
      await vi.waitFor(() => expect(router.state.location.pathname).toBe(THREAD_PATH));
      return router.state.location.href;
    };

    /* fork:begin fork-usage-page — see .fork/customizations.yaml#fork-usage-page
       Usage is a page in the fork, so Settings stands in as the modal. */
    const closingUsage = await returnLocation("/settings", "Close modal");
    /* fork:end fork-usage-page */
    const sidebarBack = await returnLocation("/pull-requests", "Back to app");

    expect({ closingUsage, sidebarBack }).toEqual({
      closingUsage: THREAD_PATH,
      sidebarBack: THREAD_PATH,
    });
  });
});
