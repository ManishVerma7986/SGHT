const path = require("path");
const oracledb = require("oracledb");

const {
    loadDeploymentEnvironment,
    DEVELOPMENT_REQUIRED_VARIABLES
} = require("../../src/config/environment");
const {
    getDeploymentProfile,
    getOracleSecurityPackage
} = require("../../src/config/deployment-profile");
const {
    validateHmacKey
} = require("../../src/security/hmac.service");

async function createDevelopmentOraclePool() {
    if (process.env.SHGT_DEPLOYMENT_PROFILE !== "development") {
        throw new Error(
            "Development Oracle integration requires an explicit development profile."
        );
    }

    loadDeploymentEnvironment({
        requiredVariables: DEVELOPMENT_REQUIRED_VARIABLES.filter(
            (name) => !name.startsWith("PRIVY_")
        )
    });

    if (
        getDeploymentProfile() !== "development" ||
        process.env.DB_USER !== "SHGT_DEV_RUNTIME" ||
        getOracleSecurityPackage() !== "SHGT_DEV.SHGT_SECURITY_PKG"
    ) {
        throw new Error(
            "Development Oracle integration configuration is not isolated."
        );
    }

    validateHmacKey();

    const walletLocation = path.resolve(
        __dirname,
        "..",
        "..",
        process.env.DB_WALLET_LOCATION
    );

    try {
        return await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING,
            configDir: walletLocation,
            walletLocation,
            walletPassword: process.env.DB_WALLET_PASSWORD,
            poolMin: 1,
            poolMax: 1,
            poolIncrement: 1,
            poolTimeout: 60
        });
    } catch {
        throw new Error(
            "Unable to initialize the isolated development Oracle pool."
        );
    }
}

module.exports = {
    createDevelopmentOraclePool
};
