import BackButton from '../../components/BackButton/BackButton';
import styles from './About.module.scss';

const About = () => {
  return (
    <>
    <BackButton/> 
     <div className={styles.about}>
      
      <div className={styles.card}>
        <h1 className={styles.title}>About Tetra</h1>
        
        <div className={styles.content}>
          <p className={styles.paragraph}>
            Tetra is a modern reimagining of the classic Tetris experience, built as a full-stack web application with real-time multiplayer capabilities. This project demonstrates advanced web development techniques including WebSocket communication, microservices architecture, and responsive design.
          </p>
          
          <p className={styles.paragraph}>
            Inspired by Tetr.io, Tetra brings competitive block-stacking action to the browser with smooth 60fps gameplay, online matchmaking, tournament systems, and community features. This project was developed as part of the ft_transcendence program, showcasing modern web technologies and collaborative development practices.
          </p>
          
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🎮</div>
              <div className={styles.featureTitle}>Real-time Gameplay</div>
              <div className={styles.featureDesc}>60fps smooth experience</div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>👥</div>
              <div className={styles.featureTitle}>Multiplayer</div>
              <div className={styles.featureDesc}>Play with friends worldwide</div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🏆</div>
              <div className={styles.featureTitle}>Competitive</div>
              <div className={styles.featureDesc}>Tournaments & leaderboards</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
   
  );
};

export default About;