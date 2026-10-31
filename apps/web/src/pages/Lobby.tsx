import type { RoomSnapshot } from '@wordbomb/shared';
import { Chat } from '../components/Chat';
import { MemberList } from '../components/MemberList';
import { RoomHeader } from '../components/RoomHeader';
import { SettingsPanel } from '../components/SettingsPanel';
import { Button, Panel } from '../components/ui';
import { useApp } from '../lib/appContext';

export function Lobby({
  room,
  myId,
  onLeave,
}: {
  room: RoomSnapshot;
  myId: string;
  onLeave: () => void;
}) {
  const { client } = useApp();
  const isHost = room.hostId === myId;
  const seated = room.members.filter((m) => m.connected && m.wantsToPlay).length;
  const canStart = isHost && seated >= 2;
  const lastWinner =
    room.game?.status === 'finished'
      ? room.members.find((m) => m.id === room.game?.winnerId)
      : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <RoomHeader
        room={room}
        isHost={isHost}
        onLeave={onLeave}
        onToggleVisibility={() =>
          client.setVisibility(room.visibility === 'public' ? 'private' : 'public')
        }
      />

      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title="Players">
            <MemberList
              members={room.members}
              hostId={room.hostId}
              myId={myId}
              maxPlayers={room.settings.maxPlayers}
              onToggleSeated={(seated) => client.setSeated(seated)}
            />
            <div className="mt-4">
              {isHost ? (
                <Button
                  onClick={() => client.startGame()}
                  disabled={!canStart}
                  className="w-full py-3 text-base"
                >
                  {seated >= 2
                    ? room.gamesPlayed > 0
                      ? 'Play again'
                      : 'Start game'
                    : 'Need 2 players to start'}
                </Button>
              ) : (
                <p className="text-center text-sm text-muted">
                  {seated >= 2
                    ? 'Waiting for the host to start'
                    : 'Share the link to get more players'}
                </p>
              )}
              {lastWinner && (
                <p className="mt-2 text-center text-sm text-muted">
                  Last game: <span className="text-text">{lastWinner.name}</span> won
                </p>
              )}
            </div>
          </Panel>
          <Panel title="Chat" className="md:hidden">
            <Chat
              messages={room.chat}
              myId={myId}
              onSend={(t) => client.chat(t)}
              className="h-56"
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <Panel title={isHost ? 'Settings' : 'Settings (host only)'}>
            <SettingsPanel
              settings={room.settings}
              editable={isHost}
              onChange={(s) => client.updateSettings(s)}
            />
          </Panel>
          <Panel title="Chat" className="hidden md:flex md:min-h-64 md:flex-col">
            <Chat
              messages={room.chat}
              myId={myId}
              onSend={(t) => client.chat(t)}
              className="flex-1"
            />
          </Panel>
        </div>
      </div>
    </main>
  );
}
