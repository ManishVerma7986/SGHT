const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const {
    getDeploymentProfile
} = require("./deployment-profile");
const {
    validateHmacKey
} = require("../security/hmac.service");

const DEVELOPMENT_REQUIRED_VARIABLES = Object.freeze([
    "DB_USER",
    "DB_PASSWORD",
    "DB_CONNECT_STRING",
    "DB_WALLET_LOCATION",
    "DB_WALLET_PASSWORD",
    "PRIVY_APP_ID",
    "PRIVY_APP_SECRET",
    "SHGT_BACKEND_HMAC_KEY"
]);

let processEnvironmentLoaded = false;

function readEnvironmentFile(filePath) {
    return dotenv.parse(fs.readFileSync(filePath, "utf8"));
}

function loadDeploymentEnvironment({
    env = process.env,
    backendDirectory = path.resolve(__dirname, "..", ".."),
    readFile = readEnvironmentFile,
    requiredVariables = DEVELOPMENT_REQUIRED_VARIABLES
} = {}) {
    if (env === process.env && processEnvironmentLoaded) {
        return getDeploymentProfile(env);
    }

    const profile = getDeploymentProfile(env);
    const fileName = profile === "development"
        ? ".env.development"
        : ".env";
    const filePath = path.resolve(backendDirectory, fileName);

    let fileEnvironment;

    try {
        fileEnvironment = readFile(filePath);
    } catch {
        throw new Error(
            `Unable to load the ${profile} backend environment configuration.`
        );
    }

    if (profile === "development") {
        const missingVariables = requiredVariables.filter(
            (name) => typeof fileEnvironment[name] !== "string" ||
                fileEnvironment[name].trim() === ""
        );

        if (missingVariables.length > 0) {
            throw new Error(
                "Development environment configuration is incomplete."
            );
        }

        for (const [name, value] of Object.entries(fileEnvironment)) {
            if (name !== "SHGT_DEPLOYMENT_PROFILE") {
                env[name] = value;
            }
        }

        validateHmacKey(env.SHGT_BACKEND_HMAC_KEY);
    } else {
        for (const [name, value] of Object.entries(fileEnvironment)) {
            if (env[name] === undefined) {
                env[name] = value;
            }
        }
    }

    env.SHGT_DEPLOYMENT_PROFILE = profile;

    if (env === process.env) {
        processEnvironmentLoaded = true;
    }

    return profile;
}

module.exports = {
    DEVELOPMENT_REQUIRED_VARIABLES,
    loadDeploymentEnvironment
};
