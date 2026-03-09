import { io } from "socket.io-client";
import { resolveBackendUrl } from "./backend";

export const socket = io(resolveBackendUrl(), {
  path: "/socket.io",
  transports: ["websocket"],
});
