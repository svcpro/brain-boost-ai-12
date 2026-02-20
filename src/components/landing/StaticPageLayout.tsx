import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/landing/Footer";
import ACRYLogo from "@/components/landing/ACRYLogo";

interface StaticPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  lastUpdated?: string;
}

const StaticPageLayout = ({ title, subtitle, children, lastUpdated }: StaticPageLayoutProps) => (
  <div className="min-h-screen bg-background flex flex-col">
    {/* Navbar */}
    <nav className="sticky top-0 z-50 glass-strong border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <ACRYLogo variant="navbar" animate={false} />
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </nav>

    {/* Hero */}
    <header className="py-16 px-6 text-center border-b border-border/50">
      <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">{title}</h1>
      {subtitle && <p className="text-muted-foreground max-w-xl mx-auto">{subtitle}</p>}
      {lastUpdated && <p className="text-xs text-muted-foreground/60 mt-3">Last updated: {lastUpdated}</p>}
    </header>

    {/* Content */}
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
      <div className="prose-custom space-y-8">{children}</div>
    </main>

    <Footer />
  </div>
);

export default StaticPageLayout;
