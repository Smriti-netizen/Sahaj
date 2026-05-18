import { Link, Outlet } from "react-router-dom";
import { useState } from "react";
import { ui } from "../i18n";

export default function Layout() {
  const [locale, setLocale] = useState("hi");
  const t = ui[locale];

  return (
    <div className="min-h-screen flex flex-col bg-sahaj-cream text-sahaj-ink">
      <header className="border-b border-orange-200/60 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-6 relative">
          <button
            type="button"
            onClick={() => setLocale(locale === "hi" ? "en" : "hi")}
            className="absolute right-0 top-6 text-sm font-medium px-3 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 min-h-[44px]"
          >
            {t.langSwitch}
          </button>

          <div className="text-center pt-2 pb-2">
            <Link to="/" className="inline-block">
              <h1 className="text-5xl md:text-6xl font-bold text-sahaj-saffron tracking-tight">
                Sahaj
              </h1>
            </Link>
            <p className="mt-4 text-base md:text-lg text-stone-700 leading-relaxed max-w-lg mx-auto px-2">
              {t.aboutSahaj}
            </p>
          </div>

          <nav className="flex justify-center gap-8 mt-6 text-lg font-semibold">
            <Link to="/" className="text-sahaj-saffron hover:opacity-80">
              {t.home}
            </Link>
            <Link to="/legal" className="text-sahaj-green hover:opacity-80">
              {t.legal}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <Outlet context={{ locale, setLocale, t }} />
      </main>
    </div>
  );
}
