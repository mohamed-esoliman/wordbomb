import { useSyncExternalStore } from 'react';

export type Route = { page: 'home' } | { page: 'room'; roomId: string };

export function parseRoute(pathname: string): Route {
  const match = /^\/room\/([A-Za-z0-9]{6})\/?$/.exec(pathname);
  if (match) return { page: 'room', roomId: match[1]!.toUpperCase() };
  return { page: 'home' };
}

export function roomPath(roomId: string): string {
  return `/room/${roomId}`;
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

const getPath = () => window.location.pathname;

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getPath, getPath);
  return parseRoute(pathname);
}
