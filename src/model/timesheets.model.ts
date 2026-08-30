import { DataTypes, type Sequelize, type Model, type ModelStatic } from 'sequelize';
import { dbDefault } from 'pgrm';

/**
 * `timesheets` — GENERATED from the database by `pgrm generate models`.
 * Regenerated output; do not hand-edit (§14.3) — customization lives in routes/hooks.
 */
export function defineTimesheets(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "timesheets",
    {
      id: { field: "id", type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      employee_id: { field: "employee_id", type: DataTypes.BIGINT, allowNull: false },
      work_date: { field: "work_date", type: DataTypes.DATEONLY, allowNull: false },
      start_at: { field: "start_at", type: DataTypes.DATE, allowNull: false },
      end_at: { field: "end_at", type: DataTypes.DATE, allowNull: false },
      hours: { field: "hours", type: DataTypes.DECIMAL, allowNull: false },
      status: dbDefault({ field: "status", type: DataTypes.TEXT, allowNull: false }, {"expression":"'draft'::text","kind":"literal","literal":"draft"}),
      cost_rate: { field: "cost_rate", type: DataTypes.DECIMAL, allowNull: true },
      note: { field: "note", type: DataTypes.TEXT, allowNull: true },
      owner_id: { field: "owner_id", type: DataTypes.BIGINT, allowNull: true },
      owner_display_name: { field: "owner_display_name", type: DataTypes.TEXT, allowNull: true },
      created_by_id: { field: "created_by_id", type: DataTypes.BIGINT, allowNull: true },
      created_by_display_name: dbDefault({ field: "created_by_display_name", type: DataTypes.TEXT, allowNull: false }, {"expression":"'System'::text","kind":"literal","literal":"System"}),
      created_at: dbDefault({ field: "created_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
      last_updated_by_id: { field: "last_updated_by_id", type: DataTypes.BIGINT, allowNull: true },
      last_updated_by_display_name: dbDefault({ field: "last_updated_by_display_name", type: DataTypes.TEXT, allowNull: false }, {"expression":"'System'::text","kind":"literal","literal":"System"}),
      last_updated_at: dbDefault({ field: "last_updated_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
    },
    { tableName: "timesheets", timestamps: false },
  );
}
