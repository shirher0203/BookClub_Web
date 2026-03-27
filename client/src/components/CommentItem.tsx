import { useState } from 'react';
import { api } from '../api/axios';
import { assetUrl } from '../utils/assetUrl';
import type { Comment } from '../types';
import styles from './CommentItem.module.css';

export interface CommentItemProps {
  comment: Comment;
  currentUserId?: string | null;
  onDeleted?: (commentId: string) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  onDeleted,
}: CommentItemProps): JSX.Element {
  const [deleting, setDeleting] = useState(false);
  const isOwn = Boolean(currentUserId && comment.userId === currentUserId);
  const name = comment.user?.username ?? 'Member';
  const avatar = assetUrl(comment.user?.profileImage);

  async function handleDelete(): Promise<void> {
    if (!isOwn) return;
    if (!window.confirm('Delete this comment?')) return;
    setDeleting(true);
    try {
      await api.delete(`/comments/${comment.id}`);
      onDeleted?.(comment.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        {avatar ? (
          <img src={avatar} alt="" className={styles.avatar} width={36} height={36} />
        ) : (
          <div className={styles.avatarPh} aria-hidden>
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className={styles.body}>
          <div className={styles.top}>
            <span className={styles.name}>{name}</span>
            <time className={styles.time} dateTime={comment.createdAt}>
              {new Date(comment.createdAt).toLocaleString()}
            </time>
          </div>
          <p className={styles.text}>{comment.text}</p>
        </div>
        {isOwn && (
          <button
            type="button"
            className={styles.delete}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '…' : 'Delete'}
          </button>
        )}
      </div>
    </li>
  );
}
