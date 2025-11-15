import { PoolConnection, RowDataPacket, ResultSetHeader, ensureDatabaseSchema, withTransaction, runQuery } from "./db";

export type AdminUserRecord = {
  id: number;
  login: string;
  passwordHash: string;
  createdAt: Date;
};

export type AdminSessionRecord = {
  id: number;
  userId: number;
  token: string;
  createdAt: Date;
  expiresAt: Date;
};

type AdminUserRow = RowDataPacket & {
  id: number;
  login: string;
  passwordHash: string;
  createdAt: Date;
};

type AdminSessionRow = RowDataPacket & {
  id: number;
  userId: number;
  token: string;
  createdAt: Date;
  expiresAt: Date;
};

export async function findAdminUserByLogin(login: string): Promise<AdminUserRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<AdminUserRow[]>("SELECT id, login, passwordHash, createdAt FROM AdminUser WHERE login = ? LIMIT 1", [login]),
  );
  if (!rows.length) {
    return null;
  }
  return mapUser(rows[0]);
}

export async function createAdminUser(login: string, passwordHash: string): Promise<AdminUserRecord> {
  return withTransaction(async (connection) => {
    await ensureSchemaWithinTransaction(connection);
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO AdminUser (login, passwordHash) VALUES (?, ?)",
      [login, passwordHash],
    );
    const id = Number(result.insertId);
    const [rows] = await connection.query<AdminUserRow[]>(
      "SELECT id, login, passwordHash, createdAt FROM AdminUser WHERE id = ?",
      [id],
    );
    if (!rows.length) {
      throw new Error("Failed to load admin user after insert");
    }
    return mapUser(rows[0]);
  });
}

export async function createAdminSession(userId: number, token: string, expiresAt: Date): Promise<void> {
  await ensureDatabaseSchema();
  await runQuery((pool) => pool.execute("INSERT INTO AdminSession (userId, token, expiresAt) VALUES (?, ?, ?)", [userId, token, expiresAt]));
}

export async function getAdminSessionByToken(token: string): Promise<(AdminSessionRecord & { user: AdminUserRecord }) | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<(AdminSessionRow & { login: string; passwordHash: string; userCreatedAt: Date })[]>(
      `SELECT s.id, s.userId, s.token, s.createdAt, s.expiresAt,
              u.login, u.passwordHash, u.createdAt AS userCreatedAt
         FROM AdminSession s
         JOIN AdminUser u ON u.id = s.userId
        WHERE s.token = ?
        LIMIT 1`,
      [token],
    ),
  );
  if (!rows.length) {
    return null;
  }
  const row = rows[0];
  return {
    id: row.id,
    userId: row.userId,
    token: row.token,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      login: row.login,
      passwordHash: row.passwordHash,
      createdAt: row.userCreatedAt,
    },
  };
}

export async function deleteAdminSession(token: string): Promise<void> {
  await ensureDatabaseSchema();
  await runQuery((pool) => pool.execute("DELETE FROM AdminSession WHERE token = ?", [token]));
}

export async function deleteExpiredAdminSessions(): Promise<void> {
  await ensureDatabaseSchema();
  await runQuery((pool) => pool.execute("DELETE FROM AdminSession WHERE expiresAt < NOW()", []));
}

function mapUser(row: AdminUserRow): AdminUserRecord {
  return {
    id: row.id,
    login: row.login,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  };
}

async function ensureSchemaWithinTransaction(connection: PoolConnection) {
  await connection.query("SELECT 1 FROM AdminUser LIMIT 1").catch(async () => {
    await ensureDatabaseSchema();
  });
}
