import { motion } from "framer-motion";
import { Brain, Target, Users, Sparkles, Shield, Zap, Globe, Award } from "lucide-react";
import Footer from "@/components/landing/Footer";
import ACRYLogo from "@/components/landing/ACRYLogo";
import { Link } from "react-router-dom";

const values = [
  { icon: Brain, title: "AI-First Learning", desc: "We leverage cutting-edge AI to predict what you'll forget and optimize when you study." },
  { icon: Target, title: "Mission-Driven", desc: "Every feature we build serves one purpose: helping students achieve their exam goals." },
  { icon: Users, title: "Community Powered", desc: "Learning is better together. Our community features connect students worldwide." },
  { icon: Shield, title: "Privacy by Design", desc: "Your study data is yours. We never sell personal information to third parties." },
];

const stats = [
  { value: "50K+", label: "Active Students" },
  { value: "10M+", label: "Topics Studied" },
  { value: "95%", label: "Retention Rate" },
  { value: "4.8★", label: "User Rating" },
];

const AboutPage = () => (
  <div className="min-h-screen bg-background flex flex-col">
    {/* Navbar */}
    <nav className="sticky top-0 z-50 glass-strong border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <ACRYLogo variant="navbar" animate={false} />
        </Link>
        <Link
          to="/auth"
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold glow-primary hover:glow-primary-strong transition-all duration-300"
        >
          Get Started
        </Link>
      </div>
    </nav>

    {/* Hero */}
    <section className="py-20 px-6 text-center border-b border-border/50">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass neural-border mb-6">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">About ACRY</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
          Building the Future of <span className="gradient-text">Exam Preparation</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          ACRY is an AI-powered Second Brain designed to help students prepare for competitive exams with intelligent memory tracking, personalized study plans, and predictive analytics.
        </p>
      </motion.div>
    </section>

    {/* Stats */}
    <section className="py-16 px-6 border-b border-border/50">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="text-center glass rounded-2xl neural-border p-6"
          >
            <p className="text-3xl font-display font-bold text-primary mb-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>

    {/* Mission */}
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">Our Mission</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            We believe every student deserves an unfair advantage. ACRY uses AI to understand your unique learning patterns and optimize your study strategy — so you remember more, stress less, and rank higher.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {values.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i }}
              className="glass rounded-2xl neural-border p-6 flex gap-4"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl neural-gradient neural-border flex items-center justify-center">
                <v.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* What Sets Us Apart */}
    <section className="py-20 px-6 border-t border-border/50">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">What Sets ACRY Apart</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-10">
            Unlike traditional study apps, ACRY doesn't just track your progress — it predicts your future performance and adapts in real-time.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: Zap, label: "Predictive AI", desc: "Knows what you'll forget before you do" },
            { icon: Globe, label: "Multi-Exam Support", desc: "UPSC, JEE, NEET, CAT, GATE & more" },
            { icon: Award, label: "Gamified Learning", desc: "Streaks, badges, and leaderboards" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i }}
              className="glass rounded-2xl neural-border p-6 text-center"
            >
              <div className="w-12 h-12 mx-auto rounded-xl neural-gradient neural-border flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-1">{item.label}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-16 px-6 border-t border-border/50">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-display font-bold text-foreground mb-3">Ready to Transform Your Study Game?</h2>
        <p className="text-muted-foreground mb-6">Start your 15-day free Pro trial today.</p>
        <Link
          to="/auth"
          className="inline-block px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong hover:scale-105 transition-all duration-300"
        >
          Start Free Trial
        </Link>
      </div>
    </section>

    <Footer />
  </div>
);

export default AboutPage;
