import { motion } from "framer-motion";
import { Brain, TrendingUp, Zap, Lock, Rocket } from "lucide-react";

const CircularProgress = ({ value }: { value: number }) => {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r="45" fill="none"
          stroke="url(#sureshot-gradient)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="sureshot-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(0, 90%, 55%)" />
            <stop offset="50%" stopColor="hsl(25, 100%, 55%)" />
            <stop offset="100%" stopColor="hsl(330, 100%, 60%)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black sureshot-gradient-text">87%</span>
        <span className="text-[9px] text-muted-foreground font-medium">Match</span>
      </div>
    </div>
  );
};

const SparkParticle = ({ delay, x }: { delay: number; x: number }) => (
  <motion.div
    className="absolute w-1 h-1 rounded-full"
    style={{ left: `${x}%`, bottom: "10%", background: "hsl(25, 100%, 60%)" }}
    animate={{ y: [0, -30, -50], opacity: [1, 0.6, 0], scale: [1, 0.5, 0] }}
    transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 2 }}
  />
);

const SureShotHero = ({ onUpgrade }: { onUpgrade?: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="px-5 pt-6 pb-4"
    >
      {/* Premium Hero Card */}
      <div className="relative overflow-hidden rounded-3xl p-5 sureshot-card-glow"
        style={{ background: "linear-gradient(145deg, hsl(270 40% 8%), hsl(280 30% 6%), hsl(260 35% 10%))" }}>
        
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(15 100% 55% / 0.4), transparent)" }} />
        
        {/* Spark particles */}
        <SparkParticle delay={0} x={20} />
        <SparkParticle delay={0.5} x={50} />
        <SparkParticle delay={1} x={75} />
        <SparkParticle delay={0.3} x={35} />
        <SparkParticle delay={0.8} x={85} />

        {/* Header */}
        <div className="relative z-10 text-center mb-4">
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <Brain className="w-5 h-5 sureshot-icon-glow" style={{ color: "hsl(25, 100%, 55%)" }} />
            <h2 className="text-lg font-black sureshot-gradient-text tracking-tight"
              style={{ textShadow: "0 0 20px hsl(15 100% 55% / 0.3)" }}>
              Practice Zone Prediction
            </h2>
          </motion.div>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
            Ultra AI Powered • <span className="sureshot-gradient-text font-bold">99% Pattern Accuracy</span>
          </p>
        </div>

        {/* Confidence Ring + Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative z-10 flex items-center justify-around mb-4"
        >
          <CircularProgress value={87} />
          <div className="flex flex-col gap-2">
            {[
              { label: "Topics Analyzed", value: "2,450+", icon: TrendingUp },
              { label: "Pattern Matches", value: "1,890", icon: Zap },
              { label: "Accuracy Score", value: "99.2%", icon: Brain },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-2"
              >
                <stat.icon className="w-3.5 h-3.5 sureshot-icon-glow" style={{ color: "hsl(25, 100%, 55%)" }} />
                <div>
                  <p className="text-xs font-bold text-foreground">{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 flex flex-wrap items-center justify-center gap-3 mb-4 text-[10px]"
        >
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "hsl(15 100% 55% / 0.12)", color: "hsl(25, 100%, 65%)" }}>
            <Rocket className="w-3 h-3" /> Most Used by Toppers 🚀
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "hsl(330 100% 55% / 0.12)", color: "hsl(330, 100%, 70%)" }}>
            <TrendingUp className="w-3 h-3" /> Trending Last 7 Days
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SureShotHero;
