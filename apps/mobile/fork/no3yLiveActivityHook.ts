/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. Upstream's send hook calls this;
 * installNo3yPushRegistration fills it. Dependency-free so remoteRegistration's mocked tests load.
 */
type ArmOnSend = (input: {
  readonly threadTitle: string;
  readonly projectTitle: string;
}) => boolean;

let armOnSend: ArmOnSend = () => false;

export function setNo3yLiveActivityArmOnSend(next: ArmOnSend): void {
  armOnSend = next;
}

/** False for an upstream-identity build, whose relay path runs instead. */
export function armNo3yLiveActivityOnSend(input: Parameters<ArmOnSend>[0]): boolean {
  return armOnSend(input);
}
