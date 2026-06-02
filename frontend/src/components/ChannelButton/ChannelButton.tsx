import { Link } from "react-router-dom";
import "./ChannelButton.scss";

type ChannelButtonProps = {
  id?: string;
  title: string;
  description?: string;
  route: string;
};

export default function ChannelButton({
  id,
  title,
  description,
  route,
}: ChannelButtonProps) {
  const modifier = id ? ` channel-button--${id}` : "";

  return (
    <Link to={route} className={`channel-button${modifier}`}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </Link>
  );
}
