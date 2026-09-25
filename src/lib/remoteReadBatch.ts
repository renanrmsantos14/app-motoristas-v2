export function createRemoteReadBatch(limit = 4) {
  let active = 0;
  const waiting: Array<() => void> = [];
  const cached = new Map<string, Promise<unknown>>();

  function next() {
    if (active >= limit) return;
    const start = waiting.shift();
    if (start) start();
  }

  function run<T>(request: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        active += 1;
        void Promise.resolve().then(request).then(resolve, reject).finally(() => {
          active -= 1;
          next();
        });
      });
      next();
    });
  }

  function once<T>(key: string, request: () => Promise<T>): Promise<T> {
    const existing = cached.get(key);
    if (existing) return existing as Promise<T>;
    const pending = run(request).catch((error: unknown) => {
      cached.delete(key);
      throw error;
    });
    cached.set(key, pending);
    return pending;
  }

  return { run, once };
}
