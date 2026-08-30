import { type Sequelize } from 'sequelize';
import { defineDemo_events } from './demo_events.model.js';
import { defineDepartments } from './departments.model.js';
import { defineEmployees } from './employees.model.js';
import { defineInvoices } from './invoices.model.js';
import { defineLocal_users } from './local_users.model.js';
import { defineLocations } from './locations.model.js';
import { defineOrganisations } from './organisations.model.js';
import { defineTimesheets } from './timesheets.model.js';

/**
 * Define every generated model on `sequelize` and wire associations with the
 * deterministic `table__fkColumn` `as` names pgrm expects (§14.1). Call this in
 * your pgrm.config before createFramework(...).
 */
export function defineModels(sequelize: Sequelize) {
  const demo_events = defineDemo_events(sequelize);
  const departments = defineDepartments(sequelize);
  const employees = defineEmployees(sequelize);
  const invoices = defineInvoices(sequelize);
  const local_users = defineLocal_users(sequelize);
  const locations = defineLocations(sequelize);
  const organisations = defineOrganisations(sequelize);
  const timesheets = defineTimesheets(sequelize);

  // associations (§14.1 deterministic naming)
  departments.belongsTo(locations, { as: "departments__location_id", foreignKey: "location_id", targetKey: "id" });
  locations.hasMany(departments, { as: "departments__location_id", foreignKey: "location_id" });
  employees.belongsTo(departments, { as: "employees__department_id", foreignKey: "department_id", targetKey: "id" });
  departments.hasMany(employees, { as: "employees__department_id", foreignKey: "department_id" });
  employees.belongsTo(local_users, { as: "employees__user_id", foreignKey: "user_id", targetKey: "id" });
  local_users.hasMany(employees, { as: "employees__user_id", foreignKey: "user_id" });
  invoices.belongsTo(departments, { as: "invoices__department_id", foreignKey: "department_id", targetKey: "id" });
  departments.hasMany(invoices, { as: "invoices__department_id", foreignKey: "department_id" });
  locations.belongsTo(organisations, { as: "locations__organisation_id", foreignKey: "organisation_id", targetKey: "id" });
  organisations.hasMany(locations, { as: "locations__organisation_id", foreignKey: "organisation_id" });
  timesheets.belongsTo(employees, { as: "timesheets__employee_id", foreignKey: "employee_id", targetKey: "id" });
  employees.hasMany(timesheets, { as: "timesheets__employee_id", foreignKey: "employee_id" });
  timesheets.belongsTo(local_users, { as: "timesheets__owner_id", foreignKey: "owner_id", targetKey: "id" });
  local_users.hasMany(timesheets, { as: "timesheets__owner_id", foreignKey: "owner_id" });

  return { demo_events, departments, employees, invoices, local_users, locations, organisations, timesheets };
}
