import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';
import { normalizeUserFromApi } from '../utils/authUser';
import { useImageFallback } from '../utils/useImageFallback';
import styles from './EditProfilePage.module.css';

export function EditProfilePage(): JSX.Element {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('username', username.trim());
      fd.append('email', email.trim());
      if (file) {
        fd.append('profileImage', file);
      } else if (removeImage) {
        fd.append('removeProfileImage', 'true');
      }

      const res = await api.put<Record<string, unknown>>('/users/profile', fd);
      const next = normalizeUserFromApi(res.data);
      setUser(next);
      localStorage.setItem('authUser', JSON.stringify(next));
      setFile(null);
      setRemoveImage(false);
    } catch {
      setError('Could not update profile. Check username and email are unique.');
    } finally {
      setSubmitting(false);
    }
  }

  const currentImg = assetUrl(user?.profileImage);
  const previewSrc = preview ?? currentImg ?? '';
  const previewFallback = useImageFallback(previewSrc);

  return (
    <div className={styles.page}>
      <Link to="/profile" className={styles.back}>
        ← Profile
      </Link>
      <h1 className={styles.title}>Edit profile</h1>
      <p className={styles.subtitle}>Update how you appear in the club</p>

      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-username">
            Username
          </label>
          <input
            id="edit-username"
            className={styles.input}
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-email">
            Email
          </label>
          <input
            id="edit-email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-photo">
            Profile photo
          </label>
          <input
            id="edit-photo"
            className={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={(ev) => {
              setFile(ev.target.files?.[0] ?? null);
              setRemoveImage(false);
            }}
          />
          {removeImage ? (
            <p className={styles.note}>Picture will be removed when you save.</p>
          ) : (
            previewFallback.show && (
              <img
                src={previewSrc}
                alt=""
                className={styles.preview}
                width={120}
                height={120}
                onError={previewFallback.onError}
                referrerPolicy="no-referrer"
              />
            )
          )}
          {currentImg && !file && !removeImage && (
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => setRemoveImage(true)}
            >
              Remove picture
            </button>
          )}
          {removeImage && (
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => setRemoveImage(false)}
            >
              Keep current picture
            </button>
          )}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
