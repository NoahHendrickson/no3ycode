/**
 * A 44pt glass button whose menu morphs out of it, iOS 26 style — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. On iOS 26 it is a SwiftUI Menu with the glass
 * button style (@expo/ui, already in the app), which is what grows into the menu and collapses
 * back; earlier iOS keeps the RN glass button under @react-native-menu's menu, which only pops.
 */
import { Host, Menu as SwiftUIMenu, RNHostView, Section } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  menuIndicator,
} from "@expo/ui/swift-ui/modifiers";
import type { MenuAction } from "@react-native-menu/menu";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Menu } from "../src/components/ui/Menu";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../src/native/native-glass";
import { NO3Y_CONTROL_SIZE, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yCircleButton } from "./No3yControls";
import { No3yGlassLayer } from "./No3yGlass";
import { No3yMenuItems } from "./No3yMenuItems";

const ICON_SIZE = 20;
const LABEL_GAP = 6;

type Trigger =
  /** A 44pt glass circle around a 20pt icon. */
  | { readonly icon: HugeIconData; readonly filled?: boolean; readonly label?: undefined }
  /** A 44pt glass capsule around RN content (icon and text, laid out in a row). */
  | { readonly label: ReactNode; readonly icon?: undefined; readonly filled?: undefined };

export function No3yGlassMenuButton(
  props: Trigger & {
    readonly palette: FlatGlassPalette;
    readonly accessibilityLabel: string;
    readonly title?: string;
    readonly selected?: boolean;
    readonly actions: ReadonlyArray<MenuAction>;
    readonly onPressAction: (id: string) => void;
  },
) {
  const { palette } = props;
  const items =
    props.title === undefined ? (
      <No3yMenuItems actions={props.actions} onPressAction={props.onPressAction} />
    ) : (
      <Section title={props.title}>
        <No3yMenuItems actions={props.actions} onPressAction={props.onPressAction} />
      </Section>
    );
  const content =
    props.icon !== undefined ? (
      <HugeIcon
        icon={props.icon}
        size={ICON_SIZE}
        color={palette.foreground}
        filled={props.filled ?? true}
      />
    ) : (
      props.label
    );

  if (!NATIVE_LIQUID_GLASS_SUPPORTED) {
    return (
      <Menu
        {...(props.title === undefined ? {} : { title: props.title })}
        actions={[...props.actions]}
        onPressAction={({ nativeEvent }) => props.onPressAction(nativeEvent.event)}
      >
        {props.icon !== undefined ? (
          <No3yCircleButton
            palette={palette}
            accessibilityLabel={props.accessibilityLabel}
            {...(props.selected === undefined ? {} : { selected: props.selected })}
          >
            {content}
          </No3yCircleButton>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            style={{
              height: NO3Y_CONTROL_SIZE,
              flexDirection: "row",
              alignItems: "center",
              gap: LABEL_GAP,
              paddingHorizontal: 14,
              borderRadius: NO3Y_CONTROL_SIZE / 2,
            }}
          >
            <No3yGlassLayer radius={NO3Y_CONTROL_SIZE / 2} />
            {content}
          </Pressable>
        )}
      </Menu>
    );
  }

  const circle = props.icon !== undefined;
  return (
    <Host
      // A circle has the control's size; a capsule takes its width from its label.
      {...(circle ? {} : { matchContents: { horizontal: true } })}
      alignment="center"
      style={{
        ...(circle ? { width: NO3Y_CONTROL_SIZE } : null),
        height: NO3Y_CONTROL_SIZE,
        borderRadius: NO3Y_CONTROL_SIZE / 2,
        borderWidth: props.selected ? 1.5 : 0,
        borderColor: palette.peekRing,
      }}
    >
      <SwiftUIMenu
        label={
          // Sized to its own content, so SwiftUI centres it in the glass; a host the size of
          // the label's frame drew a 20pt icon at that frame's top-left, about 3pt off centre.
          <RNHostView matchContents>
            {/* The SwiftUI button takes the tap; the content only draws. */}
            <View
              pointerEvents="none"
              accessible={false}
              style={{
                ...(circle ? { width: ICON_SIZE, height: ICON_SIZE } : null),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: LABEL_GAP,
              }}
            >
              {content}
            </View>
          </RNHostView>
        }
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape(circle ? "circle" : "capsule"),
          controlSize("large"),
          menuIndicator("hidden"),
          accessibilityLabel(props.accessibilityLabel),
        ]}
      >
        {items}
      </SwiftUIMenu>
    </Host>
  );
}
