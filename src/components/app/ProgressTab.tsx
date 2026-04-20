import SureShotHero from "./SureShotHero";

const ProgressTab = ({ onUpgrade }: { onUpgrade?: () => void }) => {
  return (
    <div>
      <SureShotHero onUpgrade={onUpgrade} />
      {/* Confidence Practice hidden per request */}
    </div>
  );
};

export default ProgressTab;
