import { useEffect, useMemo, useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { AppContext } from './lib/appContext';
import { loadProfile, saveProfile, type Profile } from './lib/profile';
import { RoomClient } from './lib/roomClient';
import { useRoute } from './lib/router';
import { createSocket } from './lib/socket';
import { SoundEngine } from './lib/sound';
import { Home } from './pages/Home';
import { Room } from './pages/Room';

export function App() {
  const client = useMemo(() => new RoomClient(createSocket()), []);
  const sound = useMemo(() => new SoundEngine(window.localStorage), []);
  const [profile, setProfileState] = useState<Profile>(() => loadProfile(window.localStorage));
  const route = useRoute();

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [sound]);

  const value = useMemo(
    () => ({
      client,
      sound,
      profile,
      setProfile: (next: Profile) => {
        saveProfile(window.localStorage, next);
        setProfileState(next);
      },
    }),
    [client, sound, profile],
  );

  return (
    <AppContext.Provider value={value}>
      <LazyMotion features={domAnimation} strict>
        {route.page === 'home' ? <Home /> : <Room roomId={route.roomId} />}
      </LazyMotion>
    </AppContext.Provider>
  );
}
