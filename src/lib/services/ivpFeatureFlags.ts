/**
 * IVP Feature Flags & Canary Rollout Registry
 *
 * Provides runtime gating for experimental vision algorithms:
 * - Lucas-Kanade optical flow fallback
 * - Statistical PCA shape prior projection
 * - Region-level confidence fusion
 * - Per-device adaptive thresholding
 * - Safe Mode fallback (disables all non-essential experimental processing)
 * - Opt-in local-only telemetry
 *
 * Supports configuration via:
 * 1. URL Query Parameters (e.g. `?ivp_safemode=1` or `?ivp_lk=0&ivp_pca=1`)
 * 2. LocalStorage persistence (`ivp_feature_flags`)
 * 3. Programmatic runtime overrides with event subscriptions
 */

export interface IVPFeatureFlags {
  enableLkFallback: boolean;
  enablePcaProjection: boolean;
  enableRegionFusion: boolean;
  enableDeviceAdaptive: boolean;
  enableSafeMode: boolean;
  enableTelemetryOptIn: boolean;
  enableWarmup: boolean;
}

export const DEFAULT_IVP_FEATURE_FLAGS: IVPFeatureFlags = {
  enableLkFallback: true,
  enablePcaProjection: true,
  enableRegionFusion: true,
  enableDeviceAdaptive: true,
  enableSafeMode: false,
  enableTelemetryOptIn: false,
  enableWarmup: true,
};

const STORAGE_KEY = 'ivp_feature_flags';

type FlagChangeListener = (flags: IVPFeatureFlags) => void;
const listeners = new Set<FlagChangeListener>();

function parseQueryFlags(): Partial<IVPFeatureFlags> {
  if (typeof window === 'undefined' || !window.location || !window.location.search) {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const overrides: Partial<IVPFeatureFlags> = {};

  if (params.has('ivp_safemode')) {
    overrides.enableSafeMode = params.get('ivp_safemode') === '1' || params.get('ivp_safemode') === 'true';
  }
  if (params.has('ivp_lk')) {
    overrides.enableLkFallback = params.get('ivp_lk') === '1' || params.get('ivp_lk') === 'true';
  }
  if (params.has('ivp_pca')) {
    overrides.enablePcaProjection = params.get('ivp_pca') === '1' || params.get('ivp_pca') === 'true';
  }
  if (params.has('ivp_fusion')) {
    overrides.enableRegionFusion = params.get('ivp_fusion') === '1' || params.get('ivp_fusion') === 'true';
  }
  if (params.has('ivp_adaptive')) {
    overrides.enableDeviceAdaptive = params.get('ivp_adaptive') === '1' || params.get('ivp_adaptive') === 'true';
  }
  if (params.has('ivp_telemetry')) {
    overrides.enableTelemetryOptIn = params.get('ivp_telemetry') === '1' || params.get('ivp_telemetry') === 'true';
  }
  if (params.has('ivp_warmup')) {
    overrides.enableWarmup = params.get('ivp_warmup') === '1' || params.get('ivp_warmup') === 'true';
  }
  return overrides;
}

function parseStorageFlags(): Partial<IVPFeatureFlags> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[IVPFeatureFlags] LocalStorage read warning:', err);
  }
  return {};
}

let activeFlags: IVPFeatureFlags = {
  ...DEFAULT_IVP_FEATURE_FLAGS,
  ...parseStorageFlags(),
  ...parseQueryFlags(),
};

/**
 * Returns current snapshot of active feature flags.
 * If safeMode is enabled, experimental flags are automatically treated as disabled.
 */
export function getIVPFeatureFlags(): IVPFeatureFlags {
  if (activeFlags.enableSafeMode) {
    return {
      ...activeFlags,
      enableLkFallback: false,
      enablePcaProjection: false,
      enableRegionFusion: false,
      enableDeviceAdaptive: false,
    };
  }
  return { ...activeFlags };
}

/**
 * Returns raw flag state without safe-mode overriding.
 */
export function getRawIVPFeatureFlags(): IVPFeatureFlags {
  return { ...activeFlags };
}

/**
 * Sets a specific feature flag and persists to localStorage.
 */
export function setIVPFeatureFlag<K extends keyof IVPFeatureFlags>(
  key: K,
  value: IVPFeatureFlags[K]
): void {
  activeFlags[key] = value;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activeFlags));
    } catch (err) {
      console.warn('[IVPFeatureFlags] LocalStorage write warning:', err);
    }
  }
  notifyListeners();
}

/**
 * Resets all feature flags to defaults.
 */
export function resetIVPFeatureFlags(): void {
  activeFlags = { ...DEFAULT_IVP_FEATURE_FLAGS };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  notifyListeners();
}

/**
 * Subscribes to feature flag mutations.
 */
export function subscribeIVPFeatureFlags(listener: FlagChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  const current = getIVPFeatureFlags();
  for (const listener of listeners) {
    try {
      listener(current);
    } catch (e) {
      console.error('[IVPFeatureFlags] Listener notification error:', e);
    }
  }
}
