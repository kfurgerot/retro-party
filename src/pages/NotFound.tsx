import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { fr } from "@/i18n/fr";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("Erreur 404: route inexistante:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{fr.notFound.title}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {fr.notFound.backHome}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
