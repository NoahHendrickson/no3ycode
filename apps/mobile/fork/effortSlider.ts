/**
 * Geometry for the model sheet's effort slider — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Level i's stop is the thumb's centre when
 * it rests at i; a touch anywhere on the track picks the nearest stop.
 */

export interface EffortTrack {
  readonly width: number;
  readonly thumbWidth: number;
  readonly levels: number;
}

/** The x of level `index`'s stop, where the thumb's centre sits. */
export function effortStopX(track: EffortTrack, index: number): number {
  const travel = Math.max(0, track.width - track.thumbWidth);
  const last = track.levels - 1;
  return track.thumbWidth / 2 + (last > 0 ? (index / last) * travel : 0);
}

/** The level whose stop is nearest `x`, clamped to the track. */
export function effortLevelAt(track: EffortTrack, x: number): number {
  const last = track.levels - 1;
  const travel = track.width - track.thumbWidth;
  if (last <= 0 || travel <= 0) return 0;
  const share = (x - track.thumbWidth / 2) / travel;
  return Math.max(0, Math.min(last, Math.round(share * last)));
}
