/**
 * What the no3y iOS composer's compaction banner says and offers — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Like the Mac's resume card, compacting is the
 * default and keeping the full history is the dismiss; once kept, Compact brings it back.
 */
export function no3yCompactBannerCopy(keepFullHistory: boolean): {
  readonly message: string;
  readonly action: { readonly kind: "dismiss" | "pill"; readonly label: string };
} {
  return keepFullHistory
    ? { message: "Next message keeps full history", action: { kind: "pill", label: "Compact" } }
    : {
        message: "Next message compacts history",
        action: { kind: "dismiss", label: "Keep the full history" },
      };
}
