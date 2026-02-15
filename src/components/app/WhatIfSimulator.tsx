import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, ChevronDown, Play, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCognitiveTwin, type TopicCognitiveModel } from "@/hooks/useCognitiveTwin";
import { toast } from "sonner";

interface Props {
  topicModels: TopicCognitiveModel[];
}

export default function WhatIfSimulator({ topicModels }: Props) {
  const { simulate, loading } = useCognitiveTwin();
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [daysAhead, setDaysAhead] = useState(14);
  const [simResult, setSimResult] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const selectedTopic = useMemo(
    () => topicModels.find(t => t.topic_id === selectedTopicId),
    [topicModels, selectedTopicId]
  );

  // Generate retention curve data points
  const chartData = useMemo(() => {
    if (!selectedTopic) return [];

    const decayRate = selectedTopic.decay_rate || 0.05;
    const stability = 1 / Math.max(0.001, decayRate);
    const currentStrength = selectedTopic.memory_strength;
    const learningSpeed = selectedTopic.learning_speed || 5;
    const postStudyStrength = Math.min(100, currentStrength + learningSpeed * 1.5);

    const points = [];
    for (let day = 0; day <= daysAhead; day++) {
      const hours = day * 24;
      const withoutStudy = currentStrength * Math.exp(-hours / stability);
      const withStudy = postStudyStrength * Math.exp(-hours / stability);
      points.push({
        day: `Day ${day}`,
        dayNum: day,
        "Without Study": Math.max(0, Math.round(withoutStudy * 10) / 10),
        "After Study": Math.max(0, Math.round(withStudy * 10) / 10),
      });
    }
    return points;
  }, [selectedTopic, daysAhead]);

  const retentionGain = useMemo(() => {
    if (chartData.length < 2) return 0;
    const last = chartData[chartData.length - 1];
    return Math.round((last["After Study"] - last["Without Study"]) * 10) / 10;
  }, [chartData]);

  const handleSimulate = async () => {
    if (!selectedTopicId) return;
    toast.loading("Simulating...", { id: "sim" });
    const result = await simulate({ topic_id: selectedTopicId, strategy: "study_now", days_ahead: daysAhead });
    setSimResult(result);
    toast.success("Simulation complete!", { id: "sim" });
  };

  if (topicModels.length === 0) return null;

  return (
    <Card className="p-4 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">What-If Simulator</h3>
            <p className="text-[10px] text-muted-foreground">Predict retention before & after studying</p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {/* Topic Selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Topic</label>
                <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Choose a topic..." />
                  </SelectTrigger>
                  <SelectContent>
                    {topicModels.map(t => (
                      <SelectItem key={t.topic_id} value={t.topic_id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{t.topic_name}</span>
                          <Badge variant={t.memory_strength > 70 ? "default" : t.memory_strength > 40 ? "secondary" : "destructive"} className="text-[10px] ml-1 shrink-0">
                            {Math.round(t.memory_strength)}%
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Days Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Predict ahead</label>
                  <span className="text-xs font-bold text-foreground">{daysAhead} days</span>
                </div>
                <Slider
                  value={[daysAhead]}
                  onValueChange={([v]) => setDaysAhead(v)}
                  min={3}
                  max={30}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Chart */}
              {selectedTopic && chartData.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <defs>
                        <linearGradient id="withStudyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="withoutStudyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(daysAhead / 6))} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number) => [`${value}%`, undefined]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Area
                        type="monotone"
                        dataKey="Without Study"
                        stroke="hsl(var(--destructive))"
                        fill="url(#withoutStudyGrad)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--destructive))" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="After Study"
                        stroke="hsl(var(--primary))"
                        fill="url(#withStudyGrad)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Summary badges */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      {retentionGain > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span className="text-xs font-medium text-foreground">
                        +{retentionGain}% retention gain after {daysAhead} days
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedTopic.review_count} reviews
                    </Badge>
                  </div>

                  {/* Simulate server-side button */}
                  <Button
                    size="sm"
                    className="w-full mt-3 gap-1"
                    onClick={handleSimulate}
                    disabled={loading}
                  >
                    <Sparkles className="w-3 h-3" />
                    Run Deep Simulation
                  </Button>

                  {/* Server simulation result */}
                  <AnimatePresence>
                    {simResult && simResult.scenario === "study_now" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
                      >
                        <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                          <FlaskConical className="w-3 h-3 text-primary" /> Deep Simulation Result
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Current</span>
                            <p className="font-bold text-foreground">{simResult.current_strength}%</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">After Study</span>
                            <p className="font-bold text-primary">{simResult.post_study_strength}%</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Retention @ {simResult.days_ahead}d</span>
                            <p className="font-bold text-foreground">{simResult.predicted_retention_after_days}%</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Confidence</span>
                            <p className="font-bold text-foreground">{Math.round((simResult.confidence || 0) * 100)}%</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {!selectedTopicId && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Pick a topic above to preview its retention curve
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
