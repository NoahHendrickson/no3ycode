import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { selectActiveRightPanel, useRightPanelStore } from "../../rightPanelStore";
import { setMusicKeepOpen } from "./musicKeepOpen";
import { MusicPanelToggle } from "./MusicPanelToggle";

const environmentId = EnvironmentId.make("local");
const threadA = { environmentId, threadId: ThreadId.make("a") };
const threadB = { environmentId, threadId: ThreadId.make("b") };
const showing = (ref: typeof threadA) =>
  selectActiveRightPanel(useRightPanelStore.getState().byThreadKey, ref);

function setup(): Disposable {
  (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge = {
    music: { canOpen: false, follow: () => () => undefined },
  };
  setMusicKeepOpen(true);
  return {
    [Symbol.dispose]() {
      setMusicKeepOpen(false);
      delete (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
    },
  };
}

describe("MusicPanelToggle", () => {
  it("carries Music to each thread arrived at, and leaves a panel closed on the same thread closed", async () => {
    using _bridge = setup();
    // The header renders the button only with the panel available; the arrival waits for that.
    await using screen = await render(
      <MusicPanelToggle available={false} started threadRef={threadA} />,
    );
    expect(showing(threadA)).not.toBe("music");
    // A new agent's draft keeps its id once its first message starts it; only then does Music come.
    await screen.rerender(<MusicPanelToggle available started={false} threadRef={threadA} />);
    expect(showing(threadA)).not.toBe("music");
    await screen.rerender(<MusicPanelToggle available started threadRef={threadA} />);
    expect(showing(threadA)).toBe("music");

    // Closing the panel moves the button from the panel to the header: a remount, same thread.
    await act(() => useRightPanelStore.getState().close(threadA));
    await screen.rerender(<span />);
    await screen.rerender(<MusicPanelToggle available started threadRef={threadA} />);
    expect(showing(threadA)).not.toBe("music");

    await screen.rerender(<MusicPanelToggle available started threadRef={threadB} />);
    expect(showing(threadB)).toBe("music");

    // Off, a thread switch leaves each thread's panel as it was.
    await act(() => useRightPanelStore.getState().close(threadA));
    setMusicKeepOpen(false);
    await screen.rerender(<MusicPanelToggle available started threadRef={threadA} />);
    expect(showing(threadA)).not.toBe("music");
  });
});
