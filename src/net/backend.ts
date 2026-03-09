export const resolveBackendUrl = () => {
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
