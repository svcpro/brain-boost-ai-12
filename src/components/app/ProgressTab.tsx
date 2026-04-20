import SureShotHero from "./SureShotHero";

const ProgressTab = ({ onUpgrade }: { onUpgrade?: () => void }) => {
  return (
    <div>
      <SureShotHero onUpgrade={onUpgrade} />
    </div>
  );
};

export default ProgressTab;
