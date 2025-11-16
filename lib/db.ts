import mysql from "mysql2";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type MysqlError = NodeJS.ErrnoException & { fatal?: boolean };

let pool: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

async function resetPool() {
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      console.warn("[db] failed to close pool during reset", error);
    }
    pool = null;
  }
  schemaReadyPromise = null;
}

function createPool(): Pool {
  const url = getDatabaseUrl();
  const basePool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  basePool.on("error", (error: MysqlError) => {
    console.error("[db] pool error", error);
    if (error?.code === "PROTOCOL_CONNECTION_LOST" || error?.code === "ECONNRESET" || error?.fatal) {
      void resetPool();
    }
  });

  pool = basePool.promise();
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    return createPool();
  }
  return pool;
}

function isRecoverableError(error: MysqlError | undefined) {
  if (!error) {
    return false;
  }
  const recoverableCodes = new Set([
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
    "ECONNRESET",
    "ER_CLIENT_INTERACTION_TIMEOUT",
  ]);
  return recoverableCodes.has(error.code ?? "") || /packets out of order/i.test(error.message ?? "");
}

async function getConnectionWithRetry(attempt = 0): Promise<PoolConnection> {
  try {
    return await getPool().getConnection();
  } catch (rawError) {
    const error = rawError as MysqlError;
    if (attempt === 0 && isRecoverableError(error)) {
      console.warn("[db] retrying connection after error", error);
      await resetPool();
      return getConnectionWithRetry(attempt + 1);
    }
    throw error;
  }
}

async function runWithRetry<T>(operation: (pool: Pool) => Promise<T>, attempt = 0): Promise<T> {
  const currentPool = getPool();
  try {
    return await operation(currentPool);
  } catch (rawError) {
    const error = rawError as MysqlError;
    if (attempt === 0 && isRecoverableError(error)) {
      console.warn("[db] retrying query after connection error", error);
      await resetPool();
      return runWithRetry(operation, attempt + 1);
    }
    throw error;
  }
}

export async function runQuery<T>(operation: (pool: Pool) => Promise<T>): Promise<T> {
  return runWithRetry(operation);
}

async function getConnection(): Promise<PoolConnection> {
  return getConnectionWithRetry();
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const connection = await getConnection();
      try {
        await ensureSchema(connection);
      } finally {
        connection.release();
      }
    })();
  }
  await schemaReadyPromise;
}

export async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
  await ensureDatabaseSchema();
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type { PoolConnection, ResultSetHeader, RowDataPacket };

async function ensureSchema(connection: PoolConnection) {
  await connection.query("SET NAMES utf8mb4");
  await connection.query(
    `CREATE TABLE IF NOT EXISTS Project (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      tagline TEXT NULL,
      location TEXT NULL,
      year TEXT NULL,
      area TEXT NULL,
      scope TEXT NULL,
      intro TEXT NULL,
      heroImageUrl TEXT NULL,
      \`order\` INT NOT NULL DEFAULT 0,
      categories JSON NULL,
      content JSON NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY Project_slug_key (slug),
      KEY Project_order_idx (\`order\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ProjectMedia (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      projectId INT UNSIGNED NOT NULL,
      url TEXT NOT NULL,
      caption TEXT NULL,
      kind ENUM('FEATURE','GALLERY','SCHEME') NOT NULL DEFAULT 'GALLERY',
      \`order\` INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ProjectMedia_projectId_idx (projectId),
      KEY ProjectMedia_project_order_idx (projectId, \`order\`),
      CONSTRAINT ProjectMedia_projectId_fkey FOREIGN KEY (projectId)
        REFERENCES Project(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ProjectScheme (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      projectId INT UNSIGNED NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      \`order\` INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ProjectScheme_projectId_idx (projectId),
      KEY ProjectScheme_project_order_idx (projectId, \`order\`),
      CONSTRAINT ProjectScheme_projectId_fkey FOREIGN KEY (projectId)
        REFERENCES Project(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS AdminUser (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      login VARCHAR(191) NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY AdminUser_login_key (login)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS AdminSession (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      userId INT UNSIGNED NOT NULL,
      token CHAR(64) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY AdminSession_token_key (token),
      KEY AdminSession_user_idx (userId),
      CONSTRAINT AdminSession_user_fkey FOREIGN KEY (userId)
        REFERENCES AdminUser(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS MediaAsset (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      url TEXT NOT NULL,
      title VARCHAR(255) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY MediaAsset_createdAt_idx (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS PageSeo (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(191) NOT NULL,
      title VARCHAR(255) NULL,
      description TEXT NULL,
      keywords JSON NULL,
      ogImageUrl TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY PageSeo_slug_key (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS SiteSetting (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`key\` VARCHAR(191) NOT NULL,
      value JSON NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY SiteSetting_key_unique (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS TeamMember (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      role TEXT NULL,
      label TEXT NULL,
      imageUrl TEXT NULL,
      mobileImageUrl TEXT NULL,
      isFeatured TINYINT(1) NOT NULL DEFAULT 0,
      \`order\` INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY TeamMember_order_idx (\`order\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS GlobalBlock (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(191) NOT NULL,
      data JSON NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY GlobalBlock_slug_unique (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}
