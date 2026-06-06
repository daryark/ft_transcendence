import { getModesByPath } from "./data";
import Button from "../../components/Button/Button";
import "./Play.scss";
import { useLocation } from "react-router-dom";
import BackButton from "../../components/BackButton/BackButton";
import { useSyncExternalStore } from "react";
import { getSessionUser, subscribeToSession } from "../../auth/session";
import { userCapabilities } from "../../auth/capabilities";

const Play = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const capabilities = userCapabilities(user);

  const gameModes = getModesByPath(currentPath).map((mode) => {
    if (mode.id === "league" && !capabilities.canEnterTetraLeague) {
      return {
        ...mode,
        disabled: true,
        disabledReason: "Anonymous users may not enter Tetra League",
      };
    }

    return mode;
  });

  const showBackButton = currentPath !== "/play";

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
