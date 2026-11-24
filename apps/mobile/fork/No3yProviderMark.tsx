/**
 * Provider marks on the no3y surfaces — see `.fork/customizations.yaml#no3y-mobile-redesign`. The
 * Mac fork's own marks for Claude (the Claude Code mascot) and Codex (the cloud prompt in #8680ff
 * over a white prompt), copied from apps/web/src/custom/icons/ModelPickerProviderGlyph.tsx and
 * its codex-mark.png; every other provider keeps the app's ProviderIcon.
 */
import { Image } from "expo-image";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ProviderIcon } from "../src/components/ProviderIcon";

const CLAUDE_INK = "#D97757";
const CODEX_INK = "#8680ff";
const CODEX_MARK = require("./assets/codex-mark.png");

const CLAUDE_MASCOT =
  "M223.979 63.79H256v33.087h-32v32.299h-15.861v31.157H192v-31.157h-15.861v31.157H160v-31.157H96v31.157H79.872v-31.157H64v31.157H47.861v-31.157H32v-32.31H0V63.8h32V.333h191.979zM64 63.79h15.872V33.42H64zm112.107 0H192V33.42h-15.893z";

/** True when the fork draws its own mark for this driver. */
export function hasNo3yProviderMark(driver: string | null | undefined): boolean {
  return driver === "claudeAgent" || driver === "codex";
}

export function No3yProviderMark(props: {
  readonly provider: string | null | undefined;
  readonly iconUrl?: string | null | undefined;
  readonly size: number;
}) {
  const { size } = props;
  if (props.provider === "claudeAgent") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={(size * 161) / 256} viewBox="0 0 256 161">
          <Path d={CLAUDE_MASCOT} fill={CLAUDE_INK} />
        </Svg>
      </View>
    );
  }
  if (props.provider === "codex") {
    return (
      <View style={{ width: size, height: size }}>
        {/* Inset a quarter, so it stays inside the cloud and shows only through the prompt. */}
        <View
          style={{
            position: "absolute",
            top: size / 4,
            left: size / 4,
            right: size / 4,
            bottom: size / 4,
            backgroundColor: "#FFFFFF",
          }}
        />
        <Image
          accessibilityIgnoresInvertColors
          source={CODEX_MARK}
          contentFit="contain"
          tintColor={CODEX_INK}
          style={{ width: size, height: size }}
        />
      </View>
    );
  }
  return <ProviderIcon provider={props.provider} iconUrl={props.iconUrl} size={size} />;
}
