import { useEffect, useState } from 'react';

// Fetches one record when `id` is set, and clears it when `id` is null. Stale responses are ignored.
export function useAdminDetail<T>(id: string | null, fetcher: (id: string) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!id) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    fetcher(id)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Unable to load the details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // fetcher is a stable module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { data, loading, error };
}
