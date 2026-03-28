import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';
import { normalizeUserFromApi } from '../utils/authUser';
import type { User } from '../types';
import styles from './ProfilePage.module.css';

export function ProfilePage(): JSX.Element {
  const { id: routeId } = useParams<{ id: string }>();
  const { user: authUser, isAuthenticated } = useAuth();
  const targetId = routeId ?? authUser?.id ?? '';

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = Boolean(authUser?.id && targetId === authUser.id);

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
      } catch {
        if (!cancelled) {
          setProfile(null);
          setError('Could not load this profile.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId]);

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

  const imgSrc = assetUrl(profile.profileImage);
  const initial = profile.username.slice(0, 1).toUpperCase();

  return (
    <div className={styles.page}>
      <Link to="/feed" className={styles.back}>
        ← Feed
      </Link>

      <div className={styles.card}>
        <div className={styles.header}>
          {imgSrc ? (
            <img src={imgSrc} alt="" className={styles.avatar} width={88} height={88} />
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
    </div>
  );
}
