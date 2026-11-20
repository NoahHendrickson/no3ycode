import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../test/render";
import { useComposerUsageDrawer } from "./ComposerUsageLimitsReadout";

const SESSION_LIMITS: ServerProviderUsageLimits = {
  checkedAt: "2026-11-20T12:00:00.000Z",
  windows: [
    {
      id: "five_hour",
      kind: "session",
      label: "5-hour",
      usedPercent: 25,
      windowDurationMins: 300,
    },
  ],
};

function DrawerHarness(props: {
  readonly usageLimits?: ServerProviderUsageLimits | undefined;
  readonly enabled?: boolean;
  readonly scopeKey?: string;
  readonly meterKey?: string;
  readonly transitionMs?: number;
  readonly drawerMinHeight?: number;
  readonly onSettledLiftChange?: (height: number) => void;
}) {
  const { readout, drawer } = useComposerUsageDrawer({
    usageLimits: props.usageLimits,
    enabled: props.enabled ?? true,
    scopeKey: props.scopeKey ?? "thread-1",
    meterKey: props.meterKey,
    onSettledLiftChange: props.onSettledLiftChange,
  });

  const transition =
    props.transitionMs && props.transitionMs > 0 ? `transform ${props.transitionMs}ms linear` : "";

  return (
    <div data-chat-canvas="true" data-testid="canvas">
      {transition || props.drawerMinHeight ? (
        <style>{`
          [data-fork-composer-usage-drawer] {
            ${props.drawerMinHeight ? `min-height: ${props.drawerMinHeight}px;` : ""}
            ${transition ? `transform: translateY(0); transition: ${transition};` : ""}
          }
          ${
            transition
              ? `[data-fork-composer-usage-drawer]:is([data-starting-style], [data-ending-style]) { transform: translateY(100%); }`
              : ""
          }
        `}</style>
      ) : null}
      {drawer}
      {readout}
    </div>
  );
}

describe("useComposerUsageDrawer", () => {
  it("publishes lift/mask/clearance on open, reverses in place, updates on open resize, and clears on close", async () => {
    const onSettledLiftChange = vi.fn();
    // Component renders standalone drawer chrome without routing.
    await using screen = await render(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        transitionMs={800}
        onSettledLiftChange={onSettledLiftChange}
      />,
      { router: false },
    );
    const canvas = screen.getByTestId("canvas").element() as HTMLElement;
    const trigger = screen.getByRole("button", { name: /5-hour limit/i });

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      const lift = Number.parseFloat(canvas.style.getPropertyValue("--fork-usage-drawer-lift"));
      expect(lift).toBeGreaterThan(0);
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-mask")).toBe(`${lift}px`);
      expect(onSettledLiftChange).toHaveBeenLastCalledWith(lift);
    });
    const initialPanel = canvas.querySelector("[data-fork-composer-usage-drawer]");
    expect(initialPanel).not.toBeNull();
    const initialLift = Number.parseFloat(
      canvas.style.getPropertyValue("--fork-usage-drawer-lift"),
    );

    // Mid-close reversal: click close, then re-open while the same mounted panel is still in data-ending-style.
    await userEvent.click(trigger);
    await vi.waitFor(() => {
      const panel = canvas.querySelector("[data-fork-composer-usage-drawer]");
      expect(panel).toBe(initialPanel);
      expect(panel?.hasAttribute("data-ending-style")).toBe(true);
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-lift")).toBe("");
      // Mask and clearance stay held while the translucent drawer is still closing.
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-mask")).toBe(`${initialLift}px`);
      expect(onSettledLiftChange).toHaveBeenLastCalledWith(initialLift);
    });

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      const panel = canvas.querySelector("[data-fork-composer-usage-drawer]");
      expect(panel).toBe(initialPanel);
      expect(panel?.hasAttribute("data-ending-style")).toBe(false);
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-lift")).toBe(`${initialLift}px`);
    });

    // Live resize while already open updates lift, mask, and timeline clearance together.
    const resizedHeight = initialLift + 28;
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        transitionMs={80}
        drawerMinHeight={resizedHeight}
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await vi.waitFor(() => {
      const nextLift = Number.parseFloat(canvas.style.getPropertyValue("--fork-usage-drawer-lift"));
      expect(nextLift).toBeGreaterThanOrEqual(resizedHeight);
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-mask")).toBe(`${nextLift}px`);
      expect(onSettledLiftChange).toHaveBeenLastCalledWith(nextLift);
    });

    // Full close clears both properties and reports 0 settled lift.
    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(canvas.querySelector("[data-fork-composer-usage-drawer]")).toBeNull();
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-lift")).toBe("");
      expect(canvas.style.getPropertyValue("--fork-usage-drawer-mask")).toBe("");
      expect(onSettledLiftChange).toHaveBeenLastCalledWith(0);
    });
  });

  it("invalidates open state when scope, meter, provider, or trigger availability changes", async () => {
    const onSettledLiftChange = vi.fn();
    using _matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );

    // Component renders standalone drawer chrome without routing.
    await using screen = await render(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
      { router: false },
    );
    const canvas = screen.getByTestId("canvas").element() as HTMLElement;
    const getTrigger = () => screen.getByRole("button", { name: /5-hour limit/i });

    const expectOpen = async () => {
      await vi.waitFor(() => {
        const lift = Number.parseFloat(canvas.style.getPropertyValue("--fork-usage-drawer-lift"));
        expect(lift).toBeGreaterThan(0);
        expect(onSettledLiftChange).toHaveBeenLastCalledWith(lift);
      });
    };

    const expectClosed = async () => {
      await vi.waitFor(() => {
        expect(canvas.querySelector("[data-fork-composer-usage-drawer]")).toBeNull();
        expect(canvas.style.getPropertyValue("--fork-usage-drawer-lift")).toBe("");
        expect(canvas.style.getPropertyValue("--fork-usage-drawer-mask")).toBe("");
        expect(onSettledLiftChange).toHaveBeenLastCalledWith(0);
      });
    };

    // 1. Thread switch closes the drawer and returning to thread-a keeps it closed.
    await userEvent.click(getTrigger());
    await expectOpen();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        scopeKey="thread-b"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();

    // 2. Switching between two valid provider meters closes the drawer and switching back keeps it closed.
    await userEvent.click(getTrigger());
    await expectOpen();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        scopeKey="thread-a"
        meterKey="codex:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();

    // 3. Losing the session meter closes the drawer and restoring it keeps it closed.
    await userEvent.click(getTrigger());
    await expectOpen();
    await screen.rerender(
      <DrawerHarness
        usageLimits={{ checkedAt: SESSION_LIMITS.checkedAt, windows: [] }}
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();

    // 4. Collapsing to a compact footer (enabled=false) closes the drawer and expanding keeps it closed.
    await userEvent.click(getTrigger());
    await expectOpen();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        enabled={false}
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();
    await screen.rerender(
      <DrawerHarness
        usageLimits={SESSION_LIMITS}
        enabled
        scopeKey="thread-a"
        meterKey="claude:five_hour"
        onSettledLiftChange={onSettledLiftChange}
      />,
    );
    await expectClosed();
  });
});
