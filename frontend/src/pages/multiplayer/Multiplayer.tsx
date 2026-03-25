import { multiplayerModes } from "./data";
import Button from "../../components/Button/Button";
import BackButton from "../../components/Button-back/BackButton";

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
