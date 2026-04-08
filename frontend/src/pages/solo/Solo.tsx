import { soloModes } from "./data";
import Button from "../../components/Button/Button";
import BackButton from "../../components/BackButton/BackButton";

// import { useNavigate } from "react-router-dom";

// const navigate = useNavigate();

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
