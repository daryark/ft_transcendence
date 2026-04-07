import { useNavigate } from "react-router-dom";
import "./BackButton.scss";

export default function BackButton() {
  const navigate = useNavigate();

  return (
    <button className="back-button" onClick={() => navigate(-1)}>
      BACK
    </button>
  );
}