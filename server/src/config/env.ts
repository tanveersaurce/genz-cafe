import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/genz_cafe'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Auth Configuration
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z
    .string()
    .default('7')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),

  // Partner Seed Configuration
  SEED_PARTNER_USERNAME: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9._-]+$/, 'Username must be lowercase alphanumeric, ., _, or -')
    .default('partner_admin'),
  SEED_PARTNER_NAME: z.string().min(2).default('Founding Partner'),
  SEED_PARTNER_PASSWORD: z.string().min(8).default('Partner@1234'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
