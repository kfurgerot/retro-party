import { useState } from "react";

type ProfileScope = "retro-party" | "planning-poker";
const STORAGE_KEY_PREFIX = "agile-suite-profile";
const getStorageKey = (scope: ProfileScope) => `${STORAGE_KEY_PREFIX}-${scope}`;

type Profile = { name: string; avatar: number };

const loadProfile = (scope: ProfileScope): Profile => {
  try {
    const raw = localStorage.getItem(getStorageKey(scope));
    if (!raw) return { name: "", avatar: 0 };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      "avatar" in parsed &&
      typeof (parsed as Profile).name === "string" &&
      typeof (parsed as Profile).avatar === "number"
    ) {
      return parsed as Profile;
    }
  } catch {
    // ignore
  }
  return { name: "", avatar: 0 };
};

const saveProfile = (scope: ProfileScope, profile: Profile) => {
  try {
    localStorage.setItem(getStorageKey(scope), JSON.stringify(profile));
  } catch {
    // ignore
  }
};

export const useProfile = (scope: ProfileScope, overrideName?: string, overrideAvatar?: number) => {
  const [profile, setProfileState] = useState<Profile>(() => {
    const stored = loadProfile(scope);
    return {
      name: overrideName?.trim() || stored.name,
      avatar: typeof overrideAvatar === "number" ? overrideAvatar : stored.avatar,
    };
  });

  const setProfile = (next: Profile) => {
    setProfileState(next);
    saveProfile(scope, next);
  };

  const hasProfile = profile.name.trim().length >= 2;

  return { profile, setProfile, hasProfile };
};
