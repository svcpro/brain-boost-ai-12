import { Brain, TrendingUp, Zap } from "lucide-react";

/**
 * Simple, animation-free SureShot header that mirrors the
 * plain look-and-feel of the Action tab.
 */
const SureShotHero = (_: { onUpgrade?: () => void }) => {
  const stats = [
    { label: "Topics Analyzed", value: "2,450+", icon: TrendingUp },
    { label: "Pattern Matches", value: "1,890", icon: Zap },
    { label: "Accuracy Score", value: "99.2%", icon: Brain },
  ];

  return (
    <div className="px-5 pt-6 pb-4">
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            SureShot Prediction
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Ultra AI Powered • 99% Pattern Accuracy
        </p>

        {/* Match badge + stats */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center justify-center w-24 h-24 rounded-xl border"
            style={{ background: "hsl(var(--secondary) / 0.4)", borderColor: "hsl(var(--border))" }}>
            <span className="text-2xl font-bold text-foreground">87%</span>
            <span className="text-[10px] text-muted-foreground font-medium">Match</span>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SureShotHero;
