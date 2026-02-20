import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Send, Loader2, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/landing/Footer";
import ACRYLogo from "@/components/landing/ACRYLogo";
import { Link } from "react-router-dom";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Email must be under 255 characters"),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject must be under 200 characters"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message must be under 2000 characters"),
});

type ContactForm = z.infer<typeof contactSchema>;

const ContactPage = () => {
  const { toast } = useToast();
  const [form, setForm] = useState<ContactForm>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactForm, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof ContactForm;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    // Simulate sending (in production, invoke an edge function)
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
    toast({ title: "Message Sent! ✉️", description: "We'll get back to you within 24 hours." });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ACRYLogo variant="navbar" animate={false} />
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-6 text-center border-b border-border/50">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass neural-border mb-6">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">Get in Touch</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">Contact Us</h1>
          <p className="text-muted-foreground max-w-md mx-auto">Have a question, feedback, or need help? We'd love to hear from you.</p>
        </motion.div>
      </section>

      <main className="flex-1 py-16 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-10">
          {/* Contact Info */}
          <div className="md:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="font-display font-semibold text-foreground mb-4">Reach Out</h2>
              <div className="space-y-4">
                {[
                  { icon: Mail, label: "Email", value: "support@acry.ai", href: "mailto:support@acry.ai" },
                  { icon: MapPin, label: "Location", value: "India" },
                  { icon: Clock, label: "Response Time", value: "Within 24 hours" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-secondary/60 flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="text-sm text-foreground hover:text-primary transition-colors">{item.value}</a>
                      ) : (
                        <p className="text-sm text-foreground">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl neural-border p-5">
              <h3 className="font-display font-semibold text-foreground text-sm mb-2">Common Topics</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>• Subscription & billing questions</li>
                <li>• Feature requests & feedback</li>
                <li>• Technical issues & bug reports</li>
                <li>• Partnership inquiries</li>
                <li>• Data & privacy concerns</li>
              </ul>
            </motion.div>
          </div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="md:col-span-3"
          >
            {submitted ? (
              <div className="glass rounded-2xl neural-border p-10 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-xl font-display font-bold text-foreground mb-2">Message Sent!</h3>
                <p className="text-sm text-muted-foreground mb-6">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="px-6 py-2 rounded-xl glass neural-border text-sm text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="glass rounded-2xl neural-border p-6 space-y-5">
                <h2 className="font-display font-semibold text-foreground">Send a Message</h2>

                {/* Name */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                    className={`w-full px-4 py-2.5 rounded-xl bg-secondary/50 border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                      errors.name ? "border-destructive" : "border-border"
                    }`}
                  />
                  {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="you@example.com"
                    maxLength={255}
                    className={`w-full px-4 py-2.5 rounded-xl bg-secondary/50 border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                      errors.email ? "border-destructive" : "border-border"
                    }`}
                  />
                  {errors.email && <p className="text-[11px] text-destructive mt-1">{errors.email}</p>}
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    placeholder="What's this about?"
                    maxLength={200}
                    className={`w-full px-4 py-2.5 rounded-xl bg-secondary/50 border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                      errors.subject ? "border-destructive" : "border-border"
                    }`}
                  />
                  {errors.subject && <p className="text-[11px] text-destructive mt-1">{errors.subject}</p>}
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    rows={5}
                    maxLength={2000}
                    className={`w-full px-4 py-2.5 rounded-xl bg-secondary/50 border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none ${
                      errors.message ? "border-destructive" : "border-border"
                    }`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {errors.message && <p className="text-[11px] text-destructive">{errors.message}</p>}
                    <p className="text-[10px] text-muted-foreground ml-auto">{form.message.length}/2000</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
