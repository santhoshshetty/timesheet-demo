import fs from 'node:fs';
import path from 'node:path';

export type AppEnv = 'development' | 'test' | 'staging';

const APP_ENVS: readonly AppEnv[] = ['development', 'test', 'staging'];
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  appEnv: AppEnv;
  port: number;
  databaseUrl: string;
  businessTimeZone: string;
  logLevel: LogLevel;
  swaggerEnabled: boolean;
  contractPath: string;
  staticDir: string;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export class DevelopmentOnlyError extends ConfigError {
  constructor() {
    super('This application is development-only (FR-036) and cannot run with APP_ENV=production');
  }
}

// src/ and dist/ sit at the same depth, so these defaults work for tsx and compiled output.
const REPO_ROOT = path.resolve(__dirname, '../../../..');
export const DEFAULT_CONTRACT_PATH = path.join(REPO_ROOT, 'packages/api-contract/openapi.yaml');
export const DEFAULT_STATIC_DIR = path.join(REPO_ROOT, 'frontend/dist');

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): AppConfig {
  const appEnv = parseAppEnv(env.APP_ENV);
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new ConfigError('DATABASE_URL is required');
  }

  const contractPath = path.resolve(env.CONTRACT_PATH?.trim() || DEFAULT_CONTRACT_PATH);
  if (!fs.existsSync(contractPath)) {
    throw new ConfigError(`CONTRACT_PATH does not exist: ${contractPath}`);
  }

  return {
    appEnv,
    port: parsePort(env.PORT),
    databaseUrl,
    businessTimeZone: parseTimeZone(env.BUSINESS_TIME_ZONE),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    swaggerEnabled: parseBoolean('SWAGGER_ENABLED', env.SWAGGER_ENABLED, true),
    contractPath,
    staticDir: path.resolve(env.STATIC_DIR?.trim() || DEFAULT_STATIC_DIR),
  };
}

function parseAppEnv(value: string | undefined): AppEnv {
  const appEnv = value?.trim() || 'development';
  if (appEnv === 'production') {
    throw new DevelopmentOnlyError();
  }
  if (!APP_ENVS.includes(appEnv as AppEnv)) {
    throw new ConfigError(`APP_ENV must be one of ${APP_ENVS.join(', ')}`);
  }
  return appEnv as AppEnv;
}

function parsePort(value: string | undefined): number {
  const port = Number(value?.trim() || '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseTimeZone(value: string | undefined): string {
  const timeZone = value?.trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
  } catch {
    throw new ConfigError(`BUSINESS_TIME_ZONE is not a valid IANA time zone: ${timeZone}`);
  }
  return timeZone;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const level = value?.trim() || 'info';
  if (!(LOG_LEVELS as readonly string[]).includes(level)) {
    throw new ConfigError(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}`);
  }
  return level as LogLevel;
}

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  const raw = value?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new ConfigError(`${name} must be "true" or "false"`);
}
