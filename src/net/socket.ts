import { io } from "socket.io-client";

/**
 * Backend URL resolution:
 * - If VITE_BACKEND_URL is set, use it (recommended for dev).
 * - On localhost, default to http://localhost:3001 (backend dev server).
 * - Otherwise, use same-origin (recommended behind one domain + reverse proxy).
 */
const resolveBackendUrl = () => {
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001";
    }
    return window.location.origin;
  }

  return "http://localhost:3001";
};

export const socket = io(resolveBackendUrl(), {
  path: "/socket.io",
  transports: ["websocket"],
});
