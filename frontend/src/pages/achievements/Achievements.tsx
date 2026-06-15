import BackButton from "../../components/BackButton/BackButton";
import { EmptyState } from "../../components/StateView/StateView";
import "../statistics/MyStatistics.scss";

export default function Achievements() {
  return (
    <main className="my-statistics">
      <BackButton />
      <section className="my-statistics__panel">
        <h1>Achievements</h1>
      </section>
      <EmptyState
        title="ACHIEVEMENTS COMING SOON"
        message="The achievements API is not implemented yet."
      />
    </main>
  );
}
