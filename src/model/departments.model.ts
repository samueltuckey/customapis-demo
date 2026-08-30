import { DataTypes, type Sequelize, type Model, type ModelStatic } from 'sequelize';
import { dbDefault } from 'pgrm';

/**
 * `departments` — GENERATED from the database by `pgrm generate models`.
 * Regenerated output; do not hand-edit (§14.3) — customization lives in routes/hooks.
 */
export function defineDepartments(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "departments",
    {
      id: { field: "id", type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      location_id: { field: "location_id", type: DataTypes.BIGINT, allowNull: false },
      name: { field: "name", type: DataTypes.TEXT, allowNull: false },
      created_by_id: { field: "created_by_id", type: DataTypes.BIGINT, allowNull: true },
      created_by_display_name: dbDefault({ field: "created_by_display_name", type: DataTypes.TEXT, allowNull: false }, {"expression":"'System'::text","kind":"literal","literal":"System"}),
      created_at: dbDefault({ field: "created_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
      last_updated_by_id: { field: "last_updated_by_id", type: DataTypes.BIGINT, allowNull: true },
      last_updated_by_display_name: dbDefault({ field: "last_updated_by_display_name", type: DataTypes.TEXT, allowNull: false }, {"expression":"'System'::text","kind":"literal","literal":"System"}),
      last_updated_at: dbDefault({ field: "last_updated_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
    },
    { tableName: "departments", timestamps: false },
  );
}
