import { getModesByPath } from "./data";
import Button from "../../components/Button/Button";
import "./Play.scss";
import { useLocation } from "react-router-dom";
import BackButton from "../../components/BackButton/BackButton";

const Play = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const gameModes = getModesByPath(currentPath);

  const showBackButton = currentPath !== "/play";

  return (
    <>
      {showBackButton && <BackButton />}

      <div className="play">
        {gameModes.map((mode) => (
          <Button key={mode.id} {...mode} />
        ))}
      </div>
    </>
  );
};

export default Play;
