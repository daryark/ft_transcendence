import { Link, useLocation } from 'react-router-dom';
import UserIcon from '../Icons/UserIcon';
import styles from './Header.module.scss';

const Header = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.content}>
          {/* Левая часть */}
          <div className={styles.left}>
            <Link to="/" className={styles.logo}>
              TETRA
            </Link>
            
            <nav className={styles.nav}>
              <Link 
                to="/play" 
                className={`${styles.navLink} ${isActive('/play') ? styles.active : ''}`}
              >
                Play
              </Link>
              <Link 
                to="/channel" 
                className={`${styles.navLink} ${isActive('/channel') ? styles.active : ''}`}
              >
                Tetra Channel
              </Link>
              <Link 
                to="/about" 
                className={`${styles.navLink} ${isActive('/about') ? styles.active : ''}`}
              >
                About
              </Link>
            </nav>
          </div>
          
          {/* Правая часть */}
          <Link to="/auth" className={styles.userIcon} aria-label="Sign up / Log in">
            <UserIcon />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;