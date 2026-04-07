import { multiplayerModes } from "./data";
import Button from "../../components/Button/Button";
import BackButton from "../../components/BackButton/BackButton";

export default function Multiplayer() {
  return (
    <div className="play">
      <BackButton />

      {multiplayerModes.map((mode) => (
        <Button key={mode.id} {...mode} />
      ))}
    </div>
  );
}
