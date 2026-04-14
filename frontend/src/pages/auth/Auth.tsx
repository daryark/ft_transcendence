import { useState } from 'react';
import styles from './Auth.module.scss';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);



  //logic for send info to backend


  //* */
  return (
    <div className={styles.auth}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className={styles.subtitle}>
            {isLogin ? 'Sign in to continue' : 'Join the Tetra community'}
          </p>
        </div>
        
        <form className={styles.form}>
          {!isLogin && (
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Choose a username"
              />
            </div>
          )}
          
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              placeholder="your@email.com"
            />
          </div>
          
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="••••••••"
            />
          </div>
          
          <button type="submit" className={styles.submitButton}>
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        
        <div className={styles.submitButton}>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className={styles.switchButton}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;