import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { fr } from "@/i18n/fr";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("Erreur 404: route inexistante:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f7f8f3] px-4 text-[#18211f]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-[#d8e2d9] bg-white/72 p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#163832] text-white">
          ⚡
        </div>
        <h1 className="mb-2 text-6xl font-black tracking-tight text-[#12201d]">404</h1>
        <p className="mb-5 text-base font-semibold text-[#54645d]">{fr.notFound.title}</p>
        <Link
          to="/"
          className="inline-flex rounded-xl border border-[#163832] bg-[#163832] px-4 py-2 text-sm font-black text-white shadow-[0_12px_26px_rgba(22,56,50,0.18)] transition hover:bg-[#1f4a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/25"
        >
          {fr.notFound.backHome}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
