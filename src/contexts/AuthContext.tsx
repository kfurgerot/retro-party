import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, HostUser, OAuthProviderId, OAuthProvidersAvailability } from "@/net/api";

type AuthState = {
  user: HostUser | null;
  loading: boolean;
  oauthProviders: OAuthProvidersAvailability;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  startOAuthLogin: (provider: OAuthProviderId, nextPath?: string) => void;
  updateProfile: (displayName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<HostUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvidersAvailability>({
    google: false,
    microsoft: false,
  });

  useEffect(() => {
    api
      .getOAuthProviders()
      .then((res) => setOauthProviders(res.providers))
      .catch(() => {
        setOauthProviders({ google: false, microsoft: false });
      });
  }, []);

  useEffect(() => {
    api
      .getMe()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.register({ email, password, displayName });
    setUser(res.user);
  }, []);

  const startOAuthLogin = useCallback((provider: OAuthProviderId, nextPath?: string) => {
    const url = api.getOAuthStartUrl(provider, nextPath);
    window.location.assign(url);
  }, []);

  const updateProfile = useCallback(async (displayName: string) => {
    const res = await api.updateProfile({ displayName });
    setUser(res.user);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await api.changePassword({ currentPassword, newPassword });
    return res.message;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        oauthProviders,
        login,
        register,
        startOAuthLogin,
        updateProfile,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
