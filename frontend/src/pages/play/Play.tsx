import { getModesByPath } from "./data";
import Button from "../../components/Button/Button";
import "./Play.scss";
import { useLocation } from "react-router-dom";
import BackButton from "../../components/BackButton/BackButton";

import {getStoredGameConfig} from "../../socket/gameConfigStorage"

const Play = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const gameModes = getModesByPath(currentPath);

  const showBackButton = currentPath !== "/play";

  let config = getStoredGameConfig();
  console.log(config);

  return (
    <>
      <div className="play">
        {showBackButton && <BackButton />}
        {gameModes.map((mode) => (
          <Button key={mode.id} {...mode} />
        ))}
      </div>
    </>
  );
};

export default Play;
