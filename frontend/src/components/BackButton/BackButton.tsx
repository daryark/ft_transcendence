import { useLocation, useNavigate } from "react-router-dom";
import "./BackButton.scss";

type BackButtonProps = {
  to?: string;
};

export default function BackButton({ to }: BackButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const parentPath =
    segments.length <= 1 ? "/play" : `/${segments.slice(0, -1).join("/")}`;

  return (
    <button
      className="back-button"
      onClick={() => navigate(to ?? parentPath)}
      type="button"
    >
      BACK
    </button>
  );
}
