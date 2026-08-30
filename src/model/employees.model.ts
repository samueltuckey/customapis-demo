import { DataTypes, type Sequelize, type Model, type ModelStatic } from 'sequelize';
import { dbDefault } from 'pgrm';

/**
 * `employees` — GENERATED from the database by `pgrm generate models`.
 * Regenerated output; do not hand-edit (§14.3) — customization lives in routes/hooks.
 */
export function defineEmployees(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "employees",
    {
      id: { field: "id", type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      department_id: { field: "department_id", type: DataTypes.BIGINT, allowNull: false },
      full_name: { field: "full_name", type: DataTypes.TEXT, allowNull: false },
      email: { field: "email", type: DataTypes.TEXT, allowNull: false },
      user_id: { field: "user_id", type: DataTypes.BIGINT, allowNull: true },
      created_by_id: { field: "created_by_id", type: DataTypes.BIGINT, allowNull: true },
      created_by_display_name: dbDefault({ field: "created_by_display_name", type: DataTypes.TEXT, allowNull: false }, {"expression":"'System'::text","kind":"literal","literal":"System"}),
      created_at: dbDefault({ field: "created_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
      last_updated_by_id: { field: "last_updated_by_id", type: DataTypes.BIGINT, allowNull: true },
      last_updated_by_display_name: dbDefault({ field: "last_updated_by_display_name", type: DataTypes.TEXT, allowNull: false }, {"expression":"'System'::text","kind":"literal","literal":"System"}),
      last_updated_at: dbDefault({ field: "last_updated_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
    },
    { tableName: "employees", timestamps: false },
  );
}
