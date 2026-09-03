import type { PgrmFramework } from 'pgrm';
import { registerTimesheetRoutes } from './timesheet.js';
import { registerMeRoutes } from './me.js';
import { registerEmployeeRoutes } from './employee.js';
import { registerInvoiceRoutes } from './invoice.js';
import { registerActivityRoutes } from './activity.js';
import { registerKeyRoutes } from '../demo/routes/keys.js';
import { registerEventRoutes } from '../demo/routes/events.js';
import { registerChallengeRoutes } from '../demo/routes/challenges.js';

export function registerRoutes(f: PgrmFramework): void {
  registerTimesheetRoutes(f);
  registerMeRoutes(f);
  registerEmployeeRoutes(f);
  registerInvoiceRoutes(f);
  registerActivityRoutes(f);
  registerKeyRoutes(f);
  registerEventRoutes(f);
  registerChallengeRoutes(f);
}
