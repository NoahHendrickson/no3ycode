import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { FLOAT_EDGE_GAP, moveFloatFrame, resizeFloatFrame, resolveFloatFrame } from "./floatFrame";
import { DraftId } from "~/composerDraftStore";

import { closeSplitDraft } from "./splitPaneNavigation";
import { findSplitPair } from "./splitThreadPairs";
import { resolveDockedLayout, useSplitThreadStore } from "./splitThreadStore";

const ref = (id: string) => scopeThreadRef(EnvironmentId.make("env"), ThreadId.make(id));
const server = { kind: "server" } as const;
const column = { width: 1000, height: 800, top: 52 };

describe("float frame", () => {
  it("opens at the column's top right, under its title bar", () => {
    const fresh = resolveFloatFrame(null, column);
    expect(fresh.x + fresh.width).toBe(column.width - FLOAT_EDGE_GAP);
    expect(fresh.y).toBe(column.top + FLOAT_EDGE_GAP);
  });

  it("clamps a stored frame into the column instead of losing it", () => {
    const stored = { x: 900, y: 700, width: 440, height: 560 };
    expect(resolveFloatFrame(stored, column)).toEqual({
      x: column.width - FLOAT_EDGE_GAP - 440,
      y: column.height - FLOAT_EDGE_GAP - 560,
      width: 440,
      height: 560,
    });
  });

  it("drags without leaving the column or reaching its title bar", () => {
    const start = resolveFloatFrame(null, column);
    const downLeft = moveFloatFrame(start, { x: -5000, y: 5000 }, column);
    expect(downLeft.x).toBe(FLOAT_EDGE_GAP);
    expect(downLeft.y + downLeft.height).toBe(column.height - FLOAT_EDGE_GAP);
    expect(moveFloatFrame(start, { x: 0, y: -5000 }, column).y).toBe(column.top + FLOAT_EDGE_GAP);
  });

  it("resizes from a corner or an edge while the opposite sides stay put", () => {
    const start = { x: 400, y: 100, width: 440, height: 560 };
    expect(resizeFloatFrame(start, { x: -1, y: 1 }, { x: -100, y: 50 }, column)).toEqual({
      x: 300,
      y: 100,
      width: 540,
      height: 610,
    });
    // An edge moves one axis only.
    expect(resizeFloatFrame(start, { x: 1, y: 0 }, { x: -60, y: 300 }, column)).toEqual({
      ...start,
      width: 380,
    });
    // Never below the minimum, and the far corner does not drift.
    const shrunk = resizeFloatFrame(start, { x: -1, y: -1 }, { x: 1000, y: 1000 }, column);
    expect(shrunk.x + shrunk.width).toBe(start.x + start.width);
    expect(shrunk.y + shrunk.height).toBe(start.y + start.height);
    expect(shrunk.width).toBe(320);
    // Growing north stops under the title bar.
    const tall = resizeFloatFrame(start, { x: 0, y: -1 }, { x: 0, y: -1000 }, column);
    expect(tall.y).toBe(column.top + FLOAT_EDGE_GAP);
  });
});

describe("floating a thread", () => {
  beforeEach(() => {
    useSplitThreadStore.setState({
      pairs: [],
      floating: null,
      floatFrame: null,
      routeCurrent: null,
      routePrevious: null,
      pendingFloat: null,
    });
  });

  it("takes a paired thread out of its pair, and docking pairs it again", () => {
    const store = useSplitThreadStore.getState();
    store.pair(ref("a"), ref("b"));
    store.float(ref("b"));
    expect(useSplitThreadStore.getState().floating).toEqual(ref("b"));
    expect(findSplitPair(useSplitThreadStore.getState().pairs, ref("a"))).toBeNull();
    // Dock: pairing the floated thread lands it, so it is never both.
    store.pair(ref("a"), ref("b"));
    expect(useSplitThreadStore.getState().floating).toBeNull();
    expect(findSplitPair(useSplitThreadStore.getState().pairs, ref("b"))).toEqual({
      a: ref("a"),
      b: ref("b"),
    });
  });

  it("remembers the route's previous thread, not a re-visit of the current one", () => {
    const { arrive } = useSplitThreadStore.getState();
    arrive({ ref: ref("p"), route: server });
    arrive({ ref: ref("f"), route: server });
    arrive({ ref: ref("f"), route: server });
    expect(useSplitThreadStore.getState().routePrevious?.ref).toEqual(ref("p"));
  });

  it("floats the route's thread only once the route has left it", () => {
    const store = useSplitThreadStore.getState();
    store.arrive({ ref: ref("p"), route: server });
    store.arrive({ ref: ref("f"), route: server });
    store.floatOnLeave(ref("f"));
    expect(useSplitThreadStore.getState().floating).toBeNull();
    store.arrive({ ref: ref("p"), route: server });
    expect(useSplitThreadStore.getState().floating).toEqual(ref("f"));
    // Floating the column's thread back to the floated one swaps them.
    store.floatOnLeave(ref("p"));
    store.arrive({ ref: ref("f"), route: server });
    expect(useSplitThreadStore.getState().floating).toEqual(ref("p"));
    expect(useSplitThreadStore.getState().pendingFloat).toBeNull();
  });

  it("ends a float when the route arrives at the floated thread", () => {
    const store = useSplitThreadStore.getState();
    store.arrive({ ref: ref("p"), route: server });
    store.float(ref("f"));
    store.arrive({ ref: ref("f"), route: server });
    expect(useSplitThreadStore.getState().floating).toBeNull();
  });
});

describe("docking a thread to the right", () => {
  beforeEach(() => {
    useSplitThreadStore.setState({
      pairs: [],
      floating: null,
      routeCurrent: null,
      routePrevious: null,
      pendingFloat: null,
      docked: null,
      dockRatio: null,
    });
  });

  const layoutFor = (route: string) => {
    const { docked } = useSplitThreadStore.getState();
    return docked === null ? null : resolveDockedLayout(docked, 0.5, ref(route));
  };

  it("keeps the docked thread on the right while the route moves through other threads", () => {
    const store = useSplitThreadStore.getState();
    store.arrive({ ref: ref("d"), route: server });
    store.dock(ref("d"), null);
    // On its own route with nothing beside it yet, it shows alone.
    expect(layoutFor("d")).toBeNull();
    store.arrive({ ref: ref("a"), route: server });
    expect(layoutFor("a")).toMatchObject({ left: ref("a"), right: ref("d") });
    store.arrive({ ref: ref("b"), route: server });
    expect(layoutFor("b")).toMatchObject({ left: ref("b"), right: ref("d") });
    // Focusing the docked pane takes the route there; the left pane keeps the last thread.
    store.arrive({ ref: ref("d"), route: server });
    expect(layoutFor("d")).toMatchObject({ left: ref("b"), right: ref("d") });
    store.undock();
    expect(useSplitThreadStore.getState().docked).toBeNull();
  });

  it("takes a docked thread out of its pair, and out of the window", () => {
    const store = useSplitThreadStore.getState();
    store.pair(ref("a"), ref("b"));
    store.float(ref("f"));
    store.dock(ref("b"), ref("a"));
    expect(findSplitPair(useSplitThreadStore.getState().pairs, ref("a"))).toBeNull();
    store.dock(ref("f"), ref("a"));
    expect(useSplitThreadStore.getState()).toMatchObject({
      docked: { thread: ref("f") },
      floating: null,
    });
    // The window's thread stays in the window rather than filling the left pane.
    store.float(ref("w"));
    store.dock(ref("a"), ref("w"));
    expect(useSplitThreadStore.getState()).toMatchObject({
      floating: ref("w"),
      docked: { left: null },
    });
  });

  it("undocks a thread that floats or pairs, and forgets one that is gone", () => {
    const store = useSplitThreadStore.getState();
    store.arrive({ ref: ref("a"), route: server });
    store.dock(ref("d"), ref("a"));
    store.float(ref("d"));
    expect(useSplitThreadStore.getState()).toMatchObject({ docked: null, floating: ref("d") });

    store.unfloat();
    store.dock(ref("d"), ref("a"));
    // Floating the docked thread from its own route lands once the route leaves it.
    store.arrive({ ref: ref("d"), route: server });
    store.floatOnLeave(ref("d"));
    store.arrive({ ref: ref("a"), route: server });
    expect(useSplitThreadStore.getState()).toMatchObject({ docked: null, floating: ref("d") });

    store.dock(ref("d"), ref("a"));
    store.pair(ref("d"), ref("b"));
    expect(useSplitThreadStore.getState().docked).toBeNull();

    store.dock(ref("d"), ref("a"));
    store.forget(ref("a"));
    expect(useSplitThreadStore.getState()).toMatchObject({
      docked: { thread: ref("d"), left: null },
    });
    store.forget(ref("d"));
    expect(useSplitThreadStore.getState().docked).toBeNull();
  });

  it("closes a draft out of the left pane, keeping a hidden pair only while the draft lives", async () => {
    const store = useSplitThreadStore.getState();
    store.pair(ref("s"), ref("draft"));
    store.dock(ref("d"), ref("draft"));
    // A written draft survives the close, and so does the pair the dock hides.
    store.closeDraftPane(ref("draft"));
    expect(useSplitThreadStore.getState()).toMatchObject({
      docked: { thread: ref("d"), left: null },
    });
    expect(findSplitPair(useSplitThreadStore.getState().pairs, ref("draft"))).not.toBeNull();
    // An empty one is discarded, so the pair goes with it.
    store.dock(ref("d"), ref("draft"));
    await closeSplitDraft(async () => true, ref("draft"), DraftId.make("draft-1"));
    const state = useSplitThreadStore.getState();
    expect(state).toMatchObject({ docked: { thread: ref("d"), left: null } });
    expect(findSplitPair(state.pairs, ref("draft"))).toBeNull();
  });
});
