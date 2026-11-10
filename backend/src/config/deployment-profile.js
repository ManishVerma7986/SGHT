const ORACLE_SECURITY_PACKAGES = Object.freeze({
    production: "SHGT_APP.SHGT_SECURITY_PKG",
    development: "SHGT_DEV.SHGT_SECURITY_PKG"
});

const ORACLE_USERS_TABLES = Object.freeze({
    production: "SHGT_APP.USERS",
    development: "SHGT_DEV.USERS"
});

function getDeploymentProfile(env = process.env) {
    const profile = env.SHGT_DEPLOYMENT_PROFILE ?? "production";

    if (!Object.hasOwn(ORACLE_SECURITY_PACKAGES, profile)) {
        throw new Error(
            "SHGT_DEPLOYMENT_PROFILE must be production or development."
        );
    }

    return profile;
}

function getOracleSecurityPackage(env = process.env) {
    return ORACLE_SECURITY_PACKAGES[getDeploymentProfile(env)];
}

function getOracleUsersTable(env = process.env) {
    return ORACLE_USERS_TABLES[getDeploymentProfile(env)];
}

module.exports = {
    getDeploymentProfile,
    getOracleSecurityPackage,
    getOracleUsersTable
};
