import { useNavigate } from "react-router-dom";
import "./NotFound.scss";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="not-found">
      <div className="not-found__content">
        <div className="not-found__code">
          <span className="not-found__digit">4</span>
          <span className="not-found__tetris-block">T</span>
          <span className="not-found__digit">4</span>
        </div>
        <h1 className="not-found__title">PAGE NOT FOUND</h1>
        <p className="not-found__description">
          THE BLOCK YOU ARE LOOKING FOR DOES NOT EXIST
          <br />
          OR HAS BEEN CLEARED FROM THE GRID
        </p>
        <div className="not-found__actions">
          <button
            className="not-found__button not-found__button--primary"
            onClick={() => navigate("/play")}
            type="button"
          >
            BACK TO MENU
          </button>
        </div>
        <div className="not-found__falling-blocks" aria-hidden="true">
          {["I", "O", "T", "S", "Z"].map((piece) => (
            <span className="not-found__falling-block" key={piece}>
              {piece}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
