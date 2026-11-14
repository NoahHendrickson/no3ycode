import { EnvironmentId, type ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { selectActiveRightPanel, useRightPanelStore } from "../../rightPanelStore";
import { setMusicKeepOpen, useMusicKeepOpenCarry } from "./musicKeepOpen";

const environmentId = EnvironmentId.make("local");
const thread = (id: string) => ({ environmentId, threadId: ThreadId.make(id) });
const threadA = thread("a");
const threadB = thread("b");
const threadC = thread("c");
const threadD = thread("d");
const showing = (ref: ScopedThreadRef) =>
  selectActiveRightPanel(useRightPanelStore.getState().byThreadKey, ref);
const panels = () => useRightPanelStore.getState();

function Carry(props: { threadRef: ScopedThreadRef; ready: boolean }) {
  useMusicKeepOpenCarry(props.threadRef, props.ready);
  return null;
}

function setup(): Disposable {
  (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge = {
    music: { canOpen: false, follow: () => () => undefined },
  };
  useRightPanelStore.setState({ byThreadKey: {}, userActionRevisionByThreadKey: {} });
  setMusicKeepOpen(false);
  return {
    [Symbol.dispose]() {
      useRightPanelStore.setState({ byThreadKey: {}, userActionRevisionByThreadKey: {} });
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
    await act(() => panels().toggle(threadA, "music"));

    // A thread that can't show a panel yet (a new agent's draft before its first message) waits.
    await screen.rerender(<Carry ready={false} threadRef={threadB} />);
    expect(showing(threadB)).toBeNull();
    await screen.rerender(<Carry ready threadRef={threadB} />);
    expect(showing(threadB)).toBe("music");

    // Another tab taking the panel over is not a close: Music still opens elsewhere, and the
    // tab picked here stays through a remount and through leaving and coming back.
    await act(() => panels().open(threadB, "files"));
    await screen.rerender(<span />);
    await screen.rerender(<Carry ready threadRef={threadB} />);
    expect(showing(threadB)).toBe("files");
    await screen.rerender(<Carry ready threadRef={threadC} />);
    expect(showing(threadC)).toBe("music");
    await screen.rerender(<Carry ready threadRef={threadB} />);
    expect(showing(threadB)).toBe("files");

    // Its tab closed behind another tab is a close: the next thread arrived on loses it.
    await act(() => panels().closeSurface(threadB, "music"));
    expect(showing(threadB)).toBe("files");
    await screen.rerender(<Carry ready threadRef={threadC} />);
    expect(showing(threadC)).toBeNull();

    // Reopened from the panel's own toggle, it is open everywhere again.
    await act(() => panels().toggleVisibility(threadC));
    expect(showing(threadC)).toBe("music");
    await screen.rerender(<Carry ready threadRef={threadA} />);
    expect(showing(threadA)).toBe("music");

    // Its tab closed as the panel's only tab drops the thread's state, and is a close too.
    await act(() => panels().closeSurface(threadA, "music"));
    await screen.rerender(<Carry ready threadRef={threadC} />);
    expect(showing(threadC)).toBeNull();

    // A thread off screen changing says nothing: Music stays closed, and closes there on arrival.
    await act(() => panels().open(threadD, "music"));
    expect(showing(threadC)).toBeNull();
    await screen.rerender(<Carry ready threadRef={threadD} />);
    expect(showing(threadD)).toBeNull();

    // Nor does a thread being deleted while it shows Music: it stays open elsewhere.
    await act(() => panels().toggle(threadD, "music"));
    await act(() => panels().removeThread(threadD));
    await screen.rerender(<Carry ready threadRef={threadC} />);
    expect(showing(threadC)).toBe("music");
  });
});
