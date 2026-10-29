'use client';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { restaurantEventNames } from '../../../packages/shared/src/realtime';
import type { OrderNotification } from '../../../packages/shared/src/realtime';
export function useRestaurantRealtime(
  actorKey: string | undefined,
  invalidate: () => void,
) {
  const callback = useRef(invalidate);
  callback.current = invalidate;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!actorKey) return;
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    const versions = new Map<string, number>();
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (active) callback.current();
      }, 100);
    };
    const socket = io({
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      timeout: 5000,
      transports: ['polling', 'websocket'],
      autoConnect: false,
    });
    socket.on('connect', () => {
      if (active) {
        setConnected(true);
        versions.clear();
        refresh();
      }
    });
    socket.on('disconnect', () => {
      if (active) {
        setConnected(false);
        refresh();
      }
    });
    socket.on('connect_error', () => {
      if (active) setConnected(false);
    });
    for (const name of restaurantEventNames)
      socket.on(name, (event: OrderNotification) => {
        if (
          !event ||
          typeof event.orderId !== 'string' ||
          !Number.isSafeInteger(event.version)
        )
          return;
        const key = name + ':' + event.orderId;
        if ((versions.get(key) || 0) >= event.version) return;
        if (versions.size >= 1000) versions.clear();
        versions.set(key, event.version);
        refresh();
      });
    socket.connect();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      socket.disconnect();
      setConnected(false);
    };
  }, [actorKey]);
  return connected;
}
