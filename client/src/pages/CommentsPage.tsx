import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/axios';
import { CommentItem } from '../components/CommentItem';
import { PostCard } from '../components/PostCard';
import { getUserIdFromAccessToken } from '../utils/jwt';
import { normalizeComment, normalizePost } from '../utils/normalizePost';
import type { Comment, Post } from '../types';
import styles from './CommentsPage.module.css';

export function CommentsPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = getUserIdFromAccessToken();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load(): Promise<void> {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [postRes, commentsRes] = await Promise.all([
        api.get<Record<string, unknown>>(`/posts/${id}`),
        api.get<unknown[]>(`/comments`, { params: { postId: id } }),
      ]);
      setPost(normalizePost(postRes.data));
      setComments(
        (commentsRes.data as Record<string, unknown>[]).map((c) =>
          normalizeComment(c)
        )
      );
    } catch {
      setError('Could not load this discussion.');
      setPost(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!id || !text.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<Record<string, unknown>>('/comments', {
        postId: id,
        text: text.trim(),
      });
      setComments((prev) => [...prev, normalizeComment(res.data)]);
      setText('');
      setPost((p) =>
        p ? { ...p, commentsCount: p.commentsCount + 1 } : p
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleted(commentId: string): void {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPost((p) =>
      p ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
    );
  }

  if (!id) {
    return (
      <div className={styles.page}>
        <p>Invalid post.</p>
        <Link to="/feed">Back to feed</Link>
      </div>
    );
  }

  if (loading && !post) {
    return (
      <div className={styles.page}>
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error ?? 'Not found.'}</p>
        <Link to="/feed">Back to feed</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link to="/feed">← Feed</Link>
      </p>
      <PostCard
        post={post}
        currentUserId={currentUserId}
        onPostDeleted={() => navigate('/feed', { replace: true })}
      />

      <section className={styles.section} aria-labelledby="comments-heading">
        <h2 id="comments-heading" className={styles.h2}>
          Comments ({comments.length})
        </h2>
        <ul className={styles.list}>
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
        {comments.length === 0 && (
          <p className={styles.none}>No comments yet — start the thread.</p>
        )}
      </section>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="comment-text">
          Add a comment
        </label>
        <textarea
          id="comment-text"
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={
            currentUserId ? 'Write something…' : 'Sign in to comment'
          }
          disabled={!currentUserId}
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={!currentUserId || submitting || !text.trim()}
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </form>
    </div>
  );
}
