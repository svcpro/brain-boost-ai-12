import { Brain, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full bg-primary/5 blur-[80px] md:blur-[120px]" />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto animate-[fade-in_0.5s_ease-out_both]">
        <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl neural-gradient neural-border mb-6 md:mb-8">
          <Brain className="w-10 h-10 md:w-12 md:h-12 text-primary" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full neural-border neural-gradient mb-4 md:mb-6">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary tracking-wider uppercase">AI-Powered Cognitive OS</span>
        </div>

        <h1 className="text-4xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4 md:mb-6">
          <span className="text-foreground">Your Brain,</span>
          <br />
          <span className="gradient-text text-glow">Digitally Extended.</span>
        </h1>

        <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-10">
          ACRY predicts what you'll forget, prevents rank drops, and autonomously builds your perfect study plan.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3.5 md:py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base md:text-lg glow-primary hover:glow-primary-strong transition-all duration-300 hover:scale-105"
          >
            <Brain className="w-5 h-5" />
            Start Building My Second Brain
          </Link>
          <a
            href="#features"
            className="inline-flex items-center justify-center px-6 md:px-8 py-3.5 md:py-4 rounded-xl glass neural-border font-medium text-foreground hover:bg-secondary/50 transition-all duration-300"
          >
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
