import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { PressStartScreen } from "@/components/screens/PressStartScreen";

const Home = () => {
  const navigate = useNavigate();
  const [hasStarted, setHasStarted] = useState(false);

  const handleStart = () => {
    setHasStarted(true);
  };

  if (!hasStarted) {
    return <PressStartScreen onStart={handleStart} />;
  }

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-2xl border-cyan-300/60 bg-card/90">
        <CardHeader>
          <CardTitle className="text-center text-2xl text-cyan-200">Retro Party</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-slate-300">
            Lance une room instantanee ou prepare tes templates host.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="h-12 border border-cyan-300 bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
              onClick={() => navigate("/play")}
            >
              Creer une room rapide
            </Button>
            <Button
              variant="secondary"
              className="h-12 border border-cyan-300/40 bg-slate-900/55 text-cyan-100 hover:bg-slate-900/75"
              onClick={() => navigate("/prepare")}
            >
              Preparer mes parties
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;
