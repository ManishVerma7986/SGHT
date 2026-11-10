const test = require("node:test");
const assert = require("node:assert/strict");

const {
    DEVELOPMENT_REQUIRED_VARIABLES,
    loadDeploymentEnvironment
} = require("../../src/config/environment");

function makeDevelopmentEnvironment() {
    return {
        ...Object.fromEntries(
            DEVELOPMENT_REQUIRED_VARIABLES.map(
                (name) => [name, `development-${name}`]
            )
        ),
        SHGT_BACKEND_HMAC_KEY: "b".repeat(64)
    };
}

test("production environment keeps existing process-variable precedence", () => {
    const env = {
        SHGT_DEPLOYMENT_PROFILE: "production",
        DB_USER: "externally-supplied-user"
    };
    const readPaths = [];

    const profile = loadDeploymentEnvironment({
        env,
        backendDirectory: "C:\\backend",
        readFile(filePath) {
            readPaths.push(filePath);
            return {
                DB_USER: "file-user",
                DB_CONNECT_STRING: "production-connect"
            };
        }
    });

    assert.equal(profile, "production");
    assert.equal(env.DB_USER, "externally-supplied-user");
    assert.equal(env.DB_CONNECT_STRING, "production-connect");
    assert.equal(env.SHGT_DEPLOYMENT_PROFILE, "production");
    assert.deepEqual(readPaths, ["C:\\backend\\.env"]);
});

test("development loads its separate file and overrides inherited production values", () => {
    const env = {
        SHGT_DEPLOYMENT_PROFILE: "development",
        DB_USER: "production-user",
        DB_PASSWORD: "production-password",
        SHGT_BACKEND_HMAC_KEY: "a".repeat(64)
    };
    const development = {
        ...makeDevelopmentEnvironment(),
        DB_USER: "development-user",
        DB_PASSWORD: "development-password",
        SHGT_BACKEND_HMAC_KEY: "b".repeat(64),
        SHGT_DEPLOYMENT_PROFILE: "production"
    };
    const readPaths = [];

    const profile = loadDeploymentEnvironment({
        env,
        backendDirectory: "C:\\backend",
        readFile(filePath) {
            readPaths.push(filePath);
            return development;
        }
    });

    assert.equal(profile, "development");
    assert.equal(env.DB_USER, "development-user");
    assert.equal(env.DB_PASSWORD, "development-password");
    assert.equal(env.SHGT_BACKEND_HMAC_KEY, "b".repeat(64));
    assert.equal(env.SHGT_DEPLOYMENT_PROFILE, "development");
    assert.deepEqual(readPaths, ["C:\\backend\\.env.development"]);
});

test("development configuration fails closed instead of inheriting production secrets", () => {
    const env = {
        SHGT_DEPLOYMENT_PROFILE: "development",
        ...Object.fromEntries(
            DEVELOPMENT_REQUIRED_VARIABLES.map(
                (name) => [name, "production-value"]
            )
        )
    };
    const incompleteDevelopment = makeDevelopmentEnvironment();
    delete incompleteDevelopment.SHGT_BACKEND_HMAC_KEY;

    assert.throws(
        () => loadDeploymentEnvironment({
            env,
            backendDirectory: "C:\\backend",
            readFile: () => incompleteDevelopment
        }),
        /Development environment configuration is incomplete/
    );
    assert.equal(env.SHGT_BACKEND_HMAC_KEY, "production-value");
});

test("development rejects a malformed key even when inherited config is valid", () => {
    const env = {
        SHGT_DEPLOYMENT_PROFILE: "development",
        ...makeDevelopmentEnvironment(),
        SHGT_BACKEND_HMAC_KEY: "a".repeat(64)
    };
    const development = {
        ...makeDevelopmentEnvironment(),
        SHGT_BACKEND_HMAC_KEY: "malformed"
    };

    assert.throws(
        () => loadDeploymentEnvironment({
            env,
            backendDirectory: "C:\\backend",
            readFile: () => development
        }),
        /Backend HMAC key is missing or invalid/
    );
});

test("Oracle-only development loading does not require Privy settings", () => {
    const development = makeDevelopmentEnvironment();
    delete development.PRIVY_APP_ID;
    delete development.PRIVY_APP_SECRET;
    const env = { SHGT_DEPLOYMENT_PROFILE: "development" };

    const profile = loadDeploymentEnvironment({
        env,
        backendDirectory: "C:\\backend",
        requiredVariables: DEVELOPMENT_REQUIRED_VARIABLES.filter(
            (name) => !name.startsWith("PRIVY_")
        ),
        readFile: () => development
    });

    assert.equal(profile, "development");
    assert.equal(env.SHGT_BACKEND_HMAC_KEY, "b".repeat(64));
    assert.equal("PRIVY_APP_ID" in env, false);
    assert.equal("PRIVY_APP_SECRET" in env, false);
});

test("invalid deployment profile is rejected before loading configuration", () => {
    let fileRead = false;

    assert.throws(
        () => loadDeploymentEnvironment({
            env: { SHGT_DEPLOYMENT_PROFILE: "staging" },
            readFile() {
                fileRead = true;
                return {};
            }
        }),
        /SHGT_DEPLOYMENT_PROFILE must be production or development/
    );
    assert.equal(fileRead, false);
});
