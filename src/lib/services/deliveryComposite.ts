/**
 * Weighted delivery-quality composite across IVP and speech signals.
 * Every signal is expected on a 0-100 scale.
 */

export const DELIVERY_COMPOSITE_WEIGHTS = {
  eyeContactRatio: 0.3,
  postureStability: 0.25,
  affectComposure: 0.2,
  speechDeliveryScore: 0.25,
} as const;

export interface DeliveryCompositeSignals {
  eyeContactRatio?: number;
  postureStability?: number;
  affectComposure?: number;
  speechDeliveryScore?: number;
}

function isPresent(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Computes a 0-100 delivery composite, re-normalizing weights when signals
 * are unavailable. Returns undefined when no signal is present.
 */
export function calculateDeliveryComposite(
  signals: DeliveryCompositeSignals
): number | undefined {
  const weightedSignals = [
    [signals.eyeContactRatio, DELIVERY_COMPOSITE_WEIGHTS.eyeContactRatio],
    [signals.postureStability, DELIVERY_COMPOSITE_WEIGHTS.postureStability],
    [signals.affectComposure, DELIVERY_COMPOSITE_WEIGHTS.affectComposure],
    [signals.speechDeliveryScore, DELIVERY_COMPOSITE_WEIGHTS.speechDeliveryScore],
  ] as const;

  const presentSignals = weightedSignals.filter(
    ([value]) => isPresent(value)
  ) as Array<readonly [number, number]>;

  if (presentSignals.length === 0) return undefined;

  const totalWeight = presentSignals.reduce((sum, [, weight]) => sum + weight, 0);
  const score = presentSignals.reduce(
    (sum, [value, weight]) => sum + clampScore(value) * (weight / totalWeight),
    0
  );

  return Math.round(score * 100) / 100;
}
