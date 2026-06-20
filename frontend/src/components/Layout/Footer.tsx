import { Link } from "react-router-dom";
import "./Footer.scss";

export default function Footer() {
  return (
    <footer className="app-footer">
      <span className="app-footer__status">WELCOME TO TETRA!</span>
      <nav className="app-footer__links" aria-label="Legal pages">
        <Link className="app-footer__link" to="/privacy-policy">
          Privacy
        </Link>
        <Link className="app-footer__link" to="/terms-of-service">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
