import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { realtimeService } from '../modules/realtime/realtime.service';

export const initSocket = (server: HttpServer): SocketIOServer => {
  return realtimeService.init(server);
};

export const getIO = (): SocketIOServer | null => {
  return realtimeService.getIO();
};

export { realtimeService };
