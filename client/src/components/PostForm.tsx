import { useState, useEffect, FormEvent } from 'react';
import styles from './PostForm.module.css';

export interface PostFormValues {
  bookName: string;
  bookAuthor: string;
  genre: string;
  score: number | '';
  text: string;
  image: File | null;
  removeImage: boolean;
}

const emptyValues: PostFormValues = {
  bookName: '',
  bookAuthor: '',
  genre: '',
  score: '',
  text: '',
  image: null,
  removeImage: false,
};

export interface PostFormProps {
  initial?: Partial<PostFormValues>;
  /** Absolute or server-relative URL of the existing cover image in edit mode. */
  initialImageUrl?: string | null;
  submitLabel?: string;
  onSubmit: (values: PostFormValues) => Promise<void>;
}

export function PostForm({
  initial,
  initialImageUrl,
  submitLabel = 'Publish',
  onSubmit,
}: PostFormProps): JSX.Element {
  const [values, setValues] = useState<PostFormValues>({
    ...emptyValues,
    ...initial,
    bookName: initial?.bookName ?? '',
    bookAuthor: initial?.bookAuthor ?? '',
    genre: initial?.genre ?? '',
    score: initial?.score ?? '',
    text: initial?.text ?? '',
    image: null,
    removeImage: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PostFormValues>(key: K, v: PostFormValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  useEffect(() => {
    if (!values.image) {
      setNewImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(values.image);
    setNewImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [values.image]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!values.bookName.trim()) {
      setError('Book name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      const serverMessage =
        (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
      if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) {
        setError(serverMessage);
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label}>
        Book title <span className={styles.req}>*</span>
        <input
          className={styles.input}
          value={values.bookName}
          onChange={(e) => set('bookName', e.target.value)}
          required
          maxLength={200}
          autoComplete="off"
        />
      </label>

      <label className={styles.label}>
        Author
        <input
          className={styles.input}
          value={values.bookAuthor}
          onChange={(e) => set('bookAuthor', e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
      </label>

      <label className={styles.label}>
        Genre
        <input
          className={styles.input}
          value={values.genre}
          onChange={(e) => set('genre', e.target.value)}
          maxLength={60}
          autoComplete="off"
        />
      </label>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Score (1–5)</legend>
        <div className={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={
                values.score === n ? styles.starBtnActive : styles.starBtn
              }
              onClick={() => set('score', values.score === n ? '' : n)}
              aria-label={`${n} stars`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.label}>
        Review
        <textarea
          className={styles.textarea}
          value={values.text}
          onChange={(e) => set('text', e.target.value)}
          maxLength={5000}
          rows={6}
        />
      </label>

      <div className={styles.label}>
        <span>Cover image</span>
        {newImagePreview ? (
          <img
            src={newImagePreview}
            alt="New cover preview"
            className={styles.coverPreview}
          />
        ) : initialImageUrl && !values.removeImage ? (
          <img
            src={initialImageUrl}
            alt="Current cover"
            className={styles.coverPreview}
          />
        ) : values.removeImage ? (
          <p className={styles.note}>Cover will be removed when you save.</p>
        ) : null}
        <input
          type="file"
          accept="image/*"
          className={styles.file}
          onChange={(e) => {
            set('image', e.target.files?.[0] ?? null);
            set('removeImage', false);
          }}
        />
        {initialImageUrl && !values.image && !values.removeImage && (
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => set('removeImage', true)}
          >
            Remove cover
          </button>
        )}
        {values.removeImage && (
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => set('removeImage', false)}
          >
            Keep current cover
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
