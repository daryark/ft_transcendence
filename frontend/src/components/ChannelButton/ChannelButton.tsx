import { Link } from "react-router-dom";
import "./ChannelButton.scss";

type ChannelButtonProps = {
  title: string;
  description?: string;
  route: string;
};

export default function ChannelButton({
  title,
  description,
  route,
}: ChannelButtonProps) {
  return (
    <Link to={route} className="channel-button">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </Link>
  );
}