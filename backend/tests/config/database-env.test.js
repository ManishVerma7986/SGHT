const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const os = require("node:os");

const databaseConfigPath = require.resolve(
    "../../src/config/database"
);

test("loads backend environment independently of the working directory", () => {
    const child = spawnSync(
        process.execPath,
        [
            "-e",
            [
                "delete process.env.DB_WALLET_LOCATION;",
                "console.log = () => {};",
                `require(${JSON.stringify(databaseConfigPath)});`,
                "process.stdout.write(" +
                    "process.env.DB_WALLET_LOCATION ? 'SET' : 'NOT SET'" +
                    ");"
            ].join("")
        ],
        {
            cwd: os.tmpdir(),
            encoding: "utf8"
        }
    );

    assert.equal(child.status, 0, "database configuration should load");
    assert.equal(child.stdout, "SET");
});

test("preserves an existing environment variable over the env file", () => {
    const child = spawnSync(
        process.execPath,
        [
            "-e",
            [
                "process.env.DB_WALLET_LOCATION = 'preserved-test-value';",
                "console.log = () => {};",
                `require(${JSON.stringify(databaseConfigPath)});`,
                "process.stdout.write(" +
                    "process.env.DB_WALLET_LOCATION === " +
                    "'preserved-test-value' ? 'PRESERVED' : 'REPLACED'" +
                    ");"
            ].join("")
        ],
        {
            cwd: os.tmpdir(),
            encoding: "utf8"
        }
    );

    assert.equal(child.status, 0, "database configuration should load");
    assert.equal(child.stdout, "PRESERVED");
});
