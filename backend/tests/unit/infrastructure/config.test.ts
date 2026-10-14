import path from 'node:path';
import {
  ConfigError,
  DEFAULT_CONTRACT_PATH,
  DEFAULT_STATIC_DIR,
  DevelopmentOnlyError,
  loadConfig,
} from '../../../src/infrastructure/config/config';

const repoRoot = path.resolve(__dirname, '../../../..');
const baseEnv = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };

describe('loadConfig', () => {
  it('fails when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('fails for an invalid BUSINESS_TIME_ZONE', () => {
    expect(() => loadConfig({ ...baseEnv, BUSINESS_TIME_ZONE: 'Mars/Base' })).toThrow(
      /BUSINESS_TIME_ZONE/,
    );
  });

  it('refuses APP_ENV=production with the development-only message', () => {
    expect(() => loadConfig({ ...baseEnv, APP_ENV: 'production' })).toThrow(DevelopmentOnlyError);
    expect(() => loadConfig({ ...baseEnv, APP_ENV: 'production' })).toThrow(
      'This application is development-only (FR-036) and cannot run with APP_ENV=production',
    );
  });

  it('rejects unknown APP_ENV values', () => {
    expect(() => loadConfig({ ...baseEnv, APP_ENV: 'qa' })).toThrow(/APP_ENV/);
  });

  it('applies defaults', () => {
    const config = loadConfig(baseEnv);
    expect(config).toMatchObject({
      appEnv: 'development',
      port: 3000,
      businessTimeZone: 'UTC',
      logLevel: 'info',
      swaggerEnabled: true,
    });
  });

  it('defaults CONTRACT_PATH and STATIC_DIR to repository paths resolved from the module, not cwd', () => {
    const config = loadConfig(baseEnv);
    expect(DEFAULT_CONTRACT_PATH).toBe(path.join(repoRoot, 'packages/api-contract/openapi.yaml'));
    expect(DEFAULT_STATIC_DIR).toBe(path.join(repoRoot, 'frontend/dist'));
    expect(config.contractPath).toBe(DEFAULT_CONTRACT_PATH);
    expect(config.staticDir).toBe(DEFAULT_STATIC_DIR);
  });

  it('accepts explicit CONTRACT_PATH and STATIC_DIR overrides', () => {
    const staticDir = path.join(repoRoot, 'somewhere/else');
    const config = loadConfig({
      ...baseEnv,
      CONTRACT_PATH: DEFAULT_CONTRACT_PATH,
      STATIC_DIR: staticDir,
    });
    expect(config.staticDir).toBe(staticDir);
  });

  it('fails fast when CONTRACT_PATH does not exist', () => {
    expect(() => loadConfig({ ...baseEnv, CONTRACT_PATH: '/nope/openapi.yaml' })).toThrow(
      /CONTRACT_PATH/,
    );
  });

  it('parses SWAGGER_ENABLED and rejects invalid values', () => {
    expect(loadConfig({ ...baseEnv, SWAGGER_ENABLED: 'false' }).swaggerEnabled).toBe(false);
    expect(() => loadConfig({ ...baseEnv, SWAGGER_ENABLED: 'maybe' })).toThrow(/SWAGGER_ENABLED/);
  });
});
