import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { fr } from "@/i18n/fr";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("Erreur 404: route inexistante:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="scanlines relative flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="neon-surface w-full max-w-md p-6 text-center sm:p-8">
        <h1 className="mb-2 text-5xl font-bold text-cyan-100">404</h1>
        <p className="mb-5 text-base text-slate-200">{fr.notFound.title}</p>
        <Link
          to="/"
          className="inline-flex rounded border border-cyan-300 bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.35)] transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {fr.notFound.backHome}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
