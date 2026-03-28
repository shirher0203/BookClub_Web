import styles from './FeedPage.module.css';

/** Placeholder until the community feed is wired up. */
export function FeedPage(): JSX.Element {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Feed</h1>
      <p className={styles.hint}>Your reading community will appear here soon.</p>
    </div>
  );
}
