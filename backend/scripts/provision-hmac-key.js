
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const oracledb = require("oracledb");
const dotenv = require("dotenv");

const backendDir = path.resolve(__dirname, "..");
const envPath = path.join(backendDir, ".env");
const provisioningPath = path.join(
    backendDir,
    ".env.provisioning"
);

// Load normal DB connection settings and separate admin credentials.
dotenv.config({ path: envPath });
dotenv.config({ path: provisioningPath });

const KEY_NAME = "BACKEND_HMAC";
const ENV_KEY_NAME = "SHGT_BACKEND_HMAC_KEY";

function updateEnvFile(key, value) {
    const original = fs.readFileSync(envPath, "utf8");
    const lines = original.split(/\r?\n/);

    const index = lines.findIndex(line =>
        new RegExp(`^\\s*${key}\\s*=`).test(line)
    );

    if (index >= 0) {
        lines[index] = `${key}=${value}`;
    } else {
        while (lines.length && lines[lines.length - 1] === "") {
            lines.pop();
        }

        lines.push(`${key}=${value}`);
    }

    fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf8");
}

function getConfiguredKey() {
    const value = process.env[ENV_KEY_NAME];

    if (!value) {
        return null;
    }

    if (!/^[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(
            `${ENV_KEY_NAME} must contain exactly 64 hexadecimal characters.`
        );
    }

    return Buffer.from(value, "hex");
}

async function provision() {
    if (!fs.existsSync(envPath)) {
        throw new Error("Backend .env file not found.");
    }

    if (!fs.existsSync(provisioningPath)) {
        throw new Error("Provisioning credentials file not found.");
    }

    const required = [
        "PROVISION_DB_USER",
        "PROVISION_DB_PASSWORD",
        "DB_CONNECT_STRING",
        "DB_WALLET_LOCATION",
        "DB_WALLET_PASSWORD"
    ];

    for (const name of required) {
        if (!process.env[name]) {
            throw new Error(`Missing configuration: ${name}`);
        }
    }

    const walletLocation = path.resolve(
        backendDir,
        process.env.DB_WALLET_LOCATION
    );

    let connection;
    let transactionOpen = false;

    try {
        connection = await oracledb.getConnection({
            user: process.env.PROVISION_DB_USER,
            password: process.env.PROVISION_DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING,
            configDir: walletLocation,
            walletLocation,
            walletPassword: process.env.DB_WALLET_PASSWORD
        });

        // Find an existing active key, if any.
        const existing = await connection.execute(
            `SELECT
                RAWTOHEX(KEY_VALUE),
                CASE
                    WHEN VALID_FROM <= SYSTIMESTAMP
                     AND (
                         VALID_UNTIL IS NULL
                         OR VALID_UNTIL > SYSTIMESTAMP
                     )
                    THEN 1
                    ELSE 0
                END
             FROM SHGT_APP.SHGT_SECURITY_KEYS
             WHERE KEY_NAME = :keyName
               AND KEY_STATUS = 'ACTIVE'`,
            { keyName: KEY_NAME }
        );

        const configuredKey = getConfiguredKey();

        if (existing.rows.length > 0) {
            const databaseHex = existing.rows[0][0].toUpperCase();

            if (!/^[0-9A-F]{64}$/.test(databaseHex)) {
                throw new Error("Existing database key has an unexpected length.");
            }

            if (existing.rows[0][1] !== 1) {
                throw new Error("Existing active key is outside its validity period.");
            }

            const databaseKey = Buffer.from(databaseHex, "hex");

            if (
                configuredKey &&
                !crypto.timingSafeEqual(configuredKey, databaseKey)
            ) {
                throw new Error(
                    "Backend key does not match the active Oracle key. No changes made."
                );
            }

            if (!configuredKey) {
                updateEnvFile(ENV_KEY_NAME, databaseHex);
            }

            console.log("Existing active HMAC key verified.");
            console.log("No database changes required.");
            return;
        }

        // Reuse a previously generated key if a previous attempt
        // wrote it to .env but did not finish the Oracle insert.
        const key = configuredKey || crypto.randomBytes(32);
        const keyHex = key.toString("hex").toUpperCase();

        // Persist the key before inserting it into Oracle.
        // If the process stops after this point, rerunning the
        // script reuses the same key.
        if (!configuredKey) {
            updateEnvFile(ENV_KEY_NAME, keyHex);
        }

        await connection.execute(
            `INSERT INTO SHGT_APP.SHGT_SECURITY_KEYS
                (KEY_NAME, KEY_VALUE)
             VALUES
                (:keyName, :keyValue)`,
            {
                keyName: KEY_NAME,
                keyValue: {
                    val: key,
                    type: oracledb.BUFFER
                }
            },
            { autoCommit: false }
        );

        transactionOpen = true;

        await connection.commit();
        transactionOpen = false;
        const verification = await connection.execute(
            `SELECT RAWTOHEX(KEY_VALUE)
            FROM SHGT_APP.SHGT_SECURITY_KEYS
            WHERE KEY_NAME = :keyName
                AND KEY_STATUS = 'ACTIVE'`,
            { keyName: KEY_NAME }
        );

        if (
            verification.rows.length !== 1 ||
            !crypto.timingSafeEqual(
                Buffer.from(verification.rows[0][0], "hex"),
                key
            )
        ) {
            throw new Error("Oracle key verification failed.");
        }

        console.log("HMAC key successfully provisioned.");
        console.log("Key name: BACKEND_HMAC");
        console.log("Key length: 32 bytes");
        console.log("Secret value was not displayed.");

    } catch (error) {
        if (connection && transactionOpen) {
            try {
                await connection.rollback();
            } catch (_) {
                // Preserve the original error.
            }
        }

        throw error;

    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

provision()
    .catch(error => {
        console.error("HMAC provisioning failed:", error.message);
        process.exitCode = 1;
    });
