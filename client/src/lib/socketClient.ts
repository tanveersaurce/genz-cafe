import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    // Strip trailing /api if present for Socket.IO origin
    const socketOrigin = rawApiUrl ? rawApiUrl.replace(/\/api\/?$/, '') : window.location.origin;

    socketInstance = io(socketOrigin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
};

export const joinSocketRoom = (room: 'kitchen' | 'floor' | 'pos'): void => {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit('join:room', room);
  } else {
    socket.once('connect', () => {
      socket.emit('join:room', room);
    });
  }
};

export const leaveSocketRoom = (room: 'kitchen' | 'floor' | 'pos'): void => {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit('leave:room', room);
  }
};
