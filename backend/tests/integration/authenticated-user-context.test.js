
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    initializePool,
    getConnection,
    closePool
} = require("../../src/config/database");

const requireShgtUser = require("../../src/middleware/requireShgtUser");

const {
    withAuthenticatedConnection
} = require("../../src/services/authenticated-database.service");
const {
    withAuthenticatedRead,
    withAuthenticatedTransaction
} = require("../../src/services/authenticated-transaction.service");

test("Active SHGT identity receives and clears Oracle context", async () => {
    let connection;

    try {
        await initializePool();

        // Find an existing active account for integration testing.
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT PRIVY_USER_ID
             FROM SHGT_APP.USERS
             WHERE ACCOUNT_STATUS = 'ACTIVE'
               AND PRIVY_USER_ID IS NOT NULL
               AND ROWNUM = 1`
        );

        await connection.close();
        connection = null;

        assert.ok(
            result.rows.length > 0,
            "An active registered SHGT test account is required."
        );

        const privyUserId = result.rows[0][0];

        // Simulate the verified identity supplied by Privy middleware.
        const req = {
            privyUserId
        };

        const res = {
            statusCode: null,
            body: null,

            status(code) {
                this.statusCode = code;
                return this;
            },

            json(data) {
                this.body = data;
                return this;
            }
        };

        let nextCalled = false;

        await requireShgtUser(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.ok(req.shgtUser.userId > 0);

        console.log("SHGT identity authorization passed.");

        // Establish HMAC-verified Oracle user context.
        const authenticatedUserId = await withAuthenticatedConnection(
            req.shgtUser.userId,
            async (authenticatedConnection) => {
                const contextResult = await authenticatedConnection.execute(
                    `SELECT SYS_CONTEXT(
                        'SHGT_USER_CONTEXT',
                        'USER_ID'
                     )
                     FROM DUAL`
                );

                return contextResult.rows[0][0];
            }
        );

        assert.equal(
            String(authenticatedUserId),
            String(req.shgtUser.userId)
        );

        const readUserId = await withAuthenticatedRead(
            req.shgtUser.userId,
            async (authenticatedConnection) => {
                const contextResult = await authenticatedConnection.execute(
                    `SELECT SYS_CONTEXT(
                        'SHGT_USER_CONTEXT',
                        'USER_ID'
                     )
                     FROM DUAL`
                );

                return contextResult.rows[0][0];
            }
        );

        assert.equal(String(readUserId), String(req.shgtUser.userId));

        const committedUserId = await withAuthenticatedTransaction(
            req.shgtUser.userId,
            async (authenticatedConnection) => {
                const contextResult = await authenticatedConnection.execute(
                    `SELECT SYS_CONTEXT(
                        'SHGT_USER_CONTEXT',
                        'USER_ID'
                     )
                     FROM DUAL`
                );

                return contextResult.rows[0][0];
            }
        );

        assert.equal(
            String(committedUserId),
            String(req.shgtUser.userId)
        );

        console.log("Oracle authenticated context passed.");

        // Verify the pooled connection has no remaining user context.
        connection = await getConnection();

        const cleanupResult = await connection.execute(
            `SELECT SYS_CONTEXT(
                'SHGT_USER_CONTEXT',
                'USER_ID'
             )
             FROM DUAL`
        );

        assert.equal(cleanupResult.rows[0][0], null);

        console.log("Oracle context cleanup passed.");
        console.log("Full SHGT-to-Oracle integration test passed.");

    } finally {
        if (connection) {
            await connection.close();
        }

        await closePool();
    }
});
