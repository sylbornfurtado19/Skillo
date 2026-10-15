/**
 * Order-preserving downsampling helpers shared by the client (before submitting
 * interview telemetry) and the evaluate API route (defence in depth).
 */

/**
 * Picks `max` items spread evenly across `items`, always keeping the first and
 * last element. Returns the input unchanged when it already fits.
 */
export function downsampleEvenly<T>(items: readonly T[], max: number): T[] {
  const limit = Math.floor(max);
  if (!Number.isFinite(limit) || limit <= 0) return [];
  if (items.length <= limit) return [...items];
  if (limit === 1) return [items[0]];

  const result: T[] = [];
  const lastIndex = items.length - 1;
  for (let i = 0; i < limit; i++) {
    result.push(items[Math.round((i * lastIndex) / (limit - 1))]);
  }
  return result;
}

/**
 * Downsamples `items` to at most `max` entries while keeping every group
 * (for example every question) represented. The budget is split evenly across
 * groups, each group is sampled evenly, and the original order is preserved.
 */
export function downsampleByGroup<T>(
  items: readonly T[],
  max: number,
  getGroup: (item: T) => string | undefined
): T[] {
  const limit = Math.floor(max);
  if (!Number.isFinite(limit) || limit <= 0) return [];
  if (items.length <= limit) return [...items];

  const groups = new Map<string, Array<{ item: T; index: number }>>();
  items.forEach((item, index) => {
    const key = getGroup(item) ?? '';
    const bucket = groups.get(key);
    if (bucket) bucket.push({ item, index });
    else groups.set(key, [{ item, index }]);
  });

  const perGroup = Math.max(1, Math.floor(limit / groups.size));
  let kept: Array<{ item: T; index: number }> = [];
  for (const bucket of groups.values()) {
    kept.push(...downsampleEvenly(bucket, perGroup));
  }

  // More groups than budget: keep an even spread of what remains.
  if (kept.length > limit) {
    kept.sort((a, b) => a.index - b.index);
    kept = downsampleEvenly(kept, limit);
  }

  return kept.sort((a, b) => a.index - b.index).map((entry) => entry.item);
}
