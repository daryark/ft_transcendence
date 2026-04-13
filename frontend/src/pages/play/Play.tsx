// import styles from "./Play.module.scss";
import { Outlet } from "react-router-dom";
import { gameModes } from "./data";
import Button from "../../components/Button/Button";
import "./Play.module.scss"

const Play = () => {
  return (
    <>
      <div className="play">
        {gameModes.map((mode) => (
          <Button key={mode.id} {...mode} />
        ))}
      </div>
      <Outlet />
    </>
  );
};

export default Play;
