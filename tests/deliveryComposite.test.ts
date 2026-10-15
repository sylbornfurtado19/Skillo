import {
  calculateDeliveryComposite,
  DELIVERY_COMPOSITE_WEIGHTS,
} from '../src/lib/services/deliveryComposite';

describe('calculateDeliveryComposite', () => {
  it('combines all available signals using the exported weights', () => {
    const result = calculateDeliveryComposite({
      eyeContactRatio: 80,
      postureStability: 70,
      affectComposure: 90,
      speechDeliveryScore: 60,
    });

    expect(result).toBe(
      80 * DELIVERY_COMPOSITE_WEIGHTS.eyeContactRatio +
      70 * DELIVERY_COMPOSITE_WEIGHTS.postureStability +
      90 * DELIVERY_COMPOSITE_WEIGHTS.affectComposure +
      60 * DELIVERY_COMPOSITE_WEIGHTS.speechDeliveryScore
    );
  });

  it('re-normalizes weights when a signal is missing', () => {
    const result = calculateDeliveryComposite({
      eyeContactRatio: 80,
      postureStability: 60,
      speechDeliveryScore: 100,
    });
    const expectedWeight = DELIVERY_COMPOSITE_WEIGHTS.eyeContactRatio
      + DELIVERY_COMPOSITE_WEIGHTS.postureStability
      + DELIVERY_COMPOSITE_WEIGHTS.speechDeliveryScore;

    expect(result).toBe(
      (80 * DELIVERY_COMPOSITE_WEIGHTS.eyeContactRatio
        + 60 * DELIVERY_COMPOSITE_WEIGHTS.postureStability
        + 100 * DELIVERY_COMPOSITE_WEIGHTS.speechDeliveryScore) / expectedWeight
    );
  });

  it('handles all missing signals without inventing a score', () => {
    expect(calculateDeliveryComposite({})).toBeUndefined();
  });

  it('treats zero as a present signal and clamps out-of-range values', () => {
    expect(calculateDeliveryComposite({
      eyeContactRatio: 0,
      speechDeliveryScore: 120,
    })).toBe(45.45);
  });
});
