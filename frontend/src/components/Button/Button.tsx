import { Link } from "react-router-dom";
import "./Button.scss";

type ButtonProps = {
  id?: string;
  path: string;
  title: string;
  description: string;
  route: string;
  disabled?: boolean;
  disabledReason?: string;
};

export default function Button({
  id,
  path,
  title,
  description,
  route,
  disabled = false,
  disabledReason,
}: ButtonProps) {
  const modifier = id ? ` button--mode-${id}` : "";
  const className = `button${modifier}${disabled ? " button--disabled" : ""}`;
  const content = (
    <>
      <img src={path} alt={title} />
      <div className="button__text">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {disabled && disabledReason && (
        <div className="button__disabledReason">{disabledReason}</div>
      )}
    </>
  );

  if (disabled) {
    return (
      <div className={className} aria-disabled="true" role="link">
        {content}
      </div>
    );
  }

  return (
    <Link to={route} className={className}>
      {content}
    </Link>
  );
}
