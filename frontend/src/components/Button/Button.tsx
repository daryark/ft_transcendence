import { Link } from "react-router-dom";
import "./Button.scss";

type ButtonProps = {
  id?: string;
  path: string;
  title: string;
  description: string;
  route: string;
};

export default function Button({
  id,
  path,
  title,
  description,
  route,
}: ButtonProps) {
  const modifier = id ? ` button--mode-${id}` : "";

  return (
    <Link to={route} className={`button${modifier}`}>
      <img src={path} alt={title} />
      <div className="button__text">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </Link>
  );
}
