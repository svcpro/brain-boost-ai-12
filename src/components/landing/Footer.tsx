import { Link } from "react-router-dom";
import { Brain, Mail, MapPin, Phone, Twitter, Linkedin, Github, Instagram } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Community", href: "/community" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact Us", href: "/contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "Cookie Policy", href: "/cookie-policy" },
  ],
};

const socials = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Github, href: "#", label: "GitHub" },
];

const Footer = () => (
  <footer className="relative z-10 border-t border-border bg-card/50 backdrop-blur-sm">
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg neural-gradient neural-border flex items-center justify-center">
              <span className="text-primary font-bold text-sm">A</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">ACRY</span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            AI-powered Second Brain for competitive exam preparation. Study smarter, not harder.
          </p>
          <div className="flex items-center gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="w-9 h-9 rounded-lg bg-secondary/60 hover:bg-primary/20 flex items-center justify-center transition-colors group"
              >
                <s.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4 tracking-wide uppercase">Product</h4>
          <ul className="space-y-3">
            {footerLinks.product.map((link) => (
              <li key={link.label}>
                <Link to={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4 tracking-wide uppercase">Company</h4>
          <ul className="space-y-3">
            {footerLinks.company.map((link) => (
              <li key={link.label}>
                <Link to={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4 tracking-wide uppercase">Legal</h4>
          <ul className="space-y-3">
            {footerLinks.legal.map((link) => (
              <li key={link.label}>
                <Link to={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Contact bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> support@acry.ai</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> India</span>
        </div>
      </div>

      {/* Copyright */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6 border-t border-border/50">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ACRY. All rights reserved.</p>
        <p className="text-xs text-muted-foreground">AI Second Brain for All Exams.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
