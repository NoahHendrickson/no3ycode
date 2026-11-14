import { memo } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { type ResizableWidthHandlers, useResizableWidth } from "~/hooks/useResizableWidth";

const STORAGE_KEY = "test:stage-panel-resize-handles";

const Handle = memo(function Handle(props: {
  readonly handlers: ResizableWidthHandlers;
  readonly onRender: () => void;
}) {
  props.onRender();
  return <div role="separator" style={{ width: 8, height: 40 }} {...props.handlers} />;
});

function Panel(props: { readonly maxWidth: number; readonly onHandleRender: () => void }) {
  const { handlers } = useResizableWidth({
    storageKey: STORAGE_KEY,
    defaultWidth: 240,
    minWidth: 160,
    maxWidth: props.maxWidth,
    edge: "left",
  });
  return <Handle handlers={handlers} onRender={props.onHandleRender} />;
}

// fork-bot-work-threads: the other inline panel's drag moves this panel's cap every frame.
describe("a stage panel's resize handle", () => {
  it("keeps its handlers when only the bounds change, and drags within the new ones", async () => {
    const previous = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    try {
      const onHandleRender = vi.fn();
      // This hook only needs browser storage and React; no navigation is involved.
      await using screen = await render(<Panel maxWidth={560} onHandleRender={onHandleRender} />, {
        router: false,
      });
      onHandleRender.mockClear();
      await screen.rerender(<Panel maxWidth={400} onHandleRender={onHandleRender} />);
      expect(onHandleRender).not.toHaveBeenCalled();

      const handle = screen.getByRole("separator").element() as HTMLElement;
      // Synthetic drag events have no active browser pointer to capture.
      using _capture = vi.spyOn(handle, "setPointerCapture").mockImplementation(() => {});
      const pointer = { bubbles: true, pointerId: 1, button: 0 };
      await act(() => {
        handle.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: 500 }));
        handle.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: 100 }));
      });
      expect(localStorage.getItem(STORAGE_KEY)).toBe("400");
    } finally {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
    }
  });
});
