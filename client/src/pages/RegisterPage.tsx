import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthSection } from '../components/GoogleAuthSection';
import { useAuth } from '../context/AuthContext';
import styles from './RegisterPage.module.css';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function RegisterPage(): JSX.Element {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profileImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(profileImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profileImage]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setProfileImage(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Profile picture must be an image.');
      setProfileImage(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Profile picture must be 5 MB or smaller.');
      setProfileImage(null);
      return;
    }
    setError(null);
    setProfileImage(file);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password, profileImage);
      navigate('/feed', { replace: true });
    } catch (err: unknown) {
      const data =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: unknown } }).response?.data;
      const msg =
        data &&
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message.trim()
          : '';
      setError(
        msg ||
          'Could not create your account. Try a different username or email, or check that the API is running.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.accent} aria-hidden />
        <h1 className={styles.title}>Join BookClub</h1>
        <p className={styles.subtitle}>Create an account to share reviews</p>

        <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-username">
              Username
            </label>
            <input
              id="reg-username"
              className={styles.input}
              autoComplete="username"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              maxLength={30}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-avatar">
              Profile picture <span className={styles.optional}>(optional)</span>
            </label>
            <div className={styles.avatarRow}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Profile preview"
                  className={styles.avatarPreview}
                  width={56}
                  height={56}
                />
              ) : (
                <div className={styles.avatarPlaceholder} aria-hidden>
                  {username.trim().slice(0, 1).toUpperCase() || '?'}
                </div>
              )}
              <input
                id="reg-avatar"
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
              {profileImage && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => setProfileImage(null)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <GoogleAuthSection formBusy={submitting} />

        <p className={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
