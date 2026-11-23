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
/** The glass button style's padding on each side at `controlSize("regular")`, at every text size. */
const GLASS_PADDING = 7;

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
    /** Defaults to the 44pt header control; the composer's are 40pt. */
    readonly size?: number;
    readonly actions: ReadonlyArray<MenuAction>;
    readonly onPressAction: (id: string) => void;
  },
) {
  const { palette } = props;
  const size = props.size ?? NO3Y_CONTROL_SIZE;
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
  // SwiftUI sizes the glass from its own padding around the label, not from this host, so the
  // label takes the slot less that padding and the glass comes out the slot's size.
  const labelSize = size - 2 * GLASS_PADDING;
  return (
    <Host
      // A circle has the control's size; a capsule takes its width from its label.
      {...(circle ? {} : { matchContents: { horizontal: true } })}
      // The hosting view otherwise insets its content for the home indicator and keyboard,
      // lifting the glass off its slot: 1pt at rest, much more while the keyboard moves.
      ignoreSafeArea="all"
      alignment="center"
      style={{
        ...(circle ? { width: size } : null),
        height: size,
        borderRadius: size / 2,
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
                ...(circle ? { width: labelSize } : null),
                height: labelSize,
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
          controlSize("regular"),
          menuIndicator("hidden"),
          accessibilityLabel(props.accessibilityLabel),
        ]}
      >
        {items}
      </SwiftUIMenu>
    </Host>
  );
}
