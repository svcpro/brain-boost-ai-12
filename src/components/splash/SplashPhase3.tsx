import { motion } from "framer-motion";

interface SplashPhase3Props {
  onComplete: () => void;
}

const SplashPhase3 = ({ onComplete }: SplashPhase3Props) => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Subtle light streaks */}
      <motion.div
        className="absolute top-0 left-[30%] w-px h-full pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #00E5FF06, transparent)" }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-0 right-[25%] w-px h-full pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #7C4DFF06, transparent)" }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 4, repeat: Infinity, delay: 1 }}
      />

      {/* UI previews row */}
      <div className="flex items-center gap-5 mb-10">
        {/* Brain Ring */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#00E5FF06", border: "1px solid #00E5FF18" }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#00E5FF25" strokeWidth="2" />
              <motion.circle
                cx="14" cy="14" r="11" fill="none" stroke="#00E5FF" strokeWidth="2"
                strokeLinecap="round" strokeDasharray={69} strokeDashoffset={69}
                animate={{ strokeDashoffset: 69 * 0.25 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                transform="rotate(-90 14 14)"
                style={{ filter: "drop-shadow(0 0 4px #00E5FF50)" }}
              />
              <circle cx="14" cy="14" r="2" fill="#00E5FF" />
            </svg>
          </div>
        </motion.div>

        {/* Memory Map */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#7C4DFF06", border: "1px solid #7C4DFF18" }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <motion.circle cx="14" cy="14" r="4" fill="#7C4DFF20" stroke="#7C4DFF" strokeWidth="1"
                animate={{ r: [4, 5, 4] }} transition={{ duration: 2, repeat: Infinity }}
              />
              {[0, 90, 180, 270].map((deg, i) => {
                const rad = (deg * Math.PI) / 180;
                const x = 14 + Math.cos(rad) * 10;
                const y = 14 + Math.sin(rad) * 10;
                return (
                  <g key={i}>
                    <line x1="14" y1="14" x2={x} y2={y} stroke="#7C4DFF30" strokeWidth="0.6" />
                    <motion.circle cx={x} cy={y} r="2" fill="#7C4DFF30" stroke="#7C4DFF" strokeWidth="0.5"
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ delay: 0.7 + i * 0.1, type: "spring" }}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </motion.div>

        {/* Action */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#00FF9406", border: "1px solid #00FF9418" }}
          >
            <motion.svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#00FF94" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" fill="#00FF9415"
              />
            </motion.svg>
          </div>
        </motion.div>
      </div>

      {/* Headline */}
      <motion.h1
        className="text-[22px] font-bold text-center leading-tight"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <span style={{ color: "#ffffffee" }}>Train Your Brain.</span>
        <br />
        <span style={{
          background: "linear-gradient(90deg, #00E5FF, #7C4DFF)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Outperform Your Competition.
        </span>
      </motion.h1>

      <motion.p
        className="text-[10px] mt-2.5 tracking-[0.14em] uppercase font-medium"
        style={{ color: "#ffffff35" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
      >
        Powered by AI Automation
      </motion.p>

      {/* CTA Button */}
      <motion.div
        className="relative mt-10 w-full max-w-[260px]"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.5 }}
      >
        {/* Ripple */}
        <motion.div
          className="absolute inset-[-6px] rounded-2xl pointer-events-none"
          animate={{
            boxShadow: ["0 0 0 0px #00E5FF25", "0 0 0 10px #00E5FF00"],
          }}
          transition={{ duration: 1.2, delay: 2, repeat: 2 }}
        />

        <motion.button
          onClick={onComplete}
          className="relative w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide"
          style={{
            background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
            color: "#0B0F1A",
            boxShadow: "0 0 25px #00E5FF25, 0 0 50px #7C4DFF10",
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          animate={{
            boxShadow: [
              "0 0 15px #00E5FF15, 0 0 30px #7C4DFF08",
              "0 0 30px #00E5FF30, 0 0 60px #7C4DFF15",
              "0 0 15px #00E5FF15, 0 0 30px #7C4DFF08",
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          Continue →
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default SplashPhase3;
