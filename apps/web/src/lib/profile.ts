import { AVATAR_IDS, NameSchema } from '@wordbomb/shared';

export interface Profile {
  name: string;
  avatar: string;
  token: string;
}

export const PROFILE_KEY = 'wordbomb:profile';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function newToken(): string {
  return crypto.randomUUID();
}

export function randomAvatar(random: () => number = Math.random): string {
  return AVATAR_IDS[Math.floor(random() * AVATAR_IDS.length)]!;
}

export function isValidName(name: string): boolean {
  return NameSchema.safeParse(name).success;
}

export function loadProfile(storage: StorageLike): Profile {
  let stored: Partial<Profile>;
  try {
    stored = JSON.parse(storage.getItem(PROFILE_KEY) ?? '{}') as Partial<Profile>;
  } catch {
    stored = {};
  }
  const name =
    typeof stored.name === 'string' && isValidName(stored.name) ? stored.name.trim() : '';
  const avatar =
    typeof stored.avatar === 'string' && AVATAR_IDS.includes(stored.avatar as never)
      ? stored.avatar
      : randomAvatar();
  const token =
    typeof stored.token === 'string' && stored.token.length >= 16 ? stored.token : newToken();
  const profile = { name, avatar, token };
  if (profile.token !== stored.token || profile.avatar !== stored.avatar) {
    saveProfile(storage, profile);
  }
  return profile;
}

export function saveProfile(storage: StorageLike, profile: Profile): void {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // storage can be unavailable in private mode; the profile still works in memory
  }
}
