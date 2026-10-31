import { useMemo, useState } from 'react';
import { AppContext } from './lib/appContext';
import { loadProfile, saveProfile, type Profile } from './lib/profile';
import { RoomClient } from './lib/roomClient';
import { useRoute } from './lib/router';
import { createSocket } from './lib/socket';
import { Home } from './pages/Home';
import { Room } from './pages/Room';

export function App() {
  const client = useMemo(() => new RoomClient(createSocket()), []);
  const [profile, setProfileState] = useState<Profile>(() => loadProfile(window.localStorage));
  const route = useRoute();

  const value = useMemo(
    () => ({
      client,
      profile,
      setProfile: (next: Profile) => {
        saveProfile(window.localStorage, next);
        setProfileState(next);
      },
    }),
    [client, profile],
  );

  return (
    <AppContext.Provider value={value}>
      {route.page === 'home' ? <Home /> : <Room roomId={route.roomId} />}
    </AppContext.Provider>
  );
}
