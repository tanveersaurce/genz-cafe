import path from 'path';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { menuRoutes } from './modules/menu/menu.routes';
import { publicMenuRoutes } from './modules/menu/publicMenu.routes';
import { tableRoutes } from './modules/tables/table.routes';
import { reservationRoutes } from './modules/reservations/reservation.routes';
import { publicReservationRoutes } from './modules/reservations/publicReservation.routes';
import { orderRoutes } from './modules/orders/order.routes';
import { posRoutes } from './modules/orders/pos.routes';
import { billRoutes } from './modules/orders/bill.routes';
import { paymentRoutes } from './modules/orders/payment.routes';
import { kitchenRoutes } from './modules/kitchen/kitchen.routes';
import { approvalRoutes } from './modules/approvals/approval.routes';
import { deviceRoutes } from './modules/devices/device.routes';
import { cashRoutes } from './modules/cash/cash.routes';
import { closingRoutes } from './modules/closing/closing.routes';
import { auditViewerRoutes } from './modules/audit/auditViewer.routes';
import { expenseRoutes } from './modules/expenses/expense.routes';
import { pnlRoutes } from './modules/finance/pnl.routes';
import { partnerRoutes } from './modules/partners/partner.routes';
import { statementRoutes } from './modules/finance/statement.routes';
import { publicQrRoutes } from './modules/orders/publicQr.routes';
import { settingRoutes } from './modules/settings/setting.routes';

export const createApp = (): Express => {
  const app = express();

  // 1. Security Headers (allow cross-origin for static uploaded images, Google Maps embeds, and WebSockets)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'http:', 'https:'],
          // Allow WebSocket connections to our own origin and ws/wss
          'connect-src': ["'self'", 'ws:', 'wss:', ...env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter((o) => o !== '*')],
        },
      },
    })
  );

  // 2. CORS allow-list configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Request Logging
  app.use(requestLogger);

  // 5. Rate Limiting on API routes
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    },
  });
  app.use('/api', apiLimiter);

  // 6. Static Uploads
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), 'uploads'), {
      maxAge: '1d',
      immutable: true,
    })
  );

  // 7. Health Check Endpoint
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // 8. Feature Routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/menu', menuRoutes);
  app.use('/api/public/menu', publicMenuRoutes);
  app.use('/api/tables', tableRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/public/reservations', publicReservationRoutes);
  app.use('/api/pos', posRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/bills', billRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/kitchen', kitchenRoutes);
  app.use('/api/approvals', approvalRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/cash-movements', cashRoutes);
  app.use('/api/closing', closingRoutes);
  app.use('/api/audit', auditViewerRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/finance', pnlRoutes);
  app.use('/api/partners', partnerRoutes);
  app.use('/api/statements', statementRoutes);
  app.use('/api/public/qr', publicQrRoutes);
  app.use('/api/settings', settingRoutes);

  // 9. Route 404 Handler
  app.use(notFoundHandler);

  // 10. Central Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
