const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getConfigurationDiagnostic,
    logConfigurationDiagnostic
} = require("../../src/config/configuration-diagnostic.service");

const DEVELOPMENT_KEY = "ab".repeat(32);

function createDevelopmentEnvironment(overrides = {}) {
    return {
        SHGT_DEPLOYMENT_PROFILE: "development",
        SHGT_BACKEND_HMAC_KEY: DEVELOPMENT_KEY,
        DB_USER: "SHGT_DEV_RUNTIME",
        DB_PASSWORD: "development-password-secret",
        DB_CONNECT_STRING: "development-connection-secret",
        DB_WALLET_LOCATION: "development-wallet-path-secret",
        DB_WALLET_PASSWORD: "development-wallet-password-secret",
        PRIVY_APP_ID: "development-privy-id-secret",
        PRIVY_APP_SECRET: "development-privy-secret",
        ...overrides
    };
}

test("development diagnostic reports only allowlisted configuration fields", () => {
    const diagnostic = getConfigurationDiagnostic({
        env: createDevelopmentEnvironment({ PORT: "5001" }),
        port: "5001"
    });

    assert.deepEqual(diagnostic, {
        deploymentProfile: "development",
        environmentFile: ".env.development",
        oracleUsername: "SHGT_DEV_RUNTIME",
        securityPackage: "SHGT_DEV.SHGT_SECURITY_PKG",
        hmacValidation: "PASS",
        configuredServerPort: "5001"
    });
});

test("unapproved Oracle usernames are never included in diagnostic output", () => {
    const diagnostic = getConfigurationDiagnostic({
        env: createDevelopmentEnvironment({
            DB_USER: "unexpected-user-secret"
        })
    });

    assert.equal(diagnostic.oracleUsername, "NOT_ALLOWLISTED");
    assert.equal(
        JSON.stringify(diagnostic).includes("unexpected-user-secret"),
        false
    );
});

test("development diagnostic fails HMAC status without exposing key material", () => {
    const malformedKey = "malformed-development-key-secret";
    const diagnostic = getConfigurationDiagnostic({
        env: createDevelopmentEnvironment({
            SHGT_BACKEND_HMAC_KEY: malformedKey
        })
    });

    assert.equal(diagnostic.hmacValidation, "FAIL");
    assert.equal(JSON.stringify(diagnostic).includes(malformedKey), false);
});

test("production diagnostic omits detailed fields and all environment secrets", () => {
    const secrets = [
        "production-password-secret",
        "production-connection-secret",
        "production-wallet-path-secret",
        "production-wallet-password-secret",
        "production-privy-secret",
        "production-hmac-secret"
    ];
    const env = {
        SHGT_DEPLOYMENT_PROFILE: "production",
        DB_USER: "SHGT_RUNTIME",
        DB_PASSWORD: secrets[0],
        DB_CONNECT_STRING: secrets[1],
        DB_WALLET_LOCATION: secrets[2],
        DB_WALLET_PASSWORD: secrets[3],
        PRIVY_APP_SECRET: secrets[4],
        SHGT_BACKEND_HMAC_KEY: secrets[5]
    };
    const logs = [];
    const logger = {
        info(...args) {
            logs.push(args.join(" "));
        }
    };

    const diagnostic = logConfigurationDiagnostic({ env }, logger);
    const output = logs.join("\n");

    assert.deepEqual(diagnostic, {
        deploymentProfile: "production",
        detailedDiagnostic: "disabled"
    });
    for (const secret of secrets) {
        assert.equal(output.includes(secret), false);
    }
    assert.equal(output.includes("SHGT_RUNTIME"), false);
    assert.equal(output.includes("SHGT_APP.SHGT_SECURITY_PKG"), false);
    assert.equal(output.includes(".env"), false);
});

test("production profile mapping is reported without enabling details", () => {
    const diagnostic = getConfigurationDiagnostic({
        env: { SHGT_DEPLOYMENT_PROFILE: "production" }
    });

    assert.equal(diagnostic.deploymentProfile, "production");
    assert.equal(diagnostic.detailedDiagnostic, "disabled");
});
