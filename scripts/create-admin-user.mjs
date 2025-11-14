import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const part = argv[index];
    if (part.startsWith("--")) {
      const key = part.slice(2);
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        args[key] = value;
        index += 1;
      } else {
        args[key] = "";
      }
    }
  }
  return args;
}

function loadEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    return lines.reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }
      const [key, ...rest] = trimmed.split("=");
      if (!key) {
        return acc;
      }
      let value = rest.join("=").trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      acc[key.trim()] = value;
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback[name];
  if (!value) {
    console.error(`Переменная ${name} не найдена. Укажите её в .env.local или окружении.`);
    process.exit(1);
  }
  return value;
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const database = parsed.pathname.replace(/^\//, "");
    if (!database) {
      throw new Error("Database name missing in DATABASE_URL");
    }
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username ?? ""),
      password: decodeURIComponent(parsed.password ?? ""),
      database,
    };
  } catch (error) {
    console.error("Не удалось разобрать DATABASE_URL", error.message);
    process.exit(1);
  }
}

async function ensureTables(connection) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS AdminUser (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      login VARCHAR(191) NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY AdminUser_login_key (login)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.execute(
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
}

async function main() {
  const args = parseArgs(process.argv);
  const login = args.login ?? args.user;
  const password = args.password;

  if (!login || !password) {
    console.log("Использование: npm run create-admin -- --login <логин> --password <пароль>");
    process.exit(1);
  }

  const envFromFile = loadEnv(path.join(process.cwd(), ".env.local"));
  const databaseUrl = requireEnv("DATABASE_URL", envFromFile);
  const connectionOptions = parseDatabaseUrl(databaseUrl);

  const pool = await mysql.createPool({
    ...connectionOptions,
    waitForConnections: true,
    connectionLimit: 5,
  });
  const connection = await pool.getConnection();

  try {
    await ensureTables(connection);

    const [existing] = await connection.query(`SELECT id FROM AdminUser WHERE login = ? LIMIT 1`, [login]);
    if (Array.isArray(existing) && existing.length) {
      console.error("Пользователь с таким логином уже существует.");
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute("INSERT INTO AdminUser (login, passwordHash) VALUES (?, ?)", [login, passwordHash]);

    console.log(`Администратор ${login} успешно создан.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Не удалось создать администратора", error);
  process.exit(1);
});
