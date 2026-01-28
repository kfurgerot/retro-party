import { io } from "socket.io-client";

/**
 * Uses same-origin by default (recommended behind one domain + reverse proxy).
 * If you host backend on another domain, set VITE_BACKEND_URL.
 */
export const socket = io(
  import.meta.env.VITE_BACKEND_URL ?? window.location.origin,
  {
    path: "/socket.io",
    transports: ["websocket"],
  }
);
