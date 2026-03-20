import { Link } from 'react-router-dom';
import { SearchDropdown } from './SearchDropdown';
import styles from './Navbar.module.css';

export function Navbar(): JSX.Element {
  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.brand}>
        BookClub
      </Link>
      <SearchDropdown />
    </header>
  );
}
