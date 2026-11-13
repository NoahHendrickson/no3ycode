import { EnvironmentId, type ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { selectActiveRightPanel, useRightPanelStore } from "../../rightPanelStore";
import { setMusicKeepOpen, useMusicKeepOpenCarry } from "./musicKeepOpen";

const environmentId = EnvironmentId.make("local");
const threadA = { environmentId, threadId: ThreadId.make("a") };
const threadB = { environmentId, threadId: ThreadId.make("b") };
const showing = (ref: ScopedThreadRef) =>
  selectActiveRightPanel(useRightPanelStore.getState().byThreadKey, ref);

function Carry(props: { threadRef: ScopedThreadRef; ready: boolean }) {
  useMusicKeepOpenCarry(props.threadRef, props.ready);
  return null;
}

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

describe("useMusicKeepOpenCarry", () => {
  it("carries Music to each thread arrived at, and leaves a panel closed on the same thread closed", async () => {
    using _bridge = setup();
    // A thread that can't show a panel yet (a new agent's draft before its first message) waits.
    await using screen = await render(<Carry ready={false} threadRef={threadA} />);
    expect(showing(threadA)).not.toBe("music");
    await screen.rerender(<Carry ready threadRef={threadA} />);
    expect(showing(threadA)).toBe("music");

    // Closed on the thread, then the view remounts on it: still closed.
    await act(() => useRightPanelStore.getState().close(threadA));
    await screen.rerender(<span />);
    await screen.rerender(<Carry ready threadRef={threadA} />);
    expect(showing(threadA)).not.toBe("music");

    await screen.rerender(<Carry ready threadRef={threadB} />);
    expect(showing(threadB)).toBe("music");

    // Off, a thread switch leaves each thread's panel as it was.
    setMusicKeepOpen(false);
    await screen.rerender(<Carry ready threadRef={threadA} />);
    expect(showing(threadA)).not.toBe("music");
  });
});
