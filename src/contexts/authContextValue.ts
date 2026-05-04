import { createContext } from "react";
import type { HostUser, OAuthProviderId, OAuthProvidersAvailability } from "@/net/api";

export type AuthState = {
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

export const AuthContext = createContext<AuthState | null>(null);
