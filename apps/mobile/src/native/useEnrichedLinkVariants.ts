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
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import type { No3yChipSizes } from "../../fork/no3yChipHeight";
/* fork:end no3y-mobile-redesign */

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
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  chipSizes?: No3yChipSizes,
  /* fork:end no3y-mobile-redesign */
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
                // Where the reply draws code as a chip, the capsule takes its height (no3yChipSizes).
                pill: {
                  borderColor: link.capsule.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 999,
                  paddingHorizontal: 6,
                  paddingVertical: 0,
                  ...chipSizes?.capsule,
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
          // A file reference wears inline code's chip, ink and size when the reply styles one.
          const codeChip =
            link.fileReference && textStyle.inlineCodeBackgroundColor !== undefined
              ? textStyle.inlineCodeChip
              : undefined;
          if (codeChip) {
            return [
              enrichedLinkVariantPattern(url),
              {
                pill: {
                  borderColor: "transparent",
                  borderWidth: 0,
                  borderRadius: codeChip.radius,
                  paddingHorizontal: codeChip.paddingHorizontal,
                  paddingVertical: 0,
                  fontScale: codeChip.fontScale,
                  ...chipSizes?.file,
                },
                fontFamily: textStyle.fontFamily,
                color: textStyle.fileTextColor,
                underline: false,
                backgroundColor: textStyle.inlineCodeBackgroundColor,
              },
            ];
          }
          /* fork:end no3y-mobile-redesign */
          const chipForeground = chipForegrounds.get(url);
          return [
            enrichedLinkVariantPattern(url),
            {
              pill: {
                borderColor: "transparent",
                borderWidth: 0,
                borderRadius: 6,
                paddingHorizontal: 5,
                paddingVertical: 2,
              },
              fontFamily: chipForeground ? FONT_FAMILIES.medium : textStyle.fontFamily,
              color: chipForeground ?? link.color ?? textStyle.fileTextColor,
              underline: false,
              backgroundColor: "transparent",
            },
          ];
        }),
      ),
    [chipForegrounds, links, textStyle, chipSizes],
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
