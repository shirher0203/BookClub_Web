import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import { assetUrl } from '../utils/assetUrl';
import { useImageFallback } from '../utils/useImageFallback';
import { normalizePost } from '../utils/normalizePost';
import type { Post } from '../types';
import styles from './PostCard.module.css';

function AuthorAvatar({ src, name }: { src?: string; name: string }): JSX.Element {
  const { show, onError } = useImageFallback(src);
  if (show) {
    return (
      <img
        src={src}
        alt={name}
        className={styles.avatar}
        width={40}
        height={40}
        onError={onError}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className={styles.avatarPlaceholder} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function StarRow({ score }: { score: number }): JSX.Element {
  return (
    <span className={styles.stars} aria-label={`${score} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < score ? styles.starOn : styles.starOff}>
          ★
        </span>
      ))}
    </span>
  );
}

export interface PostCardProps {
  post: Post;
  currentUserId?: string | null;
  compact?: boolean;
  onPostUpdated?: (post: Post) => void;
  onPostDeleted?: (postId: string) => void;
}

export function PostCard({
  post,
  currentUserId,
  compact = false,
  onPostUpdated,
  onPostDeleted,
}: PostCardProps): JSX.Element {
  const [merged, setMerged] = useState(post);
  useEffect(() => setMerged(post), [post]);

  const liked = useMemo(
    () =>
      Boolean(
        currentUserId && merged.likes?.some((id) => id === currentUserId)
      ),
    [currentUserId, merged.likes]
  );

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const displayLiked = optimisticLiked ?? liked;
  const displayCount = optimisticCount ?? merged.likesCount;

  const authorName = merged.user?.username ?? 'Member';
  const profileImg = assetUrl(merged.user?.profileImage);
  const authorId = merged.user?.id ?? (merged.userId || null);

  const handleLike = useCallback(async () => {
    if (!currentUserId) return;
    const nextLiked = !displayLiked;
    const nextCount = displayCount + (nextLiked ? 1 : -1);
    setOptimisticLiked(nextLiked);
    setOptimisticCount(Math.max(0, nextCount));

    try {
      const res = await api.post<Record<string, unknown>>(
        `/posts/${merged.id}/like`
      );
      const updated = normalizePost(res.data as Record<string, unknown>);
      setOptimisticLiked(null);
      setOptimisticCount(null);
      setMerged(updated);
      onPostUpdated?.(updated);
    } catch {
      setOptimisticLiked(null);
      setOptimisticCount(null);
    }
  }, [
    currentUserId,
    displayLiked,
    displayCount,
    merged.id,
    onPostUpdated,
  ]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/posts/${merged.id}`);
      onPostDeleted?.(merged.id);
    } catch (err) {
      const serverMessage =
        (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
      setDeleteError(
        typeof serverMessage === 'string' && serverMessage.trim().length > 0
          ? serverMessage
          : 'Could not delete post.'
      );
      setDeleting(false);
    }
  }, [merged.id, onPostDeleted]);

  const imageSrc = assetUrl(merged.image);

  return (
    <article className={compact ? styles.cardCompact : styles.card}>
      <header className={styles.header}>
        {authorId ? (
          <Link
            to={`/profile/${authorId}`}
            className={styles.authorLink}
            aria-label={`View ${authorName}'s profile`}
          >
            <div className={styles.author}>
              <AuthorAvatar src={profileImg} name={authorName} />
              <div>
                <p className={styles.authorName}>{authorName}</p>
                {merged.createdAt && (
                  <time className={styles.date} dateTime={merged.createdAt}>
                    {new Date(merged.createdAt).toLocaleDateString(undefined, {
                      dateStyle: 'medium',
                    })}
                  </time>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <div className={styles.author}>
            <AuthorAvatar src={profileImg} name={authorName} />
            <div>
              <p className={styles.authorName}>{authorName}</p>
              {merged.createdAt && (
                <time className={styles.date} dateTime={merged.createdAt}>
                  {new Date(merged.createdAt).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                </time>
              )}
            </div>
          </div>
        )}
        {currentUserId && merged.userId === currentUserId && (
          <div className={styles.ownerActions}>
            <Link to={`/posts/${merged.id}/edit`} className={styles.editLink}>
              Edit
            </Link>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </header>

      {deleteError && (
        <p className={styles.deleteError} role="alert">
          {deleteError}
        </p>
      )}

      <h2 className={styles.bookTitle}>{merged.bookName}</h2>
      <div className={styles.meta}>
        {merged.bookAuthor && (
          <span className={styles.metaItem}>by {merged.bookAuthor}</span>
        )}
        {merged.genre && (
          <span className={styles.metaItem}>{merged.genre}</span>
        )}
        {merged.score != null && merged.score >= 1 && merged.score <= 5 && (
          <StarRow score={merged.score} />
        )}
      </div>

      {!compact && merged.text && <p className={styles.text}>{merged.text}</p>}

      {imageSrc && (
        <img
          src={imageSrc}
          alt={merged.bookName ? `Cover of ${merged.bookName}` : 'Book cover'}
          className={styles.cover}
          loading="lazy"
        />
      )}

      <footer className={styles.footer}>
        <button
          type="button"
          className={displayLiked ? styles.likeOn : styles.likeOff}
          onClick={handleLike}
          disabled={!currentUserId}
          aria-pressed={displayLiked}
          title={currentUserId ? 'Like' : 'Sign in to like'}
        >
          ♥ {displayCount}
        </button>
        <Link to={`/posts/${merged.id}/comments`} className={styles.commentsLink}>
          💬 {merged.commentsCount}
        </Link>
      </footer>
    </article>
  );
}
