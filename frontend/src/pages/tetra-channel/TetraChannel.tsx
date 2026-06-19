import { useSyncExternalStore } from "react";
import ChannelButton from "../../components/ChannelButton/ChannelButton";
import BackButton from "../../components/BackButton/BackButton";
import { channelButtons } from "./channelData";
import { userCapabilities } from "../../auth/capabilities";
import { getSessionUser, subscribeToSession } from "../../auth/session";
import "./TetraChannel.scss";

export default function TetraChannel() {
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const capabilities = userCapabilities(user);
  const buttons = channelButtons.map((button) => {
    if (button.id === "statistics" && !capabilities.canUsePersonalStats) {
      return {
        ...button,
        disabled: true,
        disabledReason: "Anonymous users do not have personal statistics",
      };
    }

    if (button.id === "achievements" && !capabilities.canUseAchievements) {
      return {
        ...button,
        disabled: true,
        disabledReason: "Anonymous users cannot obtain achievements",
      };
    }

    return button;
  });

  return (
    <div className="channel">

    <BackButton/>
      <div className="channel__menu">
        {buttons.map((button) => (
          <ChannelButton key={button.id} {...button} />
        ))}
      </div>
    </div>
  );
}
