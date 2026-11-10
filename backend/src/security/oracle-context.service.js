
const {
    createHmacAssertion
} = require("./hmac.service");
const {
    getOracleSecurityPackage
} = require("../config/deployment-profile");

async function setOracleUserContext(connection, userId) {
    const assertion = createHmacAssertion(userId);
    const securityPackage = getOracleSecurityPackage();

    await connection.execute(
        `BEGIN
            ${securityPackage}.SET_USER_CONTEXT(
                P_USER_ID         => :userId,
                P_ISSUED_AT_EPOCH => :issuedAtEpoch,
                P_NONCE           => :nonce,
                P_SIGNATURE       => :signature
            );
         END;`,
        {
            userId: assertion.userId,
            issuedAtEpoch: assertion.issuedAtEpoch,
            nonce: assertion.nonce,
            signature: assertion.signature
        }
    );
}

async function clearOracleUserContext(connection) {
    const securityPackage = getOracleSecurityPackage();

    await connection.execute(
        `BEGIN
            ${securityPackage}.CLEAR_USER_CONTEXT;
         END;`
    );
}

module.exports = {
    setOracleUserContext,
    clearOracleUserContext
};
