import { Link } from "react-router-dom";
import "./Button.scss";

type ButtonProps = {
  path: string;
  title: string;
  description: string;
  route: string;
};

export default function Button({ path, title, description, route }: ButtonProps) {
  return (
    <Link to={route} className="button">
      <img src={path} alt={title} />
      <div className="button__text">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </Link>
  );
}