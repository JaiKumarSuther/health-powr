export function withTimeout<T>(
  promiseOrFactory: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms = 3000
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  const promise = typeof promiseOrFactory === 'function'
    ? promiseOrFactory(controller.signal)
    : promiseOrFactory;

  return promise
    .then((res) => {
      clearTimeout(timeout);
      return res;
    })
    .catch((err) => {
      clearTimeout(timeout);
      // If it was aborted by our timeout, we return null as requested
      if (err?.name === 'AbortError' || err?.code === 'ABORT') {
        return null;
      }
      return null;
    });
}
