import styles from "./TetraChannel.module.scss";
import BackButton from "../../components/BackButton/BackButton";

const TetraChannel = () => {
  return (
    <div className={styles.channel}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>Tetra Channel</h1>
        <p className={styles.subtitle}>
          Watch live streams and highlights from the Tetra community
        </p>
      </div>
    </div>
  );
};

export default TetraChannel;
