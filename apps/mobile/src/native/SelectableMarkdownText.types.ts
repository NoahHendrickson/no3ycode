export interface NativeMarkdownTextStyle {
  readonly selectionColor?: string;
  readonly selectionHandleColor?: string;
  readonly color: string;
  readonly strongColor: string;
  readonly mutedColor: string;
  readonly linkColor: string;
  readonly inlineCodeColor: string;
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  /** Fills inline code's chip; upstream leaves it transparent. */
  readonly inlineCodeBackgroundColor?: string;
  /** Inline code's size against the body text; upstream sets it at 0.9. */
  readonly inlineCodeFontScale?: number;
  /** The chip's corner radius and side padding; iOS only, upstream draws 2pt corners and no padding. */
  readonly inlineCodeChip?: { readonly radius: number; readonly paddingHorizontal: number };
  /** iOS weight for bold text and headings; the fork otherwise draws them bold. */
  readonly emphasisFontWeight?: "500";
  /** Fills a table's header row; upstream uses the code block fill. */
  readonly tableHeaderBackgroundColor?: string;
  /* fork:end no3y-mobile-redesign */
  readonly codeColor: string;
  readonly codeBackgroundColor: string;
  readonly codeBlockBackgroundColor: string;
  readonly fileTextColor: string;
  readonly quoteMarkerColor: string;
  readonly dividerColor: string;
  readonly contextChipBorderColor?: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontFamily: string;
  readonly headingFontFamily: string;
  readonly boldFontFamily: string;
  readonly headingFontSizes?: ReadonlyArray<number>;
}

export interface SelectableMarkdownSkill {
  readonly name: string;
  readonly displayName?: string | null;
  readonly path?: string;
}

export interface SelectableMarkdownModel {
  readonly source: string;
  readonly label: string;
  readonly providerLabel: string;
  readonly driver: string;
  readonly iconUrl?: string | undefined;
}

export interface MarkdownImageRequest {
  readonly href: string;
  readonly alt: string | null;
  readonly title: string | null;
}

/** Host apps resolve workspace-relative images. Return null to retain Enriched's native media rendering. */
export type MarkdownImageRenderer = (image: MarkdownImageRequest) => import("react").ReactNode;

export type MarkdownImageSourceResolver = (
  image: MarkdownImageRequest,
) =>
  | { uri: string; headers?: Record<string, string> }
  | null
  | Promise<{ uri: string; headers?: Record<string, string> } | null>;

export interface MarkdownFileContextMenuAction {
  readonly id: string;
  readonly title: string;
  readonly disabled?: boolean;
}

export interface MarkdownFileContextMenu {
  readonly title?: string;
  readonly actions: ReadonlyArray<MarkdownFileContextMenuAction>;
}

export interface MarkdownLinkCustomization {
  readonly iconTintColor?: string;
  readonly color?: string;
  readonly label?: string;
  readonly icon?: import("react-native").ImageSourcePropType;
  readonly chip?: { readonly accent?: string; readonly tintsIcon: boolean };
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  /** A file reference, which the no3y reply draws as an inline code chip. */
  readonly fileReference?: true;
  /* fork:end no3y-mobile-redesign */
  /* fork:begin no3y-subagent-link-chip — see .fork/customizations.yaml#no3y-subagent-link-chip */
  /** A neutral capsule in body ink: fill and hairline. */
  readonly capsule?: { readonly surface: string; readonly border: string };
  /* fork:end no3y-subagent-link-chip */
}

export interface SelectableMarkdownTextProps {
  readonly markdown: string;
  readonly textStyle: NativeMarkdownTextStyle;
  readonly skills?: ReadonlyArray<SelectableMarkdownSkill>;
  readonly models?: ReadonlyArray<SelectableMarkdownModel>;
  readonly preserveSoftBreaks?: boolean;
  readonly onLinkPress?: (href: string) => void;
  readonly onCiteText?: (text: string) => void;
  readonly fileContextMenu?: (href: string) => MarkdownFileContextMenu | undefined;
  readonly onFileContextMenuAction?: (href: string, actionId: string) => void;
  readonly linkCustomization?: (href: string) => MarkdownLinkCustomization | undefined;
  readonly contextClipboardFragment?: string;
  readonly renderImage?: MarkdownImageRenderer;
  readonly fileEmbedLabel?: (href: string, standalone: boolean) => string | null;
  readonly resolveImageSource?: MarkdownImageSourceResolver;
  readonly onImagePress?: (href: string) => void;
  /**
   * Makes task checkboxes tappable. The renderer ticks the box itself; `index` counts checkboxes
   * in document order and `checked` is the new state.
   */
  readonly onTaskListItemPress?: (event: {
    readonly index: number;
    readonly checked: boolean;
    readonly text: string;
  }) => void;
  readonly marginTop?: number;
  readonly marginBottom?: number;
  readonly writingDirection?: "ltr" | "rtl";
  readonly textAlign?: "left" | "right";
}
