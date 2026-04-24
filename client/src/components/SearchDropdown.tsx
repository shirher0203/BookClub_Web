import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/axios';
import { useImageFallback } from '../utils/useImageFallback';
import styles from './SearchDropdown.module.css';

function UserRowAvatar({ src, username }: { src: string; username: string }): JSX.Element {
  const { show, onError } = useImageFallback(src);
  if (show) {
    return <img src={src} alt={username} className={styles.avatarImg} onError={onError} referrerPolicy="no-referrer" />;
  }
  return <>{username[0]?.toUpperCase() ?? '?'}</>;
}

interface SearchUser {
  _id: string;
  username: string;
  profileImage: string;
}

interface SearchPost {
  _id: string;
  bookName: string;
  bookAuthor?: string;
}

interface SearchAllResponse {
  users: SearchUser[];
  posts: SearchPost[];
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function SearchDropdown(): JSX.Element {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<SearchAllResponse>('/search', {
        params: { q: q.trim(), type: 'all' },
      });
      setUsers(data.users ?? []);
      setPosts(data.posts ?? []);
    } catch {
      setUsers([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      setUsers([]);
      setPosts([]);
      return;
    }
    void fetchResults(debounced);
  }, [debounced, fetchResults]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onDown);
    return () => document.removeEventListener('keydown', onDown);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hasResults = users.length > 0 || posts.length > 0;
  const showDropdown = open && query.trim().length > 0;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        type="search"
        className={styles.input}
        placeholder="Search users & posts…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            setOpen(false);
          }
        }}
        aria-label="Search"
      />
      {showDropdown && (
        <div className={styles.dropdown} role="listbox">
          {loading && <div className={styles.loading}>Loading…</div>}
          {!loading && !hasResults && <div className={styles.empty}>No results found</div>}
          {!loading && users.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Users</h3>
              <ul>
                {users.map((u) => (
                  <li key={u._id}>
                    <button
                      type="button"
                      className={styles.row}
                      onClick={() => {
                        navigate(`/profile/${u._id}`);
                        setOpen(false);
                      }}
                    >
                      <span className={styles.avatar} aria-hidden>
                        <UserRowAvatar src={u.profileImage} username={u.username} />
                      </span>
                      <span>{u.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!loading && posts.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Posts</h3>
              <ul>
                {posts.map((p) => (
                  <li key={p._id}>
                    <button
                      type="button"
                      className={styles.row}
                      onClick={() => {
                        navigate(`/posts/${p._id}/comments`);
                        setOpen(false);
                      }}
                    >
                      <span className={styles.postTitle}>{p.bookName}</span>
                      {p.bookAuthor && (
                        <span className={styles.postAuthor}> · {p.bookAuthor}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
