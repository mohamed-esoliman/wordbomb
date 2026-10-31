import { createContext, useContext } from 'react';
import type { Profile } from './profile.ts';
import type { RoomClient } from './roomClient.ts';

export interface AppContextValue {
  client: RoomClient;
  profile: Profile;
  setProfile: (profile: Profile) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppContext');
  return value;
}
