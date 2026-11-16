import { useCallback, useEffect, useRef, useState } from 'react';
import { ListParams, Page } from '../types/admin';

// Loads one admin list with debounced search, filters and paging. A response that arrives after a newer
// request has started is ignored, so fast typing can never show stale rows.
export function useAdminList<T>(
  fetcher: (params: ListParams) => Promise<Page<T>>,
  filters: Record<string, string> = {},
  pageSize = 10
) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    fetcher({ ...(JSON.parse(filterKey) as Record<string, string>), page, pageSize, search })
      .then((result) => {
        if (request === latest.current) setData(result);
      })
      .catch((failure: unknown) => {
        if (request === latest.current) {
          setError(failure instanceof Error ? failure.message : 'Unable to load this list.');
        }
      })
      .finally(() => {
        if (request === latest.current) setLoading(false);
      });
    // fetcher is a stable module-level function; the other inputs are listed explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, filterKey, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { data, items: data?.items ?? [], loading, error, searchInput, setSearchInput, page, setPage, reload };
}
