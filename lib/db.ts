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
  // Reduce connect timeout to fail faster (30 seconds instead of 60)
  const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT ?? 30000); // 30 секунд по умолчанию
  // Reduce pool size to avoid exceeding max_user_connections limit
  // Default to 5 connections instead of 10 to stay within limits
  const connectionLimit = Number(process.env.DB_POOL_SIZE ?? 5);
  const basePool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout,
    // Idle timeout to close unused connections after 30 seconds
    idleTimeout: 30000,
  });

  basePool.on("error", (error: MysqlError) => {
    console.error("[db] pool error", error);
    if (
      error?.code === "PROTOCOL_CONNECTION_LOST" ||
      error?.code === "ECONNRESET" ||
      error?.code === "ETIMEDOUT" ||
      error?.code === "ENOTFOUND" ||
      error?.fatal
    ) {
      console.warn("[db] resetting pool due to error:", error.code);
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
    "ETIMEDOUT",
    "ENOTFOUND",
    // Too many connections - can be retried after waiting
    "ER_TOO_MANY_USER_CONNECTIONS",
  ]);
  const errorMessage = error.message ?? "";
  const errorCode = error.code ?? "";
  const errorNo = (error as any).errno;
  // Check errno 1203 for ER_TOO_MANY_USER_CONNECTIONS
  const isTooManyConnections = errorNo === 1203 || errorCode === "ER_TOO_MANY_USER_CONNECTIONS";
  return (
    recoverableCodes.has(errorCode) ||
    isTooManyConnections ||
    /packets out of order/i.test(errorMessage) ||
    /pool is closed/i.test(errorMessage) ||
    /timeout/i.test(errorMessage) ||
    /timed out/i.test(errorMessage) ||
    /too many.*connection/i.test(errorMessage)
  );
}

async function getConnectionWithRetry(attempt = 0, maxAttempts = 1): Promise<PoolConnection> {
  try {
    const pool = getPool();
    // Add timeout to connection attempt
    const connectionPromise = pool.getConnection();
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout")), 35000); // 35 seconds
    });
    return await Promise.race([connectionPromise, timeout]);
  } catch (rawError) {
    const error = rawError as MysqlError;
    const isTooManyConnections = (error as any).errno === 1203 || error.code === "ER_TOO_MANY_USER_CONNECTIONS";
    if (attempt < maxAttempts && isRecoverableError(error)) {
      // Wait longer if too many connections (give time for connections to close)
      const waitTime = isTooManyConnections ? 2000 : 1000;
      console.warn(`[db] retrying connection after error (attempt ${attempt + 1}/${maxAttempts + 1})`, error.code || error.message, isTooManyConnections ? "- waiting longer for connections to free up" : "");
      if (isTooManyConnections) {
        // Don't reset pool on too many connections - just wait and retry
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        await resetPool();
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      return getConnectionWithRetry(attempt + 1, maxAttempts);
    }
    console.error("[db] failed to get connection after retries", error);
    throw error;
  }
}

async function runWithRetry<T>(operation: (pool: Pool) => Promise<T>, attempt = 0, maxAttempts = 1): Promise<T> {
  let currentPool = getPool();
  try {
    // Add overall timeout to query execution (45 seconds)
    const operationPromise = operation(currentPool);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Query execution timeout")), 45000);
    });
    return await Promise.race([operationPromise, timeout]);
  } catch (rawError) {
    const error = rawError as MysqlError;
    if (attempt < maxAttempts && isRecoverableError(error)) {
      console.warn(`[db] retrying query after connection error (attempt ${attempt + 1}/${maxAttempts + 1})`, error.code || error.message);
      await resetPool();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retry
      currentPool = getPool();
      return runWithRetry(operation, attempt + 1, maxAttempts);
    }
    console.error("[db] failed to execute query after retries", error);
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
