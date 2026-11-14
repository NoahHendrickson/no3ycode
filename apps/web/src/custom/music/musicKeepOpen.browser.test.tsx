import { EnvironmentId, type ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { selectActiveRightPanel, useRightPanelStore } from "../../rightPanelStore";
import { setMusicKeepOpen, useMusicKeepOpenCarry } from "./musicKeepOpen";

const environmentId = EnvironmentId.make("local");
const threadA = { environmentId, threadId: ThreadId.make("a") };
const threadB = { environmentId, threadId: ThreadId.make("b") };
const threadC = { environmentId, threadId: ThreadId.make("c") };
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
  useRightPanelStore.setState({ byThreadKey: {} });
  setMusicKeepOpen(false);
  return {
    [Symbol.dispose]() {
      useRightPanelStore.setState({ byThreadKey: {} });
      setMusicKeepOpen(false);
      delete (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
    },
  };
}

describe("useMusicKeepOpenCarry", () => {
  it("opens Music on every thread once it is opened on one, and closes it on every thread once it is closed on one", async () => {
    using _bridge = setup();
    await using screen = await render(<Carry ready threadRef={threadA} />);
    expect(showing(threadA)).toBeNull();
    await act(() => useRightPanelStore.getState().toggle(threadA, "music"));

    // A thread that can't show a panel yet (a new agent's draft before its first message) waits.
    await screen.rerender(<Carry ready={false} threadRef={threadB} />);
    expect(showing(threadB)).toBeNull();
    await screen.rerender(<Carry ready threadRef={threadB} />);
    expect(showing(threadB)).toBe("music");

    // Another tab taking the panel over is not a close: the tab stays through a remount, and
    // Music still opens elsewhere.
    await act(() => useRightPanelStore.getState().open(threadB, "files"));
    await screen.rerender(<span />);
    await screen.rerender(<Carry ready threadRef={threadB} />);
    expect(showing(threadB)).toBe("files");
    await screen.rerender(<Carry ready threadRef={threadC} />);
    expect(showing(threadC)).toBe("music");

    // Closed on the thread in view, it closes on each thread arrived at after.
    await act(() => useRightPanelStore.getState().close(threadC));
    expect(showing(threadC)).toBeNull();
    await screen.rerender(<Carry ready threadRef={threadA} />);
    expect(showing(threadA)).toBeNull();

    // Reopened from the panel's own toggle, it is open everywhere again.
    await act(() => useRightPanelStore.getState().toggleVisibility(threadA));
    expect(showing(threadA)).toBe("music");
    await screen.rerender(<Carry ready threadRef={threadC} />);
    expect(showing(threadC)).toBe("music");
  });
});
