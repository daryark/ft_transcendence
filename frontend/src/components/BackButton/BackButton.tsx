import { useLocation, useNavigate } from "react-router-dom";
import "./BackButton.scss";

export default function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const parentPath =
    segments.length <= 1 ? "/play" : `/${segments.slice(0, -1).join("/")}`;

  return (
    <button
      className="back-button"
      onClick={() => navigate(parentPath)}
      type="button"
    >
      BACK
    </button>
  );
}
