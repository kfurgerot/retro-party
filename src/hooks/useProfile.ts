import { useState } from "react";

const STORAGE_KEY = "agile-suite-profile";

type Profile = { name: string; avatar: number };

const loadProfile = (): Profile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

const saveProfile = (profile: Profile) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
};

export const useProfile = (overrideName?: string, overrideAvatar?: number) => {
  const [profile, setProfileState] = useState<Profile>(() => {
    const stored = loadProfile();
    return {
      name: overrideName?.trim() || stored.name,
      avatar: typeof overrideAvatar === "number" ? overrideAvatar : stored.avatar,
    };
  });

  const setProfile = (next: Profile) => {
    setProfileState(next);
    saveProfile(next);
  };

  const hasProfile = profile.name.trim().length >= 2;

  return { profile, setProfile, hasProfile };
};
