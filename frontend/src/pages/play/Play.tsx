import styles from "./Play.module.scss";
import { gameModes } from "./data";
import Button from "../../components/Button/Button";

const Play = () => {
  return (
    <div className={styles.play}>
      {gameModes.map((mode) => (
        <Button key={mode.id} {...mode} />
      ))}
    </div>
  );
};

export default Play;