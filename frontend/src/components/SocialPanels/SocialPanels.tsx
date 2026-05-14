import { useMemo, useState } from "react";
import "./SocialPanels.scss";

type Friend = {
  id: number;
  username: string;
  status: "online" | "offline" | "blocked";
};

type Notification = {
  id: number;
  title: string;
  text: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const mockFriends: Friend[] = [
  { id: 1, username: "Neo", status: "online" },
  { id: 2, username: "Trinity", status: "online" },
  { id: 3, username: "Morpheus", status: "offline" },
  { id: 4, username: "Smith", status: "blocked" },
];

const mockNotifications: Notification[] = [
  {
    id: 1,
    title: "NEW ACHIEVEMENT",
    text: "YOU WON 10 GAMES",
  },
  {
    id: 2,
    title: "NEWS",
    text: "RANKED MODE UPDATED",
  },
];

type Filter = "online" | "all" | "blocked";

const SocialPanels = ({ isOpen, onClose }: Props) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("online");

  const filteredFriends = useMemo(() => {
    return mockFriends.filter((friend) => {
      const matchesSearch = friend.username
        .toLowerCase()
        .includes(search.toLowerCase());

      if (!matchesSearch) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      return friend.status === filter;
    });
  }, [search, filter]);

  return (
    <>
      <div
        className={`socialOverlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      <aside className={`friendsPanel ${isOpen ? "open" : ""}`}>
        <div className="panelHeader">
          <h2>FRIENDS</h2>
          <span className="userStatus">ONLINE</span>
        </div>

        <input
          className="searchInput"
          placeholder="SEARCH"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filterButtons">
          <button
            className={filter === "online" ? "active" : ""}
            onClick={() => setFilter("online")}
          >
            ONLINE
          </button>

          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            ALL
          </button>

          <button
            className={filter === "blocked" ? "active" : ""}
            onClick={() => setFilter("blocked")}
          >
            BLOCKED
          </button>
        </div>

        <div className="friendsList">
          {filteredFriends.map((friend) => (
            <div key={friend.id} className="friendCard">
              <div className={`statusDot ${friend.status}`} />

              <div className="friendInfo">
                <span className="friendName">{friend.username}</span>
                <span className="friendStatus">
                  {friend.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <aside className={`notificationsPanel ${isOpen ? "open" : ""}`}>
        <div className="panelHeader">
          <h2>NOTIFICATIONS</h2>
        </div>

        <div className="notificationsList">
          {mockNotifications.map((notification) => (
            <div key={notification.id} className="notificationCard">
              <span className="notificationTitle">
                {notification.title}
              </span>

              <p>{notification.text}</p>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default SocialPanels;