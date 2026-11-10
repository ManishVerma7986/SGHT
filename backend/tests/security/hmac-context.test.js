const test = require("node:test");
const assert = require("node:assert/strict");

const RUN_ORACLE_INTEGRATION =
    process.env.SHGT_RUN_DEV_ORACLE_INTEGRATION === "1" &&
    process.env.SHGT_DEPLOYMENT_PROFILE === "development";

test("HMAC Oracle context is set, cleared after errors, and isolated", {
    skip: RUN_ORACLE_INTEGRATION
        ? false
        : "Set SHGT_RUN_DEV_ORACLE_INTEGRATION=1 and select the development profile."
}, async () => {
    const {
        initializePool,
        getConnection,
        closePool
    } = require("../../src/config/database");
    const {
        withAuthenticatedConnection
    } = require("../../src/services/authenticated-database.service");

    try {
        await initializePool();

        const authenticatedUserId = await withAuthenticatedConnection(
            21,
            async (connection) => {
                const result = await connection.execute(
                    `SELECT SYS_CONTEXT('SHGT_USER_CONTEXT', 'USER_ID')
                     FROM DUAL`
                );
                return result.rows[0][0];
            }
        );
        assert.equal(String(authenticatedUserId), "21");

        const operationError = new Error("EXPECTED_TEST_ERROR");
        await assert.rejects(
            withAuthenticatedConnection(21, async () => {
                throw operationError;
            }),
            (error) => error === operationError
        );

        const connection = await getConnection();
        try {
            const result = await connection.execute(
                `SELECT SYS_CONTEXT('SHGT_USER_CONTEXT', 'USER_ID')
                 FROM DUAL`
            );
            assert.equal(result.rows[0][0], null);
        } finally {
            await connection.close();
        }
    } finally {
        await closePool();
    }
});
