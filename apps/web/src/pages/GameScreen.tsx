import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '@wordbomb/shared';
import { AlphabetTracker } from '../components/AlphabetTracker';
import { Bomb, useFuse } from '../components/Bomb';
import { Chat } from '../components/Chat';
import { PlayerCard, type Flash } from '../components/PlayerCard';
import { PlayerRing } from '../components/PlayerRing';
import { RoomHeader } from '../components/RoomHeader';
import { Button, Panel } from '../components/ui';
import { WordInput } from '../components/WordInput';
import { useApp } from '../lib/appContext';
import { tickIntervalMs } from '../lib/sound';

interface GameScreenProps {
  room: RoomSnapshot;
  myId: string;
  typing: Record<string, string>;
  onLeave: () => void;
}

const FLASH_MS = 700;

export function GameScreen({ room, myId, typing, onLeave }: GameScreenProps) {
  const { client, sound } = useApp();
  const game = room.game!;
  const fuse = useFuse(game, room.settings, client.clock);
  const fuseRef = useRef(fuse);
  useEffect(() => {
    fuseRef.current = fuse;
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [flashes, setFlashes] = useState<Record<string, { kind: Flash; at: number }>>({});
  const [explosion, setExplosion] = useState(0);

  const holder = game.seats[game.turnIndex]!;
  const holderMember = room.members.find((m) => m.id === holder.playerId);
  const mySeat = game.seats.find((s) => s.playerId === myId);
  const myTurn = holder.playerId === myId;
  const trackerSeat = mySeat && !mySeat.eliminated ? mySeat : holder;
  const recent = game.words.slice(-8).reverse();
  const memberOf = (id: string) => room.members.find((m) => m.id === id);

  useEffect(() => {
    const flash = (playerId: string, kind: Flash) => {
      const at = Date.now();
      setFlashes((prev) => ({ ...prev, [playerId]: { kind, at } }));
      setTimeout(() => {
        setFlashes((prev) =>
          prev[playerId]?.at === at ? { ...prev, [playerId]: undefined! } : prev,
        );
      }, FLASH_MS);
    };
    const offs = [
      client.on('word:accepted', ({ playerId }) => {
        flash(playerId, 'accept');
        sound.play('accept');
      }),
      client.on('word:rejected', ({ playerId }) => {
        if (playerId === myId) sound.play('reject');
      }),
      client.on('bomb:exploded', ({ playerId }) => {
        flash(playerId, 'hit');
        setExplosion(Date.now());
        sound.play('explode');
      }),
      client.on('player:lifeGained', ({ playerId }) => {
        flash(playerId, 'gain');
        sound.play('lifeGained');
      }),
      client.on('player:eliminated', ({ playerId }) => {
        flash(playerId, 'out');
        sound.play('eliminated');
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [client, sound, myId]);

  useEffect(() => {
    if (myTurn) sound.play('turn');
    document.title = myTurn ? 'Your turn! - WordBomb' : 'WordBomb';
    return () => {
      document.title = 'WordBomb';
    };
  }, [myTurn, game.turnStartedAt, sound]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const { intensity, safe } = fuseRef.current;
      sound.play('tick', intensity);
      timer = setTimeout(tick, tickIntervalMs(intensity, safe));
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [sound]);

  const center = (
    <div className="flex flex-col items-center gap-3">
      <Bomb prompt={game.prompt} fuse={fuse} explosion={explosion} />
      {myTurn ? (
        <WordInput
          key={`${game.prompt}-${game.turnStartedAt}`}
          prompt={game.prompt}
          onTyping={(t) => client.typing(t)}
          onSubmit={(w) => client.submit(w)}
        />
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted">
            {mySeat?.eliminated ? 'You are out. ' : mySeat ? '' : 'Spectating. '}
            <span className="font-semibold text-text">{holderMember?.name ?? 'Someone'}</span> is
            typing
          </p>
          <p className="mt-1 h-7 font-mono text-xl tracking-wide uppercase">
            {typing[holder.playerId] ?? holder.currentInput}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <RoomHeader room={room} isHost={room.hostId === myId} onLeave={onLeave}>
        <Button
          variant="ghost"
          className="px-3 py-1.5 text-xs lg:hidden"
          onClick={() => setChatOpen((o) => !o)}
        >
          Chat
        </Button>
      </RoomHeader>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <section className="flex flex-col items-center gap-6">
          <PlayerRing count={game.seats.length} center={center}>
            {game.seats.map((seat) => (
              <PlayerCard
                key={seat.playerId}
                seat={seat}
                member={memberOf(seat.playerId)}
                active={seat.playerId === holder.playerId}
                me={seat.playerId === myId}
                typing={typing[seat.playerId] ?? seat.currentInput}
                maxLives={room.settings.maxLives}
                flash={flashes[seat.playerId]}
              />
            ))}
          </PlayerRing>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            <Panel>
              <AlphabetTracker
                used={trackerSeat.usedLetters}
                label={
                  trackerSeat.playerId === myId
                    ? 'Your letters'
                    : `${memberOf(trackerSeat.playerId)?.name ?? 'Their'} letters`
                }
              />
            </Panel>
            <Panel title="Recent words">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No words yet</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {recent.map((w, i) => (
                    <li
                      key={`${w.word}-${i}`}
                      className="rounded-lg bg-surface-2 px-2 py-0.5 font-mono text-sm"
                      title={memberOf(w.playerId)?.name}
                    >
                      {w.word}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </section>

        <aside className={`${chatOpen ? 'flex' : 'hidden'} lg:flex`}>
          <Panel title="Chat" className="flex w-full flex-col lg:min-h-96">
            <Chat
              messages={room.chat}
              myId={myId}
              onSend={(t) => client.chat(t)}
              className="h-64 flex-1 lg:h-auto"
            />
          </Panel>
        </aside>
      </div>
    </main>
  );
}
