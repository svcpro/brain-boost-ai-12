import ConfidencePracticeTab from "./ConfidencePracticeTab";
import SureShotHero from "./SureShotHero";

const ProgressTab = ({ onUpgrade }: { onUpgrade?: () => void }) => {
  return (
    <div>
      <SureShotHero onUpgrade={onUpgrade} />
      <ConfidencePracticeTab />
    </div>
  );
};

export default ProgressTab;
