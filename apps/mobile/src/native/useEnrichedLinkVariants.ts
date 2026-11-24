import { modelChipIcon } from "../lib/contextChipIconSource";
import { useMemo } from "react";
import {
  assistantCitationLabel,
  parseAssistantCitationHref,
} from "@t3tools/shared/assistantCitations";
import { Image } from "react-native";
/* fork:begin no3y-subagent-link-chip — see .fork/customizations.yaml#no3y-subagent-link-chip */
import { StyleSheet } from "react-native";
/* fork:end no3y-subagent-link-chip */
import type { LinkPillContent, MarkdownStyle } from "react-native-enriched-markdown";
import type { ComposerContextRecord } from "@t3tools/contracts";
import { contextChipAccent, contextChipPresentation } from "../lib/composerChipPresentation";
import { CONTEXT_CHIP_ICON_SOURCES } from "../lib/contextChipIcons.generated";
import { FONT_FAMILIES } from "../lib/fontFamilies";
import { contextChipIconSource } from "../lib/contextChipIconSource";
import { markdownFileIconSource } from "../lib/markdownFileIcons";
import { markdownLinkIcon } from "../lib/markdownLinkIcons";
import { useUniwindTheme } from "../lib/useUniwindTheme";
import { resolveMarkdownFileIcon, resolveMarkdownLinkPresentation } from "../lib/markdownLinks";
import type {
  MarkdownLinkCustomization,
  SelectableMarkdownTextProps,
} from "./SelectableMarkdownText.types";
import {
  enrichedContextLinkPresentation,
  enrichedLinkVariantPattern,
  enrichedModelReference,
  enrichedSkillReference,
  enrichedThreadLinkPresentation,
} from "../lib/enrichedLinkPresentation";
import { formatProviderSkillDisplayName } from "@t3tools/shared/inlineSkills";

function chipCustomization(
  chip: ReturnType<typeof enrichedContextLinkPresentation>,
): MarkdownLinkCustomization | undefined {
  if (!chip) return undefined;
  return {
    label: chip.label,
    icon: contextChipIconSource(chip.icon),
    chip: { accent: chip.accent, tintsIcon: chip.icon.kind === "chip" },
  };
}

export function enrichedContextLinkCustomization(
  href: string,
  records?: ReadonlyArray<ComposerContextRecord>,
) {
  return chipCustomization(enrichedContextLinkPresentation(href, records));
}

export function enrichedThreadLinkCustomization(href: string) {
  return chipCustomization(enrichedThreadLinkPresentation(href));
}

export function withChipIcon(
  customization: MarkdownLinkCustomization | undefined,
  iconUri: string | undefined,
): MarkdownLinkCustomization | undefined {
  return iconUri && customization?.chip
    ? {
        ...customization,
        icon: { uri: iconUri },
        chip: { ...customization.chip, tintsIcon: false },
      }
    : customization;
}

function presentation(
  url: string,
  props: Pick<SelectableMarkdownTextProps, "linkCustomization" | "skills" | "models" | "textStyle">,
): MarkdownLinkCustomization | undefined {
  const custom = props.linkCustomization?.(url);
  if (custom) return custom;
  const citation = parseAssistantCitationHref(url);
  if (citation)
    return {
      label: assistantCitationLabel(citation),
      icon: CONTEXT_CHIP_ICON_SOURCES["message-circle"],
      chip: { accent: contextChipPresentation("citation").accent, tintsIcon: true },
    };
  const context = enrichedContextLinkCustomization(url);
  if (context) return context;
  const skill = enrichedSkillReference(url, props.skills);
  if (skill)
    return {
      label: formatProviderSkillDisplayName(skill),
      icon: CONTEXT_CHIP_ICON_SOURCES.skill,
      chip: { accent: contextChipPresentation("skill").accent, tintsIcon: true },
    };
  const model = enrichedModelReference(url, props.models);
  if (model) {
    const icon = modelChipIcon(model);
    return {
      label: model.label,
      icon: icon.source,
      chip: {
        accent: icon.accent,
        tintsIcon: icon.tintsIcon,
      },
    };
  }
  const link = resolveMarkdownLinkPresentation(url);
  if (link.kind === "file")
    return {
      label: link.label,
      icon: markdownFileIconSource(link.icon),
      chip: { accent: contextChipPresentation("mention").accent, tintsIcon: false },
      /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
      fileReference: true,
      /* fork:end no3y-mobile-redesign */
    };
  const icon = link.kind === "external" ? markdownLinkIcon(link.host) : null;
  return icon
    ? {
        color: props.textStyle.linkColor,
        icon: icon.source,
        ...(icon.tints ? { iconTintColor: props.textStyle.linkColor } : {}),
      }
    : undefined;
}

export function useEnrichedLinkVariants(
  urls: ReadonlyArray<string>,
  props: SelectableMarkdownTextProps,
  fileHrefs: ReadonlySet<string>,
) {
  const { linkCustomization, skills, models, textStyle, fileEmbedLabel } = props;
  const theme = useUniwindTheme();
  const links = useMemo(() => {
    const byUrl = new Map<string, MarkdownLinkCustomization>();
    for (const url of urls) {
      if (byUrl.has(url)) continue;
      const label = fileHrefs.has(url) ? fileEmbedLabel?.(url, false) : null;
      const value = label
        ? {
            label,
            color: textStyle.fileTextColor,
            icon: markdownFileIconSource(resolveMarkdownFileIcon(label)),
            /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
            fileReference: true as const,
            /* fork:end no3y-mobile-redesign */
          }
        : presentation(url, { linkCustomization, skills, models, textStyle });
      if (value) byUrl.set(url, value);
    }
    return byUrl;
  }, [urls, linkCustomization, skills, models, textStyle, fileHrefs, fileEmbedLabel]);
  const chipForegrounds = useMemo(
    () =>
      new Map(
        [...links].map(([url, link]) => [
          url,
          link.chip
            ? (contextChipAccent(link.chip.accent, theme, textStyle.color) ?? textStyle.color)
            : undefined,
        ]),
      ),
    [links, textStyle, theme],
  );
  const linkVariants = useMemo<MarkdownStyle["linkVariants"]>(
    () =>
      Object.fromEntries(
        [...links].map(([url, link]) => {
          /* fork:begin no3y-subagent-link-chip — see .fork/customizations.yaml#no3y-subagent-link-chip */
          if (link.capsule) {
            return [
              enrichedLinkVariantPattern(url),
              {
                // No vertical padding and a smaller label: the capsule, border included, stands
                // as tall as an inline code chip.
                pill: {
                  borderColor: link.capsule.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 999,
                  paddingHorizontal: 6,
                  paddingVertical: 0,
                  fontScale: 0.9,
                },
                fontFamily: FONT_FAMILIES.medium,
                color: textStyle.color,
                underline: false,
                backgroundColor: link.capsule.surface,
              },
            ];
          }
          /* fork:end no3y-subagent-link-chip */
          /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
          // A file reference wears inline code's chip and ink when the reply styles one.
          const codeChip =
            link.fileReference && textStyle.inlineCodeBackgroundColor !== undefined
              ? textStyle.inlineCodeChip
              : undefined;
          const chipForeground = codeChip ? undefined : chipForegrounds.get(url);
          /* fork:end no3y-mobile-redesign */
          return [
            enrichedLinkVariantPattern(url),
            {
              pill: {
                borderColor: "transparent",
                borderWidth: 0,
                /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
                borderRadius: codeChip?.radius ?? 6,
                paddingHorizontal: codeChip?.paddingHorizontal ?? 5,
                paddingVertical: codeChip?.paddingVertical ?? 2,
                // At inline code's size, so the chip matches a code chip's height.
                fontScale: codeChip ? textStyle.inlineCodeFontScale : undefined,
                /* fork:end no3y-mobile-redesign */
              },
              fontFamily: chipForeground ? FONT_FAMILIES.medium : textStyle.fontFamily,
              /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
              color:
                chipForeground ?? (codeChip ? undefined : link.color) ?? textStyle.fileTextColor,
              underline: false,
              backgroundColor: codeChip ? textStyle.inlineCodeBackgroundColor : "transparent",
              /* fork:end no3y-mobile-redesign */
            },
          ];
        }),
      ),
    [chipForegrounds, links, textStyle],
  );
  const linkPillContent = useMemo<Record<string, LinkPillContent>>(
    () =>
      Object.fromEntries(
        [...links].map(([url, link]) => [
          url,
          {
            label: link.label,
            iconUri: link.icon ? Image.resolveAssetSource(link.icon)?.uri : undefined,
            iconTintColor: link.chip?.tintsIcon ? chipForegrounds.get(url) : link.iconTintColor,
          },
        ]),
      ),
    [chipForegrounds, links],
  );
  return { linkVariants, linkPillContent };
}
