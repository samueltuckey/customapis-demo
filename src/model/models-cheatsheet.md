# Generated models — cheatsheet

Association `as` names are deterministic `table__fkColumn` (§14.1) — reference these
exact names in views (`sequelizeIncludeOptions.as`) and hooks.

## demo_events (PK: id)
- DB defaults (optional on create — the database supplies these):
  - `emitted_at` → current server time

## departments (PK: id)
- belongsTo `locations` as `departments__location_id` (fk: location_id)
- hasMany `employees` as `employees__department_id` (fk: department_id)
- hasMany `invoices` as `invoices__department_id` (fk: department_id)
- DB defaults (optional on create — the database supplies these):
  - `created_by_display_name` → "System"
  - `created_at` → current server time
  - `last_updated_by_display_name` → "System"
  - `last_updated_at` → current server time

## employees (PK: id)
- belongsTo `departments` as `employees__department_id` (fk: department_id)
- belongsTo `local_users` as `employees__user_id` (fk: user_id)
- hasMany `timesheets` as `timesheets__employee_id` (fk: employee_id)
- DB defaults (optional on create — the database supplies these):
  - `created_by_display_name` → "System"
  - `created_at` → current server time
  - `last_updated_by_display_name` → "System"
  - `last_updated_at` → current server time

## invoices (PK: id)
- belongsTo `departments` as `invoices__department_id` (fk: department_id)
- DB defaults (optional on create — the database supplies these):
  - `status` → "open"
  - `created_by_display_name` → "System"
  - `created_at` → current server time
  - `last_updated_by_display_name` → "System"
  - `last_updated_at` → current server time

## local_users (PK: id)
- hasMany `employees` as `employees__user_id` (fk: user_id)
- hasMany `timesheets` as `timesheets__owner_id` (fk: owner_id)

## locations (PK: id)
- belongsTo `organisations` as `locations__organisation_id` (fk: organisation_id)
- hasMany `departments` as `departments__location_id` (fk: location_id)
- DB defaults (optional on create — the database supplies these):
  - `created_by_display_name` → "System"
  - `created_at` → current server time
  - `last_updated_by_display_name` → "System"
  - `last_updated_at` → current server time

## organisations (PK: id)
- hasMany `locations` as `locations__organisation_id` (fk: organisation_id)
- DB defaults (optional on create — the database supplies these):
  - `created_by_display_name` → "System"
  - `created_at` → current server time
  - `last_updated_by_display_name` → "System"
  - `last_updated_at` → current server time

## timesheets (PK: id)
- belongsTo `employees` as `timesheets__employee_id` (fk: employee_id)
- belongsTo `local_users` as `timesheets__owner_id` (fk: owner_id)
- DB defaults (optional on create — the database supplies these):
  - `status` → "draft"
  - `created_by_display_name` → "System"
  - `created_at` → current server time
  - `last_updated_by_display_name` → "System"
  - `last_updated_at` → current server time

## Skipped tables (not usable by pgrm — need a single bigint PK, §14.1)
- audit_log: no primary key (§14.1 needs one bigint PK)
