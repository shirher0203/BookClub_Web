import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInfiniteScrollResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  error: string | null;
  removeItem: (predicate: (item: T) => boolean) => void;
}

/**
 * Loads pages with `skip` cursor; when `loadMoreRef` sentinel is visible, loads next page.
 */
export function useInfiniteScroll<T>(
  fetchPage: (skip: number, limit: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 20
): UseInfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const skipRef = useRef(0);
  const loadingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const startSkip = skipRef.current;
      const { items: newItems, total: t } = await fetchPageRef.current(
        startSkip,
        pageSize
      );
      setTotal(t);
      skipRef.current = startSkip + newItems.length;
      setItems((prev) => (startSkip === 0 ? newItems : [...prev, ...newItems]));
      setHasMore(skipRef.current < t);
    } catch {
      setError('Failed to load.');
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    skipRef.current = 0;
    setItems([]);
    setHasMore(true);
    void load();
  }, [load]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load();
      },
      { rootMargin: '160px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [load, hasMore, items.length]);

  const removeItem = useCallback((predicate: (item: T) => boolean): void => {
    setItems((prev) => {
      const next = prev.filter((item) => !predicate(item));
      const removed = prev.length - next.length;
      if (removed > 0) {
        skipRef.current = Math.max(0, skipRef.current - removed);
        setTotal((t) => Math.max(0, t - removed));
      }
      return next;
    });
  }, []);

  return { items, total, loading, loadMoreRef, hasMore, error, removeItem };
}
