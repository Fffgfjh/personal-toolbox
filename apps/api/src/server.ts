import 'dotenv/config';
import { buildApp } from './app.js';
import { loadApiConfig } from './config.js';

const config = loadApiConfig();
const app = await buildApp({ config, logger: true });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
