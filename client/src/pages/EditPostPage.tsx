import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/axios';
import { PostForm, type PostFormValues } from '../components/PostForm';
import { normalizePost } from '../utils/normalizePost';
import styles from './EditPostPage.module.css';

export function EditPostPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<Partial<PostFormValues> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<Record<string, unknown>>(`/posts/${id}`);
        if (cancelled) return;
        const p = normalizePost(res.data);
        setInitial({
          bookName: p.bookName,
          bookAuthor: p.bookAuthor ?? '',
          genre: p.genre ?? '',
          score: p.score ?? '',
          text: p.text,
        });
      } catch {
        setLoadError('Could not load this post.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(values: PostFormValues): Promise<void> {
    if (!id) return;
    const fd = new FormData();
    fd.append('bookName', values.bookName.trim());
    if (values.bookAuthor.trim()) fd.append('bookAuthor', values.bookAuthor.trim());
    else fd.append('bookAuthor', '');
    if (values.genre.trim()) fd.append('genre', values.genre.trim());
    else fd.append('genre', '');
    if (values.score !== '') fd.append('score', String(values.score));
    else fd.append('score', '');
    fd.append('text', values.text.trim());
    if (values.image) fd.append('image', values.image);

    await api.put(`/posts/${id}`, fd);
    navigate('/feed', { replace: true });
  }

  if (!id) {
    return (
      <div className={styles.page}>
        <p>Invalid post.</p>
        <Link to="/feed">Back to feed</Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{loadError}</p>
        <Link to="/feed">Back to feed</Link>
      </div>
    );
  }

  if (!initial) {
    return (
      <div className={styles.page}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Edit review</h1>
      <PostForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
