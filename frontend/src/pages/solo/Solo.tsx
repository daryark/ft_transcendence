import { soloModes } from "./data";
import Button from "../../components/Button/Button";
import BackButton from "../../components/Button-back/BackButton";

export default function Solo() {
  return (
    <div className="play">
      <BackButton />

      {soloModes.map((mode) => (
        <Button key={mode.id} {...mode} />
      ))}
    </div>
  );
}
