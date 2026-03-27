import { Link, NavLink } from 'react-router-dom';
import { SearchDropdown } from './SearchDropdown';
import { getUserIdFromAccessToken } from '../utils/jwt';
import styles from './Navbar.module.css';

function BookLogo({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={30}
      height={30}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3z"
        fill="currentColor"
        fillOpacity={0.2}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfilePlaceholderIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

export function Navbar(): JSX.Element {
  const userId = getUserIdFromAccessToken();
  const profileTo = userId ? `/profile/${userId}` : '/profile/me';

  return (
    <header className={styles.bar}>
      <Link to="/feed" className={styles.brand}>
        <span className={styles.logoMark}>
          <BookLogo className={styles.logoSvg} />
        </span>
        <span className={styles.brandName}>BookClub</span>
      </Link>

      <nav className={styles.nav} aria-label="Main">
        <NavLink
          to="/feed"
          className={({ isActive }) =>
            isActive ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn
          }
          end
        >
          Feed
        </NavLink>
        <NavLink
          to="/posts/new"
          className={({ isActive }) =>
            isActive ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn
          }
        >
          New review
        </NavLink>
      </nav>

      <div className={styles.searchWrap}>
        <SearchDropdown />
      </div>

      <Link
        to={profileTo}
        className={styles.profileBtn}
        title="Profile (coming soon)"
        aria-label="Your profile (coming soon)"
      >
        <span className={styles.profileRing}>
          <ProfilePlaceholderIcon className={styles.profileIcon} />
        </span>
      </Link>
    </header>
  );
}
