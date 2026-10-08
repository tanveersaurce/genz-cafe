import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { authService } from '../auth/auth.service';
import { User, IUser } from '../auth/models/User';
import { getRolePermissions } from '../auth/permissions';
import {
  REALTIME_ROOMS,
  RealtimeEventName,
  RealtimeEventPayloadMap,
  RealtimeRoom,
} from '../../config/realtimeEvents';

export interface IRealtimeService {
  init(server: HttpServer): SocketIOServer;
  getIO(): SocketIOServer | null;
  emit<E extends RealtimeEventName>(
    event: E,
    rooms: RealtimeRoom | readonly RealtimeRoom[],
    payload: RealtimeEventPayloadMap[E]
  ): void;
  disconnectUserSockets(userId: string): void;
  close(): Promise<void>;
}

let ioInstance: SocketIOServer | null = null;

export const realtimeService: IRealtimeService = {
  init(server: HttpServer): SocketIOServer {
    const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

    ioInstance = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
          }
        },
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Handshake Authentication Middleware
    ioInstance.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token || typeof token !== 'string') {
          return next(new Error('Authentication error: Missing token'));
        }

        const payload = authService.verifyAccessToken(token);
        const user = await User.findById(payload.userId);
        if (!user || !user.isActive) {
          return next(new Error('Authentication error: User inactive or not found'));
        }

        // Attach verified user to socket data
        socket.data.user = user;
        next();
      } catch (err: unknown) {
        logger.warn({ err }, 'Socket authentication failed');
        next(new Error('Authentication error: Invalid or expired token'));
      }
    });

    // Connection Handler - Assign Rooms strictly by user permissions
    ioInstance.on('connection', (socket) => {
      const user = socket.data.user as IUser | undefined;
      if (!user) {
        socket.disconnect(true);
        return;
      }

      const permissions = getRolePermissions(user.role);

      if (permissions.includes('kitchen:view')) {
        socket.join(REALTIME_ROOMS.KITCHEN);
      }
      if (permissions.includes('orders:read')) {
        socket.join(REALTIME_ROOMS.POS);
      }
      if (permissions.includes('reservations:read')) {
        socket.join(REALTIME_ROOMS.RESERVATIONS);
      }
      if (permissions.includes('menu:read')) {
        socket.join(REALTIME_ROOMS.MENU);
      }

      // Private channel for session/revocation events
      const userRoom: RealtimeRoom = `user:${user._id.toString()}`;
      socket.join(userRoom);

      logger.info(
        {
          socketId: socket.id,
          userId: user._id.toString(),
          role: user.role,
        },
        'Socket connected and rooms assigned'
      );

      // Clients NEVER send custom events to the server; only disconnect is handled
      socket.on('disconnect', (reason) => {
        logger.debug({ socketId: socket.id, reason }, 'Socket disconnected');
      });
    });

    logger.info('🔌 Socket.IO initialized with permission-based room isolation');
    return ioInstance;
  },

  getIO(): SocketIOServer | null {
    return ioInstance;
  },

  emit<E extends RealtimeEventName>(
    event: E,
    rooms: RealtimeRoom | readonly RealtimeRoom[],
    payload: RealtimeEventPayloadMap[E]
  ): void {
    try {
      if (!ioInstance) {
        logger.debug({ event, rooms }, 'realtimeService.emit: Socket.IO not initialized, skipping');
        return;
      }

      const roomList = Array.isArray(rooms) ? rooms : [rooms];
      if (roomList.length === 0) return;

      let broadcaster = ioInstance.to(roomList[0] as string);
      for (let i = 1; i < roomList.length; i++) {
        broadcaster = broadcaster.to(roomList[i] as string);
      }

      broadcaster.emit(event, payload);
      logger.debug({ event, rooms: roomList }, 'Real-time event emitted');
    } catch (err) {
      // Failed emit must NEVER crash or fail the HTTP transaction
      logger.error({ err, event, rooms }, 'Failed to emit real-time event');
    }
  },

  disconnectUserSockets(userId: string): void {
    try {
      if (!ioInstance) return;
      const userRoom = `user:${userId}`;
      ioInstance.to(userRoom).disconnectSockets(true);
      logger.info({ userId }, 'Disconnected all sockets for user');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to disconnect user sockets');
    }
  },

  async close(): Promise<void> {
    if (ioInstance) {
      await new Promise<void>((resolve) => {
        ioInstance!.close(() => resolve());
      });
      ioInstance = null;
    }
  },
};
