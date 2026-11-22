/**
 * The iOS prompt stash (`.fork/customizations.yaml#no3y-prompt-stash`): stash the composer's text
 * from the + menu, list stashed prompts in a half sheet (first line, project, age), tap to
 * restore (replace or add below what is typed), swipe to delete. Kept in a file on this device.
 */
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { StackActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useRef, useSyncExternalStore } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { relativeTime } from "../src/lib/time";
import { uuidv4 } from "../src/lib/uuid";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { getComposerDraftSnapshot, setComposerDraftText } from "../src/state/use-composer-drafts";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { No3yCircleButton } from "./No3yControls";
import {
  createPromptStash,
  restoredDraftText,
  stashedPromptTitle,
  type StashedPrompt,
} from "./no3yPromptStash";

const stashFile = () => new File(Paths.document, "no3y-prompt-stash.json");

export const no3yPromptStash = createPromptStash({
  read: () => {
    try {
      const file = stashFile();
      return file.exists ? file.textSync() : null;
    } catch {
      return null;
    }
  },
  write: (raw) => {
    try {
      stashFile().writeSync(raw);
    } catch {
      Dialog.alert("Could not save the stash", "This device refused the write.");
    }
  },
});

export function useStashedPrompts(): ReadonlyArray<StashedPrompt> {
  return useSyncExternalStore(no3yPromptStash.subscribe, no3yPromptStash.entries);
}

/** Stashes a prompt now; returns its id so a failed move can take it back. */
export function stashPromptText(text: string, projectTitle: string | null): string {
  const id = uuidv4();
  no3yPromptStash.add({ id, text, createdAt: new Date().toISOString(), projectTitle });
  return id;
}

/** Moves the composer's text into the stash; attachments stay in the composer. */
export function stashComposerPrompt(draftKey: string, projectTitle: string | null) {
  const text = getComposerDraftSnapshot(draftKey).text;
  if (text.trim().length === 0) {
    Dialog.alert("Nothing to stash", "Type a prompt first.");
    return;
  }
  stashPromptText(text, projectTitle);
  setComposerDraftText(draftKey, "");
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function No3yPromptStashSheet({ route }: StaticScreenProps<{ readonly draftKey: string }>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const entries = useStashedPrompts();
  const close = () => navigation.goBack();
  const restore = (entry: StashedPrompt) => {
    const current = getComposerDraftSnapshot(route.params.draftKey).text;
    const apply = (mode: "replace" | "append") => {
      setComposerDraftText(route.params.draftKey, restoredDraftText(current, entry.text, mode));
      no3yPromptStash.remove(entry.id);
      void Haptics.selectionAsync();
      close();
    };
    if (current.trim().length === 0) {
      apply("replace");
      return;
    }
    Alert.alert("The composer has text", "Put the stashed prompt in its place, or below it?", [
      { text: "Cancel", style: "cancel" },
      { text: "Add below", onPress: () => apply("append") },
      { text: "Replace", style: "destructive", onPress: () => apply("replace") },
    ]);
  };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.stageBackground }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <No3yCircleButton
          palette={palette}
          accessibilityLabel="Close"
          icon={Cancel01Icon}
          onPress={close}
        />
        <Text
          accessibilityRole="header"
          style={{ flex: 1, ...NO3Y_FONT.medium, fontSize: 16, color: palette.foreground }}
        >
          Stashed prompts
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {entries.length === 0 ? (
          <Text
            style={{ paddingTop: 24, textAlign: "center", fontSize: 14, color: palette.metaInk }}
          >
            Nothing stashed. Use + › Stash prompt to set one aside.
          </Text>
        ) : (
          entries.map((entry) => (
            <StashRow
              key={entry.id}
              entry={entry}
              palette={palette}
              onRestore={() => restore(entry)}
              onDelete={() => no3yPromptStash.remove(entry.id)}
            />
          ))
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

function StashRow(props: {
  readonly entry: StashedPrompt;
  readonly palette: FlatGlassPalette;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
}) {
  const { entry, palette } = props;
  const swipeable = useRef<SwipeableMethods | null>(null);
  const meta = [entry.projectTitle, relativeTime(entry.createdAt)].filter(Boolean).join(" · ");
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      failOffsetY={[-12, 12]}
      containerStyle={{ backgroundColor: palette.stageBackground }}
      childrenContainerStyle={{ backgroundColor: palette.stageBackground }}
      onSwipeableOpen={(direction) => {
        if (direction !== "right") return;
        swipeable.current?.close();
        props.onDelete();
      }}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete stashed prompt"
          onPress={() => {
            swipeable.current?.close();
            props.onDelete();
          }}
          style={{
            width: 80,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.statusFailed,
          }}
        >
          <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: "#FFFFFF" }}>Delete</Text>
        </Pressable>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Restore ${stashedPromptTitle(entry.text)}`}
        accessibilityHint="Puts this prompt in the composer"
        onPress={props.onRestore}
        style={({ pressed }) => ({
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 2,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: palette.hairline,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          numberOfLines={1}
          style={{ ...NO3Y_FONT.medium, fontSize: 15, color: palette.titleInk }}
        >
          {stashedPromptTitle(entry.text)}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={{ fontSize: 13, color: palette.metaInk }}>
            {meta}
          </Text>
        ) : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** The + menu's stash rows: "Stash prompt" and "Stashed prompts (N)". */
export function useNo3yStashMenu(
  stash: { readonly draftKey: string; readonly projectTitle: string | null } | undefined,
) {
  const navigation = useNavigation();
  const count = useStashedPrompts().length;
  if (stash === undefined) return null;
  return {
    actions: [
      { id: "no3y-stash", title: "Stash prompt", image: "tray.and.arrow.down" },
      {
        id: "no3y-stashed",
        title: count > 0 ? `Stashed prompts (${count})` : "Stashed prompts",
        image: "tray.full",
      },
    ],
    /** True when the menu action was a stash row. */
    handle(id: string): boolean {
      if (id === "no3y-stash") {
        stashComposerPrompt(stash.draftKey, stash.projectTitle);
        return true;
      }
      if (id === "no3y-stashed") {
        navigation.dispatch(StackActions.push("No3yPromptStash", { draftKey: stash.draftKey }));
        return true;
      }
      return false;
    },
  };
}
