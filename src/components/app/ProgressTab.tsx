import { useEffect, useState } from "react";
import ConfidencePracticeTab from "./ConfidencePracticeTab";
import SureShotHero from "./SureShotHero";
import ColorProgressChart from "./ColorProgressChart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ProgressTab = ({ onUpgrade }: { onUpgrade?: () => void }) => {
  const { user } = useAuth();
  const [practicePct, setPracticePct] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: logs } = await supabase
        .from("study_logs")
        .select("confidence_level")
        .eq("user_id", user.id)
        .not("confidence_level", "is", null)
        .limit(200);
      if (!logs || logs.length === 0) return;
      const high = logs.filter((l: any) => l.confidence_level === "high").length;
      const med = logs.filter((l: any) => l.confidence_level === "medium").length;
      const score = ((high * 1 + med * 0.5) / logs.length) * 100;
      setPracticePct(Math.round(score));
    })();
  }, [user?.id]);

  return (
    <div className="px-5 pt-5 space-y-5">
      <SureShotHero onUpgrade={onUpgrade} />
      <ColorProgressChart
        value={practicePct}
        label="Practice Confidence"
        sublabel="Color tier shifts as your high-confidence answers grow"
        thresholds="tier3"
        style="thermometer"
        size={120}
      />
      <ConfidencePracticeTab />
    </div>
  );
};

export default ProgressTab;
