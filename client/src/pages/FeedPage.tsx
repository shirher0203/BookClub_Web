import { useCallback, useMemo, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import { PostCard } from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { normalizePost } from '../utils/normalizePost';
import type { Post } from '../types';
import styles from './FeedPage.module.css';

export function FeedPage(): JSX.Element {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const fetchPage = useCallback(
    async (skip: number, limit: number) => {
      const res = await api.get<{ posts: unknown[]; total: number }>('/posts', {
        params: { skip, limit },
      });
      return {
        items: res.data.posts.map((p) =>
          normalizePost(p as Record<string, unknown>)
        ),
        total: res.data.total,
      };
    },
    []
  );

  const { items, loading, loadMoreRef, hasMore, error } =
    useInfiniteScroll<Post>(fetchPage, 20);

  const showSentinel = useMemo(
    () => hasMore && items.length > 0,
    [hasMore, items.length]
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Community feed</h1>
        <Link to="/posts/new" className={styles.newBtn}>
          New review
        </Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {items.length === 0 && !loading && !error && (
        <p className={styles.empty}>No posts yet. Be the first to share a book!</p>
      )}

      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
        />
      ))}

      {loading && items.length === 0 && (
        <p className={styles.loading}>Loading…</p>
      )}
      {loading && items.length > 0 && (
        <p className={styles.loadingMore}>Loading more…</p>
      )}

      {showSentinel && (
        <div
          ref={loadMoreRef as RefObject<HTMLDivElement>}
          className={styles.sentinel}
          aria-hidden
        />
      )}
    </div>
  );
}
