import { useParams } from "react-router-dom";
import { ModeLayout } from "../../../components/ModeLayout/ModeLayout";
import { ModeOptions } from "../../../components/ModeOptions/ModeOptions";
import { AdvancedSection } from "../../../components/AdvancedSection/AdvancedSection";
import { MODES_CONFIG } from "./config/modes.config";
// import { useGameStart } from '../../../hooks/useGameStart';
import NotFound from "../../notFound/NotFound";
import { useNavigate } from "react-router-dom";

export default function ModePage() {
  const { modeId } = useParams<{ modeId: string }>();
  const config = modeId ? MODES_CONFIG[modeId] : undefined;
  //   const { handleStart, isLoading} = useGameStart(config);
  const navigate = useNavigate();

  if (!config) return <NotFound />;

  const handleStart = async () => {
    try {
      // имитация ответа сервера
      const data = {
        gameId: "mock-game-001",
      };

      navigate(`/game/${data.gameId}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ModeLayout
      title={config.title}
      description={config.description}
      accentColor={config.accentColor}
      personalBest={config.personalBest}
      showMusic={config.showMusic}
      onStart={handleStart}
      options={config.showOptions && <ModeOptions items={config.options} />}
      advanced={config.showAdvanced && <AdvancedSection />}
      //   && <ResetButton />
      headerExtra={config.headerExtra === "reset"}
      isLoading={handleStart}
    />
  );
}
