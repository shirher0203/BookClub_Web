import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/axios';
import styles from './SearchResultsPage.module.css';

interface ParsedQueryChip {
  titleKeywords?: string[];
  authorKeywords?: string[];
  genres?: string[];
  yearRange?: { start?: number; end?: number };
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

interface SearchPost {
  _id: string;
  bookName: string;
  bookAuthor?: string;
}

interface RegularAllResponse {
  users: SearchUser[];
  posts: SearchPost[];
}

type TabId = 'smart' | 'all';

export function SearchResultsPage(): JSX.Element {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';

  const [tab, setTab] = useState<TabId>('smart');
  const [aiLoading, setAiLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [aiData, setAiData] = useState<AiSearchResponse | null>(null);
  const [regData, setRegData] = useState<RegularAllResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Search</h1>
      {q ? (
        <p className={styles.query}>
          Results for: <strong>{q}</strong>
        </p>
      ) : (
        <p className={styles.hint}>Add a search query in the URL, e.g. /search?q=fantasy</p>
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
                {aiData.parsedQuery.genres?.map((g) => (
                  <span key={g} className={styles.chip}>
                    {g}
                  </span>
                ))}
                {aiData.parsedQuery.authorKeywords?.map((a) => (
                  <span key={a} className={styles.chip}>
                    author: {a}
                  </span>
                ))}
                {aiData.parsedQuery.yearRange &&
                  (aiData.parsedQuery.yearRange.start != null ||
                    aiData.parsedQuery.yearRange.end != null) && (
                    <span className={styles.chip}>
                      {aiData.parsedQuery.yearRange.start ?? '…'}–
                      {aiData.parsedQuery.yearRange.end ?? '…'}
                    </span>
                )}
              </div>
              <p className={styles.meta}>{aiData.total} result(s)</p>
              <ul className={styles.list}>
                {(aiData.results as SearchPost[]).map((p) => (
                  <li key={String(p._id)}>
                    <Link to={`/posts/${String(p._id)}/comments`}>
                      {p.bookName}
                      {p.bookAuthor ? ` · ${p.bookAuthor}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
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
              <ul className={styles.list}>
                {regData.users.map((u) => (
                  <li key={u._id}>
                    <Link to={`/profile/${u._id}`}>{u.username}</Link>
                  </li>
                ))}
              </ul>
              <h3 className={styles.subheading}>Posts</h3>
              <ul className={styles.list}>
                {regData.posts.map((p) => (
                  <li key={p._id}>
                    <Link to={`/posts/${p._id}/comments`}>
                      {p.bookName}
                      {p.bookAuthor ? ` · ${p.bookAuthor}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <p className={styles.back}>
        <Link to="/">Back to home</Link>
      </p>
    </div>
  );
}
