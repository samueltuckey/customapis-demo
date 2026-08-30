/**
 * What `npx pgrm check` and `npx pgrm docs` load.
 *
 * The CLI expects a default-exported factory returning the framework with its routes
 * registered but NOT booted — it boots it itself, against Sequelize metadata only, with
 * no database connection. That is why model and route validation is a fast local command
 * rather than something you discover at deploy time.
 *
 * The framework itself is built in `src/server.ts`, which is where it belongs: one
 * definition, used by the CLI, the server and the test harnesses alike.
 */

import type { PgrmFramework } from 'pgrm';
import { buildFramework } from './src/server.js';

export default (): PgrmFramework => buildFramework();
