import { ensureDatabaseSchema, ResultSetHeader, RowDataPacket, withTransaction } from "./db";
import type { TeamMember } from "@/types/site";

export type TeamMemberRecord = TeamMember & {
  createdAt: Date;
  updatedAt: Date;
};

type TeamMemberRow = RowDataPacket & {
  id: number;
  name: string;
  role: string | null;
  label: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  isFeatured: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: TeamMemberRow): TeamMemberRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    label: row.label,
    imageUrl: row.imageUrl,
    mobileImageUrl: row.mobileImageUrl,
    isFeatured: Boolean(row.isFeatured),
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function fetchAllTeamMembers(): Promise<TeamMemberRecord[]> {
  await ensureDatabaseSchema();
  const [rows] = await withTransaction((connection) =>
    connection.query<TeamMemberRow[]>("SELECT * FROM TeamMember ORDER BY `order` ASC, id ASC"),
  );
  return rows.map(mapRow);
}

export type TeamMemberInput = {
  name: string;
  role?: string | null;
  label?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  isFeatured?: boolean;
  order?: number;
};

export async function createTeamMember(input: TeamMemberInput): Promise<TeamMemberRecord> {
  return withTransaction(async (connection) => {
    await ensureDatabaseSchema();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO TeamMember (name, role, label, imageUrl, mobileImageUrl, isFeatured, \`order\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.role ?? null,
        input.label ?? null,
        input.imageUrl ?? null,
        input.mobileImageUrl ?? null,
        input.isFeatured ? 1 : 0,
        input.order ?? 0,
      ],
    );

    const insertedId = Number(result.insertId);
    const [rows] = await connection.query<TeamMemberRow[]>("SELECT * FROM TeamMember WHERE id = ? LIMIT 1", [insertedId]);
    if (!rows.length) {
      throw new Error("Failed to load team member after insert");
    }
    return mapRow(rows[0]);
  });
}

export async function updateTeamMember(id: number, input: Partial<TeamMemberInput>): Promise<TeamMemberRecord> {
  return withTransaction(async (connection) => {
    await ensureDatabaseSchema();
    const [rows] = await connection.query<TeamMemberRow[]>("SELECT * FROM TeamMember WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) {
      throw new Error("Team member not found");
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      fields.push("name = ?");
      values.push(input.name);
    }
    if (input.role !== undefined) {
      fields.push("role = ?");
      values.push(input.role ?? null);
    }
    if (input.label !== undefined) {
      fields.push("label = ?");
      values.push(input.label ?? null);
    }
    if (input.imageUrl !== undefined) {
      fields.push("imageUrl = ?");
      values.push(input.imageUrl ?? null);
    }
    if (input.mobileImageUrl !== undefined) {
      fields.push("mobileImageUrl = ?");
      values.push(input.mobileImageUrl ?? null);
    }
    if (input.isFeatured !== undefined) {
      fields.push("isFeatured = ?");
      values.push(input.isFeatured ? 1 : 0);
    }
    if (input.order !== undefined) {
      fields.push("`order` = ?");
      values.push(input.order);
    }

    if (fields.length) {
      values.push(id);
      await connection.execute(`UPDATE TeamMember SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const [updatedRows] = await connection.query<TeamMemberRow[]>("SELECT * FROM TeamMember WHERE id = ? LIMIT 1", [id]);
    if (!updatedRows.length) {
      throw new Error("Team member not found after update");
    }
    return mapRow(updatedRows[0]);
  });
}

export async function deleteTeamMember(id: number): Promise<void> {
  await withTransaction(async (connection) => {
    await ensureDatabaseSchema();
    await connection.execute("DELETE FROM TeamMember WHERE id = ?", [id]);
  });
}

export async function reorderTeamMembers(order: number[]): Promise<void> {
  await withTransaction(async (connection) => {
    await ensureDatabaseSchema();
    if (!order.length) {
      await connection.execute("UPDATE TeamMember SET `order` = 0");
      return;
    }
    await Promise.all(
      order.map((memberId, index) =>
        connection.execute("UPDATE TeamMember SET `order` = ? WHERE id = ?", [index, memberId]),
      ),
    );
  });
}

