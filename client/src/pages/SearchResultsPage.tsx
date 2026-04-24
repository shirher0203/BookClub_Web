import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/axios';
import { PostCard } from '../components/PostCard';
import { getUserIdFromAccessToken } from '../utils/jwt';
import { normalizePost } from '../utils/normalizePost';
import type { Post } from '../types';
import styles from './SearchResultsPage.module.css';

interface ParsedQueryChip {
  titleKeywords?: string[];
  authorKeywords?: string[];
  genres?: string[];
  inferredBooks?: string[];
  minScore?: number;
  originalQuery: string;
}

interface AiSearchResponse {
  results: unknown[];
  parsedQuery: ParsedQueryChip;
  total: number;
}

interface SearchUser {
  _id: string;
  username: string;
  profileImage: string;
}

interface RegularAllResponse {
  users: SearchUser[];
  posts: unknown[];
}

type TabId = 'smart' | 'all';

export function SearchResultsPage(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q')?.trim() ?? '';
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState<TabId>('smart');
  const [aiLoading, setAiLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [aiData, setAiData] = useState<AiSearchResponse | null>(null);
  const [regData, setRegData] = useState<RegularAllResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const currentUserId = getUserIdFromAccessToken();

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    if (!q) {
      setAiData(null);
      setRegData(null);
      return;
    }

    setAiLoading(true);
    setRegLoading(true);
    setAiError(null);

    api
      .get<AiSearchResponse>('/ai/search', { params: { q } })
      .then((res) => setAiData(res.data))
      .catch((err: { response?: { status?: number } }) => {
        if (err.response?.status === 429) {
          setAiError('Too many AI search requests. Try again in a minute.');
        } else {
          setAiError('Smart search failed.');
        }
        setAiData(null);
      })
      .finally(() => setAiLoading(false));

    api
      .get<RegularAllResponse>('/search', { params: { q, type: 'all' } })
      .then((res) => setRegData(res.data))
      .finally(() => setRegLoading(false));
  }, [q]);

  function onSearch(e: FormEvent): void {
    e.preventDefault();
    const v = input.trim();
    if (v) navigate(`/search?q=${encodeURIComponent(v)}`);
  }

  const aiPosts: Post[] =
    aiData?.results?.map((r) =>
      normalizePost(r as Record<string, unknown>)
    ) ?? [];

  function handlePostDeleted(postId: string): void {
    setAiData((prev) =>
      prev
        ? {
            ...prev,
            results: prev.results.filter(
              (r) => (r as { _id?: string; id?: string })._id !== postId && (r as { id?: string }).id !== postId
            ),
            total: Math.max(0, prev.total - 1),
          }
        : prev
    );
    setRegData((prev) =>
      prev
        ? {
            ...prev,
            posts: prev.posts.filter(
              (r) => (r as { _id?: string; id?: string })._id !== postId && (r as { id?: string }).id !== postId
            ),
          }
        : prev
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Search</h1>

      <form className={styles.searchForm} onSubmit={onSearch} role="search">
        <label htmlFor="search-page-input" className={styles.srOnly}>
          Search books and members
        </label>
        <input
          id="search-page-input"
          className={styles.searchInput}
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by book, author, genre…"
          autoComplete="off"
        />
        <button type="submit" className={styles.searchBtn}>
          Search
        </button>
      </form>

      {q ? (
        <p className={styles.query}>
          Results for: <strong>{q}</strong>
        </p>
      ) : (
        <p className={styles.hint}>
          Type a query and press Search, or use the bar in the header.
        </p>
      )}

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'smart' ? styles.tabActive : styles.tab}
          onClick={() => setTab('smart')}
        >
          Smart Search
        </button>
        <button
          type="button"
          className={tab === 'all' ? styles.tabActive : styles.tab}
          onClick={() => setTab('all')}
        >
          All Results
        </button>
      </div>

      {tab === 'smart' && (
        <section className={styles.panel} aria-labelledby="smart-heading">
          <h2 id="smart-heading" className={styles.srOnly}>
            Smart search
          </h2>
          {aiLoading && <p>Loading smart search…</p>}
          {aiError && <p className={styles.error}>{aiError}</p>}
          {!aiLoading && aiData && (
            <>
              <div className={styles.chips}>
                {aiData.parsedQuery.genres?.map((g, i) => (
                  <span key={`g-${i}-${g}`} className={styles.chip}>
                    {g}
                  </span>
                ))}
                {aiData.parsedQuery.authorKeywords?.map((a, i) => (
                  <span key={`a-${i}-${a}`} className={styles.chip}>
                    author: {a}
                  </span>
                ))}
                {aiData.parsedQuery.inferredBooks?.map((b, i) => (
                  <span key={`b-${i}-${b}`} className={styles.chip}>
                    book: {b}
                  </span>
                ))}
              </div>
              <p className={styles.meta}>{aiData.total} result(s)</p>
              {aiPosts.length === 0 && <p>No matching posts.</p>}
              {aiPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={currentUserId}
                  onPostDeleted={handlePostDeleted}
                />
              ))}
            </>
          )}
        </section>
      )}

      {tab === 'all' && (
        <section className={styles.panel} aria-labelledby="all-heading">
          <h2 id="all-heading" className={styles.srOnly}>
            All results
          </h2>
          {regLoading && <p>Loading…</p>}
          {!regLoading && regData && (
            <>
              <h3 className={styles.subheading}>Users</h3>
              <ul className={styles.userList}>
                {regData.users.map((u) => (
                  <li key={u._id}>
                    <Link to={`/profile/${u._id}`}>{u.username}</Link>
                  </li>
                ))}
              </ul>
              <h3 className={styles.subheading}>Posts</h3>
              {regData.posts.length === 0 && <p>No matching posts.</p>}
              {regData.posts
                .map((p) => normalizePost(p as Record<string, unknown>))
                .map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={currentUserId}
                    onPostDeleted={handlePostDeleted}
                  />
                ))}
            </>
          )}
        </section>
      )}

      <p className={styles.back}>
        <Link to="/feed">Back to feed</Link>
      </p>
    </div>
  );
}
