import BackButton from "../../components/BackButton/BackButton";
import "./About.scss";

const About = () => {
  return (
    <main className="about-page">
      <BackButton />
      <section className="about-page__panel">
        <p className="about-page__eyebrow">Project</p>
        <h1>About Tetra</h1>
        <p>
          A fast multiplayer block-stacking experience with solo challenges,
          rooms, leaderboards, profiles, and social tools.
        </p>
      </section>
    </main>
  );
};

export default About;
