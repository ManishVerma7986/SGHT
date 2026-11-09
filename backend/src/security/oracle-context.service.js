
const {
    createHmacAssertion
} = require("./hmac.service");

async function setOracleUserContext(connection, userId) {
    const assertion = createHmacAssertion(userId);

    await connection.execute(
        `BEGIN
            SHGT_APP.SHGT_SECURITY_PKG.SET_USER_CONTEXT(
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
    await connection.execute(
        `BEGIN
            SHGT_APP.SHGT_SECURITY_PKG.CLEAR_USER_CONTEXT;
         END;`
    );
}

module.exports = {
    setOracleUserContext,
    clearOracleUserContext
};
