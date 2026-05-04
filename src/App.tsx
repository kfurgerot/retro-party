import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/routes";
import { UI_MODE } from "@/lib/uiMode";
import { useEffect } from "react";

const App = () => {
  useEffect(() => {
    document.documentElement.dataset.uiMode = UI_MODE;
  }, []);

  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
};

export default App;
