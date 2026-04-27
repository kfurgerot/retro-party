import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { S2C_EVENTS } from "@shared/contracts/socketEvents.js";
import { socket } from "@/net/socket";

// Phase β.2 — global listener that redirects participants when the host
// terminates the session. Mounted at App level (inside BrowserRouter).
export function SessionEndedListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const onEnded = (payload: unknown) => {
      const code = (payload as { code?: string } | undefined)?.code;
      if (typeof code === "string" && code.length > 0) {
        navigate(`/r/${code}`, { replace: true });
      }
    };
    socket.on(S2C_EVENTS.SESSION_ENDED, onEnded);
    return () => {
      socket.off(S2C_EVENTS.SESSION_ENDED, onEnded);
    };
  }, [navigate]);

  return null;
}
