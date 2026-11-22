import type { MenuAction } from "@react-native-menu/menu";
import { Pressable } from "react-native";

import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Menu } from "../../components/ui/Menu";
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import PlusIcon from "@hugeicons/core-free-icons/PlusIcon";
import { No3yComposerRoundButton, useNo3yComposerStyle } from "../../../fork/No3yComposerStyle";
/* fork:end no3y-mobile-redesign */
/* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
import { useNo3yStashMenu } from "../../../fork/No3yPromptStashSheet";
/* fork:end no3y-prompt-stash */

const ATTACHMENT_MENU_ACTIONS: MenuAction[] = [
  { id: "photos", title: "Photo Library", image: "photo" },
  { id: "files", title: "Choose Files", image: "folder" },
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
  const { scale } = useAndroidControlSizing();
  /* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
  const stashMenu = useNo3yStashMenu(props.no3yStash);
  /* fork:end no3y-prompt-stash */
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  const no3yCard = useNo3yComposerStyle();
  const button = no3yCard ? (
    <No3yComposerRoundButton
      accessibilityLabel="Add attachment"
      icon={PlusIcon}
      leading
      disabled={props.disabled}
      onPress={props.supportsFiles ? undefined : () => void props.onPickMedia()}
    />
  ) : (
    /* fork:end no3y-mobile-redesign */
    <Pressable
      accessibilityLabel="Add attachment"
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

  /* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
  if (stashMenu && !props.disabled) {
    return (
      <Menu
        accessible
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
      accessibilityLabel="Add attachment"
      accessibilityRole="button"
      actions={ATTACHMENT_MENU_ACTIONS}
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
