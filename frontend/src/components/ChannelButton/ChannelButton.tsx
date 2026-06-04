import { Link } from "react-router-dom";
import "./ChannelButton.scss";

type ChannelButtonProps = {
  id?: string;
  title: string;
  description?: string;
  route: string;
  disabled?: boolean;
  disabledReason?: string;
};

export default function ChannelButton({
  id,
  title,
  description,
  route,
  disabled = false,
  disabledReason,
}: ChannelButtonProps) {
  const modifier = id ? ` channel-button--${id}` : "";
  const className = `channel-button${modifier}${
    disabled ? " channel-button--disabled" : ""
  }`;
  const content = (
    <>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {disabled && disabledReason && (
        <div className="channel-button__disabledReason">
          {disabledReason}
        </div>
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
