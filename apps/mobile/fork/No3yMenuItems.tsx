/**
 * @react-native-menu actions drawn as SwiftUI menu content, for the no3y morphing glass menus
 * (fork/No3yGlassMenuButton.tsx): titles, subtitles, SF Symbols, checkmarks, destructive and
 * disabled items, inline sections and submenus, as the UIMenu showed them.
 */
import { Button, Menu, Section, Text, Toggle } from "@expo/ui/swift-ui";
import { disabled } from "@expo/ui/swift-ui/modifiers";
import type { MenuAction } from "@react-native-menu/menu";
import type { ComponentProps } from "react";

type SFSymbol = NonNullable<ComponentProps<typeof Button>["systemImage"]>;

function MenuItem(props: {
  readonly action: MenuAction;
  readonly onPressAction: (id: string) => void;
}) {
  const { action } = props;
  const id = action.id ?? action.title;
  const image = action.image as SFSymbol | undefined;
  const modifiers = action.attributes?.disabled ? [disabled(true)] : [];
  if (action.subactions && action.subactions.length > 0) {
    const children = (
      <No3yMenuItems actions={action.subactions} onPressAction={props.onPressAction} />
    );
    return action.displayInline ? (
      <Section {...(action.title ? { title: action.title } : {})}>{children}</Section>
    ) : (
      <Menu label={action.title} {...(image ? { systemImage: image } : {})} modifiers={modifiers}>
        {children}
      </Menu>
    );
  }
  if (action.state === "on") {
    return (
      <Toggle
        isOn
        label={action.title}
        {...(image ? { systemImage: image } : {})}
        onIsOnChange={() => props.onPressAction(id)}
        modifiers={modifiers}
      />
    );
  }
  if (action.subtitle) {
    return (
      <Button
        onPress={() => props.onPressAction(id)}
        role={action.attributes?.destructive ? "destructive" : "default"}
        modifiers={modifiers}
      >
        <Text>{action.title}</Text>
        <Text>{action.subtitle}</Text>
      </Button>
    );
  }
  return (
    <Button
      label={action.title}
      {...(image ? { systemImage: image } : {})}
      role={action.attributes?.destructive ? "destructive" : "default"}
      onPress={() => props.onPressAction(id)}
      modifiers={modifiers}
    />
  );
}

export function No3yMenuItems(props: {
  readonly actions: ReadonlyArray<MenuAction>;
  readonly onPressAction: (id: string) => void;
}) {
  return props.actions
    .filter((action) => !action.attributes?.hidden)
    .map((action, index) => (
      <MenuItem
        key={action.id ?? `${action.title}:${index}`}
        action={action}
        onPressAction={props.onPressAction}
      />
    ));
}
