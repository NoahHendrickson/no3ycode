/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. Upstream's send hook calls this;
 * installNo3yPushRegistration fills it. Dependency-free so remoteRegistration's mocked tests load.
 */
type ArmOnSend = (input: { readonly threadTitle: string }) => void;

let armOnSend: ArmOnSend | null = null;

export function setNo3yLiveActivityArmOnSend(next: ArmOnSend | null): void {
  armOnSend = next;
}

/** False for an upstream-identity build, whose relay path runs instead. */
export function armNo3yLiveActivityOnSend(input: Parameters<ArmOnSend>[0]): boolean {
  if (armOnSend === null) return false;
  armOnSend(input);
  return true;
}
