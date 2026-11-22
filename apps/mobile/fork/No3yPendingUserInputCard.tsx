/**
 * The Mac fork's Questions card on the no3y iPhone composer (`.fork/customizations.yaml#fork-pending-user-input`):
 * a glass card in the composer's place, one question at a time with radios or checkboxes on the
 * left, Previous / Next and a white Submit. The collapse and feed-inset mechanics are upstream's.
 */
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import StopIcon from "@hugeicons/core-free-icons/StopIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { useNavigation } from "@react-navigation/native";
import { isPendingUserInputOptionSelected } from "@t3tools/client-runtime/state/pending-user-input";
import { markdownProseDirection } from "@t3tools/shared/textDirection";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useRef, useState, type ReactElement } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { useMarkdownPreviewStyles } from "../src/features/files/FileMarkdownPreview";
import {
  fileRoutePathSegments,
  resolveFileLinkPath,
  resolveWorkspaceRelativeFilePath,
} from "../src/features/files/filePath";
import type { PendingUserInputCardProps } from "../src/features/threads/PendingUserInputCard";
import { QuestionAttachments } from "../src/features/threads/QuestionAttachments";
import { resolveMarkdownLinkPresentation } from "../src/lib/markdownLinks";
import { SelectableMarkdownText } from "../src/native/SelectableMarkdownText";
import { useOpenPullRequest } from "../src/native/useOpenPullRequest";
import { useLiveThreadLinkLabels } from "../src/state/entities";
import {
  flatGlassPalette,
  NO3Y_CONTROL_SIZE,
  NO3Y_FONT,
  type FlatGlassPalette,
} from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { No3yGlassLayer } from "./No3yGlass";
import { no3yQuestionAfterSelect, no3yQuestionFooter } from "./no3yQuestionPaging";

const CARD_RADIUS = 28;

/** Draws the no3y card in place of the upstream one it wraps while the redesign is on. */
export function No3yPendingUserInputSwap(props: {
  readonly children: ReactElement<PendingUserInputCardProps>;
}) {
  const enabled = useNo3yBottomNavEnabled();
  if (!enabled) return props.children;
  const cardProps = props.children.props;
  return <No3yPendingUserInputCard key={cardProps.pendingUserInput.requestId} {...cardProps} />;
}

function QuestionMarkdown(props: {
  readonly markdown: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly workspaceRoot: string | null;
}) {
  const styles = useMarkdownPreviewStyles();
  const markdown = useLiveThreadLinkLabels(props.markdown, props.environmentId);
  const navigation = useNavigation();
  const openPullRequest = useOpenPullRequest();
  const openLink = (href: string) => {
    const link = resolveMarkdownLinkPresentation(href);
    if (link.kind !== "file") {
      void openPullRequest(href);
      return;
    }
    const path = resolveFileLinkPath(props.workspaceRoot, link.path);
    if (path === null) return;
    navigation.navigate("ThreadFile", {
      environmentId: String(props.environmentId),
      threadId: String(props.threadId),
      path: fileRoutePathSegments(
        resolveWorkspaceRelativeFilePath(props.workspaceRoot, path) ?? path,
      ),
      ...(link.line ? { line: String(link.line) } : {}),
    });
  };
  const direction = markdownProseDirection(markdown);
  return (
    <SelectableMarkdownText
      markdown={markdown}
      textStyle={styles.nativeTextStyle}
      writingDirection={direction}
      textAlign={direction === "rtl" ? "right" : "left"}
      onLinkPress={openLink}
      preserveSoftBreaks
    />
  );
}

function OptionControl(props: {
  readonly palette: FlatGlassPalette;
  readonly multiSelect: boolean;
  readonly selected: boolean;
  readonly ring: string;
}) {
  const { palette } = props;
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: props.multiSelect ? 4 : 8,
        borderWidth: props.selected ? 0 : 1,
        borderColor: props.ring,
        backgroundColor: props.selected ? palette.primaryFill : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {props.selected ? (
        props.multiSelect ? (
          <HugeIcon icon={Tick02Icon} size={12} color={palette.primaryInk} strokeWidth={3} />
        ) : (
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primaryInk }}
          />
        )
      ) : null}
    </View>
  );
}

function FooterButton(props: {
  readonly palette: FlatGlassPalette;
  readonly label: string;
  readonly primary?: boolean;
  readonly disabled?: boolean;
  readonly outline: string;
  readonly onPress: () => void;
}) {
  const { palette } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        height: NO3Y_CONTROL_SIZE,
        paddingHorizontal: 20,
        borderRadius: NO3Y_CONTROL_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: props.primary ? 0 : StyleSheet.hairlineWidth,
        borderColor: props.outline,
        backgroundColor: props.primary ? palette.primaryFill : "transparent",
        opacity: props.disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          ...NO3Y_FONT.medium,
          fontSize: 15,
          color: props.primary ? palette.primaryInk : palette.foreground,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function No3yPendingUserInputCard(props: PendingUserInputCardProps) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const dark = themeAppearance === "dark";
  // The Mac's theme-adaptive foreground alphas, never a primary tint.
  const ink = (alpha: number) =>
    dark ? `rgba(255, 255, 255, ${alpha})` : `rgba(20, 22, 24, ${alpha})`;
  const questions = props.pendingUserInput.questions;
  const questionCount = questions.length;
  const [index, setIndex] = useState(0);
  const activeIndex = Math.min(index, Math.max(0, questionCount - 1));
  const question = questions[activeIndex];
  const canRespond = props.pendingUserInput.responseCapability !== "not_resumable";
  const isResponding = props.respondingUserInputId === props.pendingUserInput.requestId;
  const responseDisabled = !canRespond || isResponding;

  const { cardCoverage, cardProgress, maxHeight } = props;
  const barHeightRef = useRef(0);
  const cardHeightRef = useRef(0);
  const cardHeight = useSharedValue(0);
  const notifyCoverage = () => {
    // The card resizes with the keyboard every frame, so easing each sample would leave the
    // feed inset and floating controls trailing it.
    cardCoverage.set(Math.max(0, cardHeightRef.current - barHeightRef.current));
  };
  const handleBarLayout = (event: LayoutChangeEvent) => {
    barHeightRef.current = event.nativeEvent.layout.height;
    notifyCoverage();
  };
  const handleCardLayout = (event: LayoutChangeEvent) => {
    cardHeightRef.current = event.nativeEvent.layout.height;
    cardHeight.set(event.nativeEvent.layout.height);
    notifyCoverage();
  };
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const progress = cardProgress.value;
    const travel = Platform.OS === "android" ? cardCoverage.value : cardHeight.value;
    return {
      maxHeight: maxHeight.value,
      opacity:
        Platform.OS === "android"
          ? Math.min(1, (progress * cardHeight.value) / Math.max(1, cardHeight.value - travel))
          : 1,
      transform: [{ translateY: (1 - progress) * travel }],
    };
  });
  const androidBoundsStyle = useAnimatedStyle(() => ({
    paddingTop: cardCoverage.value * cardProgress.value,
  }));
  const overlayHeightStyle = useAnimatedStyle(() => ({ height: maxHeight.value }));

  const muted = { fontSize: 14, color: palette.metaInk } as const;
  const progressLabel = questionCount > 1 ? `${activeIndex + 1}/${questionCount}` : null;

  const bar = (
    <View
      onLayout={handleBarLayout}
      pointerEvents={props.collapsed ? "auto" : "none"}
      accessibilityElementsHidden={!props.collapsed}
      importantForAccessibility={props.collapsed ? "auto" : "no-hide-descendants"}
      style={{ height: NO3Y_CONTROL_SIZE, flexDirection: "row", alignItems: "center" }}
    >
      <No3yGlassLayer radius={NO3Y_CONTROL_SIZE / 2} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Expand questions, ${questionCount} question${questionCount === 1 ? "" : "s"}`}
        onPress={props.onToggleCollapsed}
        style={({ pressed }) => ({
          flex: 1,
          height: NO3Y_CONTROL_SIZE,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 16,
          paddingRight: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}>
          Questions
        </Text>
        <Text style={{ ...muted, fontVariant: ["tabular-nums"] }}>{questionCount}</Text>
        <View style={{ flex: 1 }} />
        <HugeIcon icon={ArrowUp01Icon} size={14} color={palette.quietInk} />
      </Pressable>
      {props.onStopThread ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop"
          disabled={!props.canOperateThread}
          onPress={props.onStopThread}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            marginRight: 4,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.statusFailed,
            opacity: !props.canOperateThread ? 0.45 : pressed ? 0.7 : 1,
          })}
        >
          <HugeIcon icon={StopIcon} size={16} color="#FFFFFF" filled />
        </Pressable>
      ) : null}
    </View>
  );

  const footer = no3yQuestionFooter(activeIndex, questionCount);
  const draft = question ? props.drafts[question.id] : undefined;
  const multiSelect = question?.multiSelect === true;
  const customAnswerActive = (draft?.customAnswer ?? "").trim().length > 0;

  const card = (
    <Animated.View
      onLayout={handleCardLayout}
      pointerEvents={props.collapsed ? "none" : "auto"}
      accessibilityElementsHidden={props.collapsed}
      importantForAccessibility={props.collapsed ? "no-hide-descendants" : "auto"}
      style={[{ borderRadius: CARD_RADIUS, overflow: "hidden" }, cardAnimatedStyle]}
    >
      <No3yGlassLayer radius={CARD_RADIUS} />
      <View style={{ padding: 16, gap: 16, flexShrink: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ ...NO3Y_FONT.medium, ...muted }}>Questions</Text>
          {progressLabel ? (
            <Text style={{ ...NO3Y_FONT.medium, ...muted, fontVariant: ["tabular-nums"] }}>
              {progressLabel}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {props.pendingUserInput.dismissible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss question without answering"
              disabled={isResponding}
              hitSlop={8}
              onPress={() => void props.onDismiss()}
              style={{ opacity: isResponding ? 0.4 : 1 }}
            >
              <HugeIcon icon={Cancel01Icon} size={16} color={palette.quietInk} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse questions"
            hitSlop={8}
            onPress={props.onToggleCollapsed}
          >
            <HugeIcon icon={ArrowDown01Icon} size={16} color={palette.quietInk} />
          </Pressable>
        </View>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: 16 }}
        >
          {!canRespond ? (
            <Text style={muted}>
              The provider process for this request is no longer available. Interrupt or restart the
              run to continue.
            </Text>
          ) : null}
          {question ? (
            <>
              <View style={{ gap: 2 }}>
                <QuestionMarkdown
                  markdown={question.question}
                  environmentId={props.environmentId}
                  threadId={props.threadId}
                  workspaceRoot={props.workspaceRoot}
                />
                <Text style={muted}>{multiSelect ? "Select one or more" : "Select one"}</Text>
              </View>
              <View accessibilityRole={multiSelect ? undefined : "radiogroup"} style={{ gap: 8 }}>
                {question.options.map((option) => {
                  const optionValue = option.value ?? option.label.trim();
                  const selected =
                    !customAnswerActive &&
                    isPendingUserInputOptionSelected(question, draft, optionValue);
                  const description =
                    option.description !== option.label ? option.description : undefined;
                  return (
                    <View key={optionValue} style={{ gap: 4 }}>
                      <Pressable
                        accessibilityRole={multiSelect ? "checkbox" : "radio"}
                        accessibilityState={{ checked: selected, disabled: responseDisabled }}
                        disabled={responseDisabled}
                        onPress={() => {
                          props.onSelectOption(
                            props.pendingUserInput.requestId,
                            question,
                            optionValue,
                          );
                          setIndex(
                            no3yQuestionAfterSelect({
                              index: activeIndex,
                              count: questionCount,
                              multiSelect,
                            }),
                          );
                        }}
                        style={({ pressed }) => ({
                          gap: 4,
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: selected ? ink(0.24) : "transparent",
                          backgroundColor: selected ? ink(0.08) : pressed ? ink(0.04) : undefined,
                          opacity: responseDisabled ? 0.5 : 1,
                        })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <OptionControl
                            palette={palette}
                            multiSelect={multiSelect}
                            selected={selected}
                            ring={ink(0.5)}
                          />
                          <Text
                            style={{
                              flex: 1,
                              ...NO3Y_FONT.medium,
                              fontSize: 15,
                              color: palette.titleInk,
                            }}
                          >
                            {option.label}
                          </Text>
                        </View>
                        {description ? (
                          <Text
                            style={{
                              paddingLeft: 24,
                              fontSize: 14,
                              color: selected ? ink(0.8) : palette.quietInk,
                            }}
                          >
                            {description}
                          </Text>
                        ) : null}
                      </Pressable>
                      {option.preview ? (
                        <View style={{ paddingLeft: 34 }}>
                          <QuestionMarkdown
                            markdown={option.preview}
                            environmentId={props.environmentId}
                            threadId={props.threadId}
                            workspaceRoot={props.workspaceRoot}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              {question.allowCustomAnswer !== false ? (
                <QuestionAttachments
                  key={`${props.pendingUserInput.requestId}:${question.id}`}
                  requestId={props.pendingUserInput.requestId}
                  question={question}
                  questions={questions}
                  disabled={responseDisabled}
                  value={draft?.customAnswer ?? ""}
                  onChangeText={(value) =>
                    props.onChangeCustomAnswer(props.pendingUserInput.requestId, question.id, value)
                  }
                  onInputFocusChange={props.onInputFocusChange}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {footer.previous ? (
            <FooterButton
              palette={palette}
              label="Previous"
              outline={ink(0.24)}
              onPress={() => setIndex(Math.max(0, activeIndex - 1))}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          {footer.primary === "next" ? (
            <FooterButton
              palette={palette}
              label="Next"
              outline={ink(0.24)}
              onPress={() => setIndex(Math.min(questionCount - 1, activeIndex + 1))}
            />
          ) : (
            <FooterButton
              palette={palette}
              label={isResponding ? "Submitting…" : "Submit"}
              primary
              outline={ink(0.24)}
              disabled={!props.canOperateThread || responseDisabled || props.answers === null}
              onPress={() => void props.onSubmit()}
            />
          )}
        </View>
        {!props.canOperateThread ? (
          <Text style={{ fontSize: 12, color: palette.faintInk }}>
            This connection cannot submit answers.
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
  return (
    <Animated.View
      style={[{ position: "relative" }, Platform.OS === "android" ? androidBoundsStyle : null]}
    >
      {bar}
      <Animated.View
        pointerEvents={props.collapsed ? "none" : "box-none"}
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "flex-end",
            overflow: "hidden",
          },
          overlayHeightStyle,
        ]}
      >
        {card}
      </Animated.View>
    </Animated.View>
  );
}
