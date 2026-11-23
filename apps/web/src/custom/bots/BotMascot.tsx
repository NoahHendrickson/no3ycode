/**
 * A bot's mascot as crisp pixels — see `.fork/customizations.yaml#fork-bots`.
 * One CSS pixel per cell by default; pass a whole `cell` so the pixels stay square, or `fit`
 * to scale it into a square box, so faces of every size read alike (a small one grows most).
 */
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { useQuietThreadShell } from "~/state/entities";

import {
  type BotMascotMood,
  type BotMascotShape,
  botMascotBaseColor,
  botMascotSprite,
} from "./botMascotArt";
import { botMascotShape } from "./botMascotTags";
import { isBotThread } from "./botThreads";

export function BotMascot(props: {
  readonly shape: BotMascotShape;
  readonly mood: BotMascotMood;
  readonly cell?: number;
  readonly fit?: number;
  readonly className?: string;
}) {
  const sprite = botMascotSprite(props.shape, props.mood);
  const cell =
    props.fit === undefined
      ? (props.cell ?? 1)
      : Math.min(props.fit / sprite.width, props.fit / sprite.height);
  return (
    <svg
      aria-hidden
      data-fork-bot-mascot={props.shape}
      data-mood={props.mood}
      width={sprite.width * cell}
      height={sprite.height * cell}
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0", props.className)}
    >
      {sprite.paths.map((path) => (
        <path key={path.fill} d={path.d} fill={path.fill} />
      ))}
    </svg>
  );
}

/** The mascot on a 32px tile in its own colour at half strength, behind a 1px 24% edge, white
    on dark and black on light (Figma Petal card), to fill a full card's two text lines. */
export function BotMascotTile(props: {
  readonly shape: BotMascotShape;
  readonly mood: BotMascotMood;
}) {
  return (
    <span
      data-fork-bot-mascot-tile=""
      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.24)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.24)]"
      style={{
        backgroundColor: `color-mix(in srgb, ${botMascotBaseColor(props.shape)} 50%, transparent)`,
      }}
    >
      <BotMascot shape={props.shape} mood={props.mood} fit={22} />
    </span>
  );
}

/** The mascot in a compact card's lead slot. The slot is one width, so bot names line up. */
export function BotMascotLead(props: {
  readonly shape: BotMascotShape;
  readonly mood: BotMascotMood;
}) {
  return (
    <span className="flex h-[18px] w-[22px] shrink-0 items-center justify-center">
      <BotMascot shape={props.shape} mood={props.mood} />
    </span>
  );
}

/** A bot's empty conversation: its mascot, large, and what to say first. Other threads keep `fallback`. */
export function BotEmptyConversation(props: {
  readonly threadKey: string;
  readonly fallback: ReactNode;
}) {
  const shell = useQuietThreadShell(parseScopedThreadKey(props.threadKey));
  if (shell === null || !isBotThread(shell.source)) return props.fallback;
  return (
    <div className="flex flex-col items-center gap-5" data-testid="bot-empty-conversation">
      <BotMascot shape={botMascotShape(shell.source)} mood="Idle" cell={6} />
      <p className="text-sm text-muted-foreground">Tell {shell.title} what its job is.</p>
    </div>
  );
}

/** A bot's mascot before its title in the stage header. Other threads get nothing. */
export function BotHeaderMascot(props: { readonly threadRef: ScopedThreadRef }) {
  const shell = useQuietThreadShell(props.threadRef);
  if (shell === null || !isBotThread(shell.source)) return null;
  return <BotMascot shape={botMascotShape(shell.source)} mood="Idle" fit={18} className="mr-2" />;
}
