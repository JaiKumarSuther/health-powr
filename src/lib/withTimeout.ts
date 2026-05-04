export function withTimeout<T>(
  promiseOrFactory: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms = 3000
): Promise<T | null> {
  const controller = new AbortController();

  const promise = typeof promiseOrFactory === 'function'
    ? promiseOrFactory(controller.signal)
    : promiseOrFactory;

  // Race the actual promise against a deadline that resolves to null.
  // This guarantees the timeout fires even if the inner promise never
  // uses the AbortSignal (e.g. a Supabase query that ignores it).
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        controller.abort();
        resolve(null);
      }, ms)
    ),
  ]).catch(() => null);
}
