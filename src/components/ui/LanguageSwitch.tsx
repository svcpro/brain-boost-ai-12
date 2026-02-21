import { motion } from "framer-motion";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LanguageSwitchProps {
  className?: string;
  variant?: "pill" | "minimal";
}

const LanguageSwitch = ({ className, variant = "pill" }: LanguageSwitchProps) => {
  const { language, setLanguage } = useLanguage();

  const options: { value: Language; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "hi", label: "हिंदी" },
  ];

  const activeIndex = language === "hi" ? 1 : 0;

  return (
    <div
      className={cn(
        "relative flex items-center rounded-full p-0.5 transition-colors",
        variant === "pill"
          ? "bg-secondary border border-border"
          : "bg-transparent",
        className
      )}
    >
      {/* Sliding indicator */}
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-primary/20 border border-primary/30"
        initial={false}
        animate={{
          left: activeIndex === 0 ? "2px" : "50%",
          width: "calc(50% - 2px)",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />

      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLanguage(opt.value)}
          className={cn(
            "relative z-10 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors min-w-[42px]",
            language === opt.value
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitch;
