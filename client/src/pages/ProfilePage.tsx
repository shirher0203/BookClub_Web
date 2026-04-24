import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/axios';
import { PostCard } from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { assetUrl } from '../utils/assetUrl';
import { normalizeUserFromApi } from '../utils/authUser';
import { normalizePost } from '../utils/normalizePost';
import { useImageFallback } from '../utils/useImageFallback';
import type { Post, User } from '../types';
import styles from './ProfilePage.module.css';

function ProfilePostsSection({
  userId,
  currentUserId,
}: {
  userId: string;
  currentUserId: string | null;
}): JSX.Element {
  const fetchPage = useCallback(
    async (skip: number, limit: number) => {
      const res = await api.get<{ posts: unknown[]; total: number }>(`/posts/user/${userId}`, {
        params: { skip, limit },
      });
      return {
        items: res.data.posts.map((p) => normalizePost(p as Record<string, unknown>)),
        total: res.data.total,
      };
    },
    [userId]
  );

  const { items, loading, loadMoreRef, hasMore, error, removeItem } = useInfiniteScroll<Post>(fetchPage, 20);

  const showSentinel = useMemo(() => hasMore && items.length > 0, [hasMore, items.length]);

  return (
    <section className={styles.postsSection} aria-labelledby="profile-posts-heading">
      <h2 id="profile-posts-heading" className={styles.postsTitle}>
        Posts
      </h2>
      {error && <p className={styles.postsError}>{error}</p>}
      {items.length === 0 && !loading && !error && (
        <p className={styles.postsEmpty}>No posts yet.</p>
      )}
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onPostDeleted={(id) => removeItem((p) => p.id === id)}
        />
      ))}
      {loading && items.length === 0 && <p className={styles.postsLoading}>Loading…</p>}
      {loading && items.length > 0 && (
        <p className={styles.postsLoadingMore}>Loading more…</p>
      )}
      {showSentinel && (
        <div
          ref={loadMoreRef as RefObject<HTMLDivElement>}
          className={styles.postsSentinel}
          aria-hidden
        />
      )}
    </section>
  );
}

export function ProfilePage(): JSX.Element {
  const { id: routeId } = useParams<{ id: string }>();
  const { user: authUser, isAuthenticated, logout } = useAuth();
  const targetId = routeId ?? authUser?.id ?? '';

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = Boolean(authUser?.id && targetId === authUser.id);
  const imgSrc = assetUrl(profile?.profileImage);
  const avatarFallback = useImageFallback(imgSrc);

  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      setError('Profile not found.');
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await api.get<Record<string, unknown>>(`/users/${targetId}`);
        if (!cancelled) {
          setProfile(normalizeUserFromApi(res.data));
        }
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (!cancelled) {
          setProfile(null);
          setError('Could not load this profile.');
        }
        if (status === 404 && isOwnProfile) {
          try {
            await logout();
          } catch {
            /* ignore */
          }
          if (!cancelled) {
            window.location.assign('/login?error=oauth_failed');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId, isOwnProfile, logout]);

  if (!routeId && !isAuthenticated) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Sign in to view your profile.</p>
        <Link to="/login" className={styles.back}>
          Go to sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error ?? 'Not found.'}</p>
        <Link to="/feed" className={styles.back}>
          ← Back to feed
        </Link>
      </div>
    );
  }

  const initial = profile.username.slice(0, 1).toUpperCase();
  const currentUserId = authUser?.id ?? null;

  return (
    <div className={styles.page}>
      <Link to="/feed" className={styles.back}>
        ← Feed
      </Link>

      <div className={styles.card}>
        <div className={styles.header}>
          {avatarFallback.show ? (
            <img
              src={imgSrc}
              alt={profile.username}
              className={styles.avatar}
              width={88}
              height={88}
              onError={avatarFallback.onError}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className={styles.avatarPh} aria-hidden>
              {initial}
            </span>
          )}
          <div>
            <h1 className={styles.name}>{profile.username}</h1>
            <p className={styles.email}>{profile.email}</p>
          </div>
        </div>

        <ul className={styles.meta}>
          {profile.createdAt && (
            <li>
              Member since{' '}
              {new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </li>
          )}
        </ul>

        {isOwnProfile && (
          <Link to="/profile/edit" className={styles.editLink}>
            Edit profile
          </Link>
        )}
      </div>

      <ProfilePostsSection key={targetId} userId={targetId} currentUserId={currentUserId} />
    </div>
  );
}
