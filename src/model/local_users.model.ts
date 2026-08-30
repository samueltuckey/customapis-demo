import { DataTypes, type Sequelize, type Model, type ModelStatic } from 'sequelize';

/**
 * `local_users` — GENERATED from the database by `pgrm generate models`.
 * Regenerated output; do not hand-edit (§14.3) — customization lives in routes/hooks.
 */
export function defineLocal_users(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "local_users",
    {
      id: { field: "id", type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      display_name: { field: "display_name", type: DataTypes.TEXT, allowNull: false },
      persona: { field: "persona", type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: "local_users", timestamps: false },
  );
}
