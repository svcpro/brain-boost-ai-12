import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import enTranslations from "@/i18n/en.json";
import hiTranslations from "@/i18n/hi.json";

export type Language = "en" | "hi";

type TranslationMap = typeof enTranslations;

const translations: Record<Language, TranslationMap> = {
  en: enTranslations,
  hi: hiTranslations,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

/** Detect browser language */
const detectBrowserLanguage = (): Language => {
  const nav = navigator.language || (navigator as any).userLanguage || "en";
  return nav.startsWith("hi") ? "hi" : "en";
};

/** Get saved language from localStorage */
const getSavedLanguage = (): Language | null => {
  const saved = localStorage.getItem("acry-language");
  if (saved === "en" || saved === "hi") return saved;
  return null;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return getSavedLanguage() || detectBrowserLanguage();
  });
  const [userId, setUserId] = useState<string | null>(null);

  // Track auth state for DB sync
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load language from DB on login
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_settings")
      .select("preferred_language")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_language === "hi" || data?.preferred_language === "en") {
          setLanguageState(data.preferred_language as Language);
          localStorage.setItem("acry-language", data.preferred_language);
        }
      });
  }, [userId]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("acry-language", lang);
    // Persist to DB (fire-and-forget)
    if (userId) {
      supabase
        .from("user_settings")
        .upsert({ user_id: userId, preferred_language: lang } as any, { onConflict: "user_id" })
        .then(() => {});
    }
  }, [userId]);

  /** Get translation by dot-separated key with optional interpolation */
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const parts = key.split(".");
    let result: any = translations[language];
    for (const part of parts) {
      result = result?.[part];
      if (result === undefined) break;
    }
    // Fallback to English
    if (result === undefined) {
      result = translations.en as any;
      for (const part of parts) {
        result = result?.[part];
        if (result === undefined) break;
      }
    }
    if (typeof result !== "string") return key;
    // Interpolate params
    if (params) {
      return result.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
    }
    return result;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
