/**
 * The whole timesheet resource — every route on the model, registered from one place.
 *
 * Grouped by MODEL because the resource has facts true of all four routes and of no
 * single one: the 4-hop tenant path, owner scoping, and the cost-rate rule in
 * `./fieldVisibility.ts`. Co-location is legibility, not enforcement — what makes a
 * missing shared rule impossible to ship is the guarantee check run at deploy.
 */

import type { PgrmFramework } from 'pgrm';
import { registerTimesheetCrudRoutes } from './crud.js';
import { registerApproveRoutes } from './approve.js';

export function registerTimesheetRoutes(f: PgrmFramework): void {
  registerTimesheetCrudRoutes(f);
  registerApproveRoutes(f);
}
