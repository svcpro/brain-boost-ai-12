import { Link } from "react-router-dom";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Contact", href: "/contact" },
];

const Footer = () => (
  <footer className="relative z-10 border-t border-primary/10">
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg neural-gradient neural-border flex items-center justify-center">
            <span className="text-primary font-bold text-xs">A</span>
          </div>
          <span className="font-display font-bold text-foreground">ACRY</span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mt-8 mb-6" />

      <p className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ACRY. AI Second Brain for All Exams.
      </p>
    </div>
  </footer>
);

export default Footer;
