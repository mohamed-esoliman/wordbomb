import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function App() {
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const socket = io();
    socket.on('connect', () => {
      socket.emit('ping', (reply: string) => setStatus(`connected (${reply})`));
    });
    socket.on('disconnect', () => setStatus('disconnected'));
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <h1 className="text-3xl font-bold">WordBomb</h1>
      <p className="mt-2 text-slate-400">Socket: {status}</p>
    </main>
  );
}
