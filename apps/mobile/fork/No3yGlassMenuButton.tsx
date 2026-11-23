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
import { View } from "react-native";

import { Menu } from "../src/components/ui/Menu";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../src/native/native-glass";
import { NO3Y_CONTROL_SIZE, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yCircleButton } from "./No3yControls";
import { No3yMenuItems } from "./No3yMenuItems";

const ICON_SIZE = 20;

export function No3yGlassMenuButton(props: {
  readonly palette: FlatGlassPalette;
  readonly accessibilityLabel: string;
  readonly icon: HugeIconData;
  readonly title?: string;
  readonly selected?: boolean;
  readonly actions: ReadonlyArray<MenuAction>;
  readonly onPressAction: (id: string) => void;
}) {
  if (!NATIVE_LIQUID_GLASS_SUPPORTED) {
    return (
      <Menu
        {...(props.title === undefined ? {} : { title: props.title })}
        actions={[...props.actions]}
        onPressAction={({ nativeEvent }) => props.onPressAction(nativeEvent.event)}
      >
        <No3yCircleButton
          palette={props.palette}
          accessibilityLabel={props.accessibilityLabel}
          icon={props.icon}
          {...(props.selected === undefined ? {} : { selected: props.selected })}
        />
      </Menu>
    );
  }
  return (
    <Host
      style={{
        width: NO3Y_CONTROL_SIZE,
        height: NO3Y_CONTROL_SIZE,
        borderRadius: NO3Y_CONTROL_SIZE / 2,
        borderWidth: props.selected ? 1.5 : 0,
        borderColor: props.palette.peekRing,
      }}
      alignment="center"
    >
      <SwiftUIMenu
        label={
          <RNHostView>
            {/* The SwiftUI button takes the tap; the icon only draws. */}
            <View
              pointerEvents="none"
              accessible={false}
              style={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HugeIcon
                icon={props.icon}
                size={ICON_SIZE}
                color={props.palette.foreground}
                filled
              />
            </View>
          </RNHostView>
        }
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          controlSize("large"),
          menuIndicator("hidden"),
          accessibilityLabel(props.accessibilityLabel),
        ]}
      >
        {props.title === undefined ? (
          <No3yMenuItems actions={props.actions} onPressAction={props.onPressAction} />
        ) : (
          <Section title={props.title}>
            <No3yMenuItems actions={props.actions} onPressAction={props.onPressAction} />
          </Section>
        )}
      </SwiftUIMenu>
    </Host>
  );
}
