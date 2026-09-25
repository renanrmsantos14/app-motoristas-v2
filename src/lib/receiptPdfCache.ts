export function createReceiptPdfCache<T>(generate: (model: T) => Promise<Blob>) {
  let current: { key: string; pending: Promise<Blob> } | null = null;

  return {
    clear() {
      current = null;
    },
    get(model: T): Promise<Blob> {
      const key = JSON.stringify(model);
      if (current?.key === key) return current.pending;
      const entry = { key, pending: Promise.resolve().then(() => generate(model)) };
      current = entry;
      void entry.pending.catch(() => {
        if (current === entry) current = null;
      });
      return entry.pending;
    }
  };
}
