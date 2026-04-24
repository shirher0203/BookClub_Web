import { Link, NavLink, useNavigate } from 'react-router-dom';
import { SearchDropdown } from './SearchDropdown';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';
import { useImageFallback } from '../utils/useImageFallback';
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

function ProfileAvatar({ src, label }: { src?: string; label: string }): JSX.Element {
  const letter = label.slice(0, 1).toUpperCase();
  const { show, onError } = useImageFallback(src);
  if (show) {
    return (
      <img
        src={src}
        alt=""
        className={styles.avatarImg}
        width={36}
        height={36}
        onError={onError}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className={styles.avatarLetter} aria-hidden>
      {letter}
    </span>
  );
}

export function Navbar(): JSX.Element {
  const { isReady, isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const profileImg = assetUrl(user?.profileImage);

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/login', { replace: true });
  }

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
        {isAuthenticated && (
          <NavLink
            to="/posts/new"
            className={({ isActive }) =>
              isActive ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn
            }
          >
            New review
          </NavLink>
        )}
        {isAuthenticated && (
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn
            }
          >
            Profile
          </NavLink>
        )}
      </nav>

      <div className={styles.searchWrap}>
        <SearchDropdown />
      </div>

      <div className={styles.auth}>
        {!isReady ? (
          <span className={styles.authMuted}>…</span>
        ) : isAuthenticated ? (
          <>
            <Link to="/profile" className={styles.profileBtn} title="Your profile" aria-label="Your profile">
              <span className={styles.profileRing}>
                <ProfileAvatar src={profileImg} label={user?.username ?? 'You'} />
              </span>
            </Link>
            <button type="button" className={styles.logoutBtn} onClick={() => void handleLogout()}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={styles.authLink}>
              Log in
            </Link>
            <Link to="/register" className={styles.authRegister}>
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
