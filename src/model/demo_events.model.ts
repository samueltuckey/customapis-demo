import { DataTypes, type Sequelize, type Model, type ModelStatic } from 'sequelize';
import { dbDefault } from 'pgrm';

/**
 * `demo_events` — GENERATED from the database by `pgrm generate models`.
 * Regenerated output; do not hand-edit (§14.3) — customization lives in routes/hooks.
 */
export function defineDemo_events(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "demo_events",
    {
      id: { field: "id", type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      event_type: { field: "event_type", type: DataTypes.TEXT, allowNull: false },
      model: { field: "model", type: DataTypes.TEXT, allowNull: false },
      tenant_id: { field: "tenant_id", type: DataTypes.BIGINT, allowNull: true },
      object_data: { field: "object_data", type: DataTypes.JSONB, allowNull: false },
      correlation_id: { field: "correlation_id", type: DataTypes.TEXT, allowNull: true },
      emitted_at: dbDefault({ field: "emitted_at", type: DataTypes.DATE, allowNull: false }, {"expression":"now()","kind":"now"}),
    },
    { tableName: "demo_events", timestamps: false },
  );
}
