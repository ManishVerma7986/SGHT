const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getDeploymentProfile,
    getOracleSecurityPackage
} = require("../../src/config/deployment-profile");

const {
    setOracleUserContext,
    clearOracleUserContext
} = require("../../src/security/oracle-context.service");

const ORIGINAL_PROFILE = process.env.SHGT_DEPLOYMENT_PROFILE;
const ORIGINAL_HMAC_KEY = process.env.SHGT_BACKEND_HMAC_KEY;
const ORIGINAL_PACKAGE_OVERRIDE =
    process.env.SHGT_ORACLE_SECURITY_PACKAGE;

test.after(() => {
    restoreEnvironment("SHGT_DEPLOYMENT_PROFILE", ORIGINAL_PROFILE);
    restoreEnvironment("SHGT_BACKEND_HMAC_KEY", ORIGINAL_HMAC_KEY);
    restoreEnvironment(
        "SHGT_ORACLE_SECURITY_PACKAGE",
        ORIGINAL_PACKAGE_OVERRIDE
    );
});

function restoreEnvironment(name, value) {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

function captureConnection() {
    const calls = [];

    return {
        calls,
        connection: {
            async execute(statement, binds) {
                calls.push({ statement, binds });
            }
        }
    };
}

test("unset deployment profile preserves the production package default", () => {
    delete process.env.SHGT_DEPLOYMENT_PROFILE;

    assert.equal(getDeploymentProfile(), "production");
    assert.equal(
        getOracleSecurityPackage(),
        "SHGT_APP.SHGT_SECURITY_PKG"
    );
});

test("production profile uses the production package for set and clear", async () => {
    process.env.SHGT_DEPLOYMENT_PROFILE = "production";
    process.env.SHGT_BACKEND_HMAC_KEY = "a".repeat(64);

    const { calls, connection } = captureConnection();
    await setOracleUserContext(connection, 1);
    await clearOracleUserContext(connection);

    assert.match(
        calls[0].statement,
        /SHGT_APP\.SHGT_SECURITY_PKG\.SET_USER_CONTEXT/
    );
    assert.match(
        calls[1].statement,
        /SHGT_APP\.SHGT_SECURITY_PKG\.CLEAR_USER_CONTEXT/
    );
});

test("development profile uses only its allowlisted package for set and clear", async () => {
    process.env.SHGT_DEPLOYMENT_PROFILE = "development";
    process.env.SHGT_BACKEND_HMAC_KEY = "b".repeat(64);
    process.env.SHGT_ORACLE_SECURITY_PACKAGE =
        "SHGT_APP.SHGT_SECURITY_PKG";

    assert.equal(
        getOracleSecurityPackage(),
        "SHGT_DEV.SHGT_SECURITY_PKG"
    );

    const { calls, connection } = captureConnection();
    await setOracleUserContext(connection, 1);
    await clearOracleUserContext(connection);

    assert.match(
        calls[0].statement,
        /SHGT_DEV\.SHGT_SECURITY_PKG\.SET_USER_CONTEXT/
    );
    assert.match(
        calls[1].statement,
        /SHGT_DEV\.SHGT_SECURITY_PKG\.CLEAR_USER_CONTEXT/
    );
    assert.doesNotMatch(calls[0].statement, /SHGT_APP/);
    assert.doesNotMatch(calls[1].statement, /SHGT_APP/);
});

test("invalid deployment profiles are rejected", () => {
    for (const profile of ["", "staging", "Production"]) {
        assert.throws(
            () => getOracleSecurityPackage({
                SHGT_DEPLOYMENT_PROFILE: profile
            }),
            /SHGT_DEPLOYMENT_PROFILE must be production or development/
        );
    }
});
