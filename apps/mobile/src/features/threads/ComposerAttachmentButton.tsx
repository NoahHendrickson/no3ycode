import type { MenuAction } from "@react-native-menu/menu";
import { msg, useGT, useMessages } from "gt-react-native";
import { Pressable } from "react-native";

import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Menu } from "../../components/ui/Menu";
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import PlusIcon from "@hugeicons/core-free-icons/PlusIcon";
import {
  No3yComposerMenuButton,
  No3yComposerRoundButton,
  useNo3yComposerStyle,
} from "../../../fork/No3yComposerStyle";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../../native/native-glass";
/* fork:end no3y-mobile-redesign */
/* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
import { useNo3yStashMenu } from "../../../fork/No3yPromptStashSheet";
/* fork:end no3y-prompt-stash */

const ATTACHMENT_MENU_ACTIONS: MenuAction[] = [
  { id: "photos", title: msg("Photo Library"), image: "photo" },
  { id: "files", title: msg("Choose Files"), image: "folder" },
];

export function ComposerAttachmentButton(props: {
  readonly disabled?: boolean;
  readonly size?: "regular" | "large";
  readonly supportsFiles: boolean;
  readonly onPickMedia: () => Promise<void>;
  readonly onPickFiles: () => Promise<void>;
  /* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
  readonly no3yStash?: { readonly draftKey: string; readonly projectTitle: string | null };
  /* fork:end no3y-prompt-stash */
}) {
  const gt = useGT();
  const m = useMessages();
  const { scale } = useAndroidControlSizing();
  /* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
  const stashMenu = useNo3yStashMenu(props.no3yStash);
  /* fork:end no3y-prompt-stash */
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  const no3yCard = useNo3yComposerStyle();
  const button = no3yCard ? (
    <No3yComposerRoundButton
      // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
      accessibilityLabel="Add attachment"
      icon={PlusIcon}
      leading
      disabled={props.disabled}
      onPress={props.supportsFiles ? undefined : () => void props.onPickMedia()}
    />
  ) : (
    /* fork:end no3y-mobile-redesign */
    <Pressable
      accessibilityLabel={gt("Add attachment")}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      className="size-[44px] shrink-0 items-center justify-center rounded-full active:opacity-70 disabled:opacity-50"
      disabled={props.disabled}
      onPress={props.supportsFiles ? undefined : () => void props.onPickMedia()}
    >
      <SymbolView
        name="plus"
        size={Math.round((props.size === "large" ? 26 : 20) * scale)}
        weight="regular"
        tintColorClassName="accent-icon"
        type="monochrome"
      />
    </Pressable>
  );

  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  if (
    no3yCard &&
    NATIVE_LIQUID_GLASS_SUPPORTED &&
    !props.disabled &&
    (stashMenu || props.supportsFiles)
  ) {
    return (
      <No3yComposerMenuButton
        // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
        accessibilityLabel="Add attachment"
        icon={PlusIcon}
        actions={[
          ...(props.supportsFiles ? ATTACHMENT_MENU_ACTIONS : ATTACHMENT_MENU_ACTIONS.slice(0, 1)),
          ...(stashMenu?.actions ?? []),
        ]}
        onPressAction={(id) => {
          if (stashMenu?.handle(id)) return;
          if (id === "photos") void props.onPickMedia();
          else if (id === "files") void props.onPickFiles();
        }}
      />
    );
  }
  /* fork:end no3y-mobile-redesign */
  /* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
  if (stashMenu && !props.disabled) {
    return (
      <Menu
        accessible
        // oxlint-disable-next-line t3code/no-untranslated-copy -- fork copy stays English (fork-i18n-catalog)
        accessibilityLabel="Add attachment"
        accessibilityRole="button"
        actions={[
          ...(props.supportsFiles ? ATTACHMENT_MENU_ACTIONS : ATTACHMENT_MENU_ACTIONS.slice(0, 1)),
          ...stashMenu.actions,
        ]}
        onPressAction={({ nativeEvent }) => {
          if (stashMenu.handle(nativeEvent.event)) return;
          if (nativeEvent.event === "photos") void props.onPickMedia();
          else if (nativeEvent.event === "files") void props.onPickFiles();
        }}
      >
        {button}
      </Menu>
    );
  }
  /* fork:end no3y-prompt-stash */
  if (props.disabled || !props.supportsFiles) {
    return button;
  }

  return (
    <Menu
      accessible
      accessibilityLabel={gt("Add attachment")}
      accessibilityRole="button"
      actions={ATTACHMENT_MENU_ACTIONS.map((action) => ({ ...action, title: m(action.title) }))}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "photos") {
          void props.onPickMedia();
        } else if (nativeEvent.event === "files") {
          void props.onPickFiles();
        }
      }}
    >
      {button}
    </Menu>
  );
}
