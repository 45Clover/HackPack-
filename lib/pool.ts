// Runs fn over items, n at a time, and stops starting new ones once `until` (ms timestamp) has passed.
// fn must catch its own errors: one bad item must not stop the rest.
export async function pool<T>(items: T[], n: number, until: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && Date.now() < until) await fn(items[i++]);
    }),
  );
}
