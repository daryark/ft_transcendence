import ChannelButton from "../../components/ChannelButton/ChannelButton";
import BackButton from "../../components/BackButton/BackButton";
import { channelButtons } from "./channelData";
import "./TetraChannel.scss";

export default function TetraChannel() {
  return (
    <div className="channel">

    <BackButton/>
      <div className="channel__block center">
        <ChannelButton {...channelButtons[0]} />
      </div>

      <div className="channel__block center">
        <ChannelButton {...channelButtons[1]} />
      </div>

      <div className="channel__row">
        <ChannelButton {...channelButtons[2]} />
        <ChannelButton {...channelButtons[3]} />
      </div>

      <div className="channel__block center">
        <ChannelButton {...channelButtons[4]} />
      </div>

    </div>
  );
}
