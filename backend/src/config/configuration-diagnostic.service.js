const {
    getDeploymentProfile,
    getOracleSecurityPackage
} = require("./deployment-profile");
const {
    validateHmacKey
} = require("../security/hmac.service");

const ALLOWED_ORACLE_USERS = new Set([
    "SHGT_DEV_RUNTIME",
    "SHGT_RUNTIME"
]);

function getConfigurationDiagnostic({
    env = process.env,
    port = env.PORT || 5000
} = {}) {
    const deploymentProfile = getDeploymentProfile(env);

    if (deploymentProfile === "production") {
        return {
            deploymentProfile,
            detailedDiagnostic: "disabled"
        };
    }

    let hmacValidation = "PASS";

    try {
        validateHmacKey(env.SHGT_BACKEND_HMAC_KEY);
    } catch {
        hmacValidation = "FAIL";
    }

    return {
        deploymentProfile,
        environmentFile: ".env.development",
        oracleUsername: ALLOWED_ORACLE_USERS.has(env.DB_USER)
            ? env.DB_USER
            : "NOT_ALLOWLISTED",
        securityPackage: getOracleSecurityPackage(env),
        hmacValidation,
        configuredServerPort: String(port)
    };
}

function logConfigurationDiagnostic(options = {}, logger = console) {
    const diagnostic = getConfigurationDiagnostic(options);

    logger.info(
        "SHGT configuration diagnostic:",
        JSON.stringify(diagnostic)
    );

    return diagnostic;
}

module.exports = {
    getConfigurationDiagnostic,
    logConfigurationDiagnostic
};
