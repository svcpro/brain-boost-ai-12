import { motion } from "framer-motion";

interface SplashPhase3Props {
  onComplete: () => void;
}

// "Command & Control" — Final CTA with UI element previews
const SplashPhase3 = ({ onComplete }: SplashPhase3Props) => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Subtle light streaks */}
      <motion.div
        className="absolute top-0 left-1/4 w-px h-full"
        style={{ background: "linear-gradient(to bottom, transparent, #00E5FF08, transparent)" }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-0 right-1/3 w-px h-full"
        style={{ background: "linear-gradient(to bottom, transparent, #7C4DFF08, transparent)" }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 4, repeat: Infinity, delay: 1 }}
      />

      {/* UI element previews */}
      <div className="flex items-center gap-6 mb-12">
        {/* Brain Ring */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#00E5FF30" strokeWidth="3" />
            <motion.circle
              cx="26" cy="26" r="22" fill="none" stroke="#00E5FF" strokeWidth="3"
              strokeLinecap="round" strokeDasharray={138} strokeDashoffset={138}
              animate={{ strokeDashoffset: 138 * 0.25 }}
              transition={{ duration: 1, delay: 0.5 }}
              transform="rotate(-90 26 26)"
              style={{ filter: "drop-shadow(0 0 6px #00E5FF60)" }}
            />
            <circle cx="26" cy="26" r="4" fill="#00E5FF20" />
            <circle cx="26" cy="26" r="2" fill="#00E5FF" />
          </svg>
        </motion.div>

        {/* Memory Map Node */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52">
            <motion.circle cx="26" cy="26" r="8" fill="#7C4DFF20" stroke="#7C4DFF" strokeWidth="1.5"
              animate={{ r: [8, 10, 8] }} transition={{ duration: 2, repeat: Infinity }}
            />
            {[0, 72, 144, 216, 288].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x = 26 + Math.cos(rad) * 18;
              const y = 26 + Math.sin(rad) * 18;
              return (
                <g key={i}>
                  <line x1="26" y1="26" x2={x} y2={y} stroke="#7C4DFF40" strokeWidth="0.8" />
                  <motion.circle cx={x} cy={y} r="3" fill="#7C4DFF40" stroke="#7C4DFF" strokeWidth="0.8"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.1, type: "spring" }}
                  />
                </g>
              );
            })}
          </svg>
        </motion.div>

        {/* Action Button Icon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #00FF9420, #00E5FF10)",
              border: "1px solid #00FF9440",
            }}
          >
            <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#00FF94" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" fill="#00FF9420"
              />
            </motion.svg>
          </div>
        </motion.div>
      </div>

      {/* Headlines */}
      <motion.h1
        className="text-2xl md:text-3xl font-bold text-center leading-tight"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <span style={{ color: "#ffffff" }}>Train Your Brain.</span>
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
        className="text-xs mt-3 tracking-wider uppercase"
        style={{ color: "#ffffff40" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        Powered by AI Automation
      </motion.p>

      {/* CTA Button */}
      <motion.div className="relative mt-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.6 }}
      >
        {/* Ripple effect */}
        <motion.div
          className="absolute inset-[-8px] rounded-2xl"
          animate={{
            boxShadow: [
              "0 0 0 0px #00E5FF30",
              "0 0 0 12px #00E5FF00",
            ],
          }}
          transition={{ duration: 1.5, delay: 2.2, repeat: 2 }}
        />

        <motion.button
          onClick={onComplete}
          className="relative px-10 py-3.5 rounded-xl font-semibold text-sm tracking-wide"
          style={{
            background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
            color: "#0B0F1A",
            boxShadow: "0 0 30px #00E5FF30, 0 0 60px #7C4DFF15",
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          animate={{
            boxShadow: [
              "0 0 20px #00E5FF20, 0 0 40px #7C4DFF10",
              "0 0 40px #00E5FF40, 0 0 80px #7C4DFF20",
              "0 0 20px #00E5FF20, 0 0 40px #7C4DFF10",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Get Started →
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default SplashPhase3;
