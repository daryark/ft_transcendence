import BackButton from "../../components/BackButton/BackButton";
import "./About.scss";

const featureList = [
  "Real-time multiplayer with quick play, public rooms, and private custom matches.",
  "Solo modes for focused training, speed runs, and relaxed practice sessions.",
  "Player profiles, progress, achievements, and leaderboards that make improvement visible.",
  "Social tools for friends, notifications, presence, and in-room communication.",
  "Configurable game rules designed for fair play, replayability, and competitive pacing.",
  "A full-stack architecture built around typed APIs, persistent data, and socket-driven gameplay.",
];

const teamRoles = [
  {
    title: "Frontend Experience",
    text: "Builds the interface players touch every day: navigation, game screens, profile flows, responsive layouts, and polished interaction states.",
  },
  {
    title: "Backend Systems",
    text: "Owns authentication, persistence, profiles, statistics, achievements, and the API contracts that keep the platform reliable.",
  },
  {
    title: "Realtime Gameplay",
    text: "Shapes rooms, matchmaking, socket events, game state synchronization, and the rules that make every match feel immediate.",
  },
  {
    title: "Quality & Product",
    text: "Connects the experience end to end through testing, edge-case handling, documentation, and the small details that make Tetra feel complete.",
  },
];

const About = () => {
  return (
    <main className="about-page">
      <BackButton />

      <section className="about-page__hero">
        <div>
          <p className="about-page__eyebrow">Project</p>
          <h1>About Tetra</h1>
        </div>
        <p className="about-page__lead">
          Tetra is a modern competitive block-stacking platform built for fast
          matches, clear progression, and the kind of replayable pressure that
          makes one more round feel inevitable.
        </p>
        <div className="about-page__stats" aria-label="Project highlights">
          <div>
            <strong>4</strong>
            <span>Developers</span>
          </div>
          <div>
            <strong>3</strong>
            <span>Solo Modes</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>Online Play</span>
          </div>
        </div>
      </section>

      <section className="about-page__section about-page__section--intro">
        <p>
          The project brings together the essentials of an online game service:
          secure accounts, anonymous access, live multiplayer, custom rooms,
          player statistics, achievements, leaderboards, notifications, social
          features, and a responsive interface that works from menu to match.
        </p>
        <p>
          Under the surface, Tetra is engineered as a full-stack application
          where gameplay, persistence, realtime communication, and user
          experience are treated as one product. Every screen is designed to
          support a player action, and every system exists to make that action
          faster, clearer, or more reliable.
        </p>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">Features</p>
          <h2>What Tetra Includes</h2>
        </div>
        <ul className="about-page__features">
          {featureList.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">Team</p>
          <h2>Built By Four Developers</h2>
        </div>
        <div className="about-page__team">
          {teamRoles.map((member, index) => (
            <article className="about-page__team-card" key={member.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{member.title}</h3>
              <p>{member.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page__section about-page__section--tech">
        <div>
          <p className="about-page__eyebrow">Engineering</p>
          <h2>Designed Like A Product, Built Like A System</h2>
        </div>
        <p>
          Tetra is not only a game screen. It is authentication, session
          handling, socket coordination, room lifecycle management, score
          tracking, profile data, progression, and UI feedback working together
          without making the player think about the machinery behind it.
        </p>
      </section>

      <section className="about-page__closing">
        <h2>Fast to enter. Clear to master. Hard to put down.</h2>
        <p>
          That is the product goal behind Tetra: a focused multiplayer
          experience with enough depth for competition and enough polish to feel
          finished.
        </p>
      </section>
    </main>
  );
};

export default About;
