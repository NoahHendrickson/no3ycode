/**
 * The Mac's "Resume with less context" notice on the no3y iPhone composer: a glass pill, title
 * over "525K tokens from an older session", with Compact (sends `/compact` now) and an X that keeps
 * the full history — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import ArrowShrink02Icon from "@hugeicons/core-free-icons/ArrowShrink02Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { CommandId, DEFAULT_PROVIDER_INTERACTION_MODE, MessageId } from "@t3tools/contracts";
import { formatTokens } from "@t3tools/shared/usageFormat";
import { useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { makeQueuedMessageMetadata } from "../src/lib/commandMetadata";
import { enqueueThreadOutboxMessage } from "../src/state/thread-outbox";
import { flatGlassPalette, NO3Y_CONTROL_SIZE, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { NO3Y_PANEL_MARGIN, No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_RISE_IN, NO3Y_LAYOUT } from "./no3yMotion";
import {
  dismissNo3yResumeCompaction,
  isNo3yResumeCompactionDismissed,
  NO3Y_COMPACT_COMMAND,
  no3yResumeCompactionDismissals,
  resolveNo3yResumeCompaction,
  subscribeNo3yResumeCompaction,
} from "./no3yResumeCompaction";

const BUBBLE = NO3Y_CONTROL_SIZE;
const TITLE_LINE = 18;
const DETAIL_LINE = 15;
const TEXT_INSET = 8;
const BANNER_HEIGHT = TITLE_LINE + DETAIL_LINE + TEXT_INSET * 2;
const PILL_HEIGHT = 32;

/** Compacts the thread now, as the Mac's Compact does: a standalone `/compact` on its model. */
function compactNow(thread: EnvironmentThreadShell): Promise<void> {
  const metadata = makeQueuedMessageMetadata();
  return enqueueThreadOutboxMessage({
    environmentId: thread.environmentId,
    threadId: thread.id,
    messageId: MessageId.make(metadata.messageId),
    commandId: CommandId.make(metadata.commandId),
    text: NO3Y_COMPACT_COMMAND,
    attachments: [],
    modelSelection: thread.modelSelection,
    runtimeMode: thread.runtimeMode,
    interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    createdAt: metadata.createdAt,
  });
}

export function No3yCompactBanner(props: {
  readonly threadKey: string;
  /** The offer's tokens (client-runtime's compactBeforeSendTokens), or null with no offer. */
  readonly tokens: number | null;
  readonly thread: EnvironmentThreadShell;
  readonly canCompact: boolean;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const [compacting, setCompacting] = useState(false);
  // Re-reads the dismissals when one changes; the snapshot is a primitive so it stays stable.
  const dismissals = useSyncExternalStore(
    subscribeNo3yResumeCompaction,
    no3yResumeCompactionDismissals,
  );
  const offer = resolveNo3yResumeCompaction({
    threadKey: props.threadKey,
    tokens: props.tokens,
    isDismissed: (key) => dismissals > 0 && isNo3yResumeCompactionDismissed(key),
  });
  if (offer === null) return null;
  const detail = `${formatTokens(offer.tokens)} tokens from an older session`;
  const compact = () => {
    if (compacting || !props.canCompact) return;
    setCompacting(true);
    compactNow(props.thread).then(
      () => {
        setCompacting(false);
        // The offer stays until the server compacts; hiding it keeps a second tap from paying twice.
        dismissNo3yResumeCompaction(offer.key);
      },
      (error: unknown) => {
        setCompacting(false);
        Dialog.alert(
          "Could not compact",
          error instanceof Error ? error.message : "The compaction could not be queued.",
        );
      },
    );
  };
  return (
    // The thread header's glass bubble: a pill with its controls nested inside, as the
    // usage and ⋯ group nests its buttons.
    <Animated.View
      entering={NO3Y_GLASS_RISE_IN}
      layout={NO3Y_LAYOUT}
      style={{
        ...NO3Y_PANEL_MARGIN,
        // A floor, not a height: larger Dynamic Type sizes grow the pill instead of spilling out.
        minHeight: BANNER_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 14,
      }}
    >
      <No3yGlassLayer radius={BANNER_HEIGHT / 2} />
      <HugeIcon icon={ArrowShrink02Icon} size={18} color={palette.foreground} />
      <View
        accessible
        accessibilityLabel={`Resume with less context, ${detail}`}
        style={{ flex: 1, minWidth: 0, paddingVertical: TEXT_INSET }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            lineHeight: TITLE_LINE,
            ...NO3Y_FONT.medium,
            color: palette.titleInk,
          }}
        >
          Resume with less context
        </Text>
        {/* Its own line, as the Mac's description: one row beside Compact and X has no room. */}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            lineHeight: DETAIL_LINE,
            ...NO3Y_FONT.regular,
            color: palette.metaInk,
          }}
        >
          {detail}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compact"
        accessibilityState={{ disabled: compacting || !props.canCompact }}
        disabled={compacting || !props.canCompact}
        onPress={compact}
        style={({ pressed }) => ({
          height: PILL_HEIGHT,
          justifyContent: "center",
          paddingHorizontal: 12,
          opacity: compacting || !props.canCompact ? 0.45 : pressed ? 0.6 : 1,
        })}
      >
        <No3yGlassLayer radius={PILL_HEIGHT / 2} />
        <Text style={{ fontSize: 14, ...NO3Y_FONT.medium, color: palette.foreground }}>
          Compact
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Keep full history"
        onPress={() => dismissNo3yResumeCompaction(offer.key)}
        style={({ pressed }) => ({
          width: BUBBLE - 4,
          alignSelf: "stretch",
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <HugeIcon icon={Cancel01Icon} size={20} color={palette.foreground} />
      </Pressable>
    </Animated.View>
  );
}
