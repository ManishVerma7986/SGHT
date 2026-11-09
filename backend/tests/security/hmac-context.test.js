
const {
    initializePool,
    getConnection,
    closePool
} = require("../../src/config/database");

const {
    withAuthenticatedConnection
} = require("../../src/services/authenticated-database.service");

async function testAuthenticatedContext() {
    const result = await withAuthenticatedConnection(
        21,
        async (connection) => {
            const query = await connection.execute(
                `SELECT SYS_CONTEXT('SHGT_USER_CONTEXT', 'USER_ID')
                 FROM DUAL`
            );

            return query.rows[0][0];
        }
    );

    console.log("Authenticated USER_ID:", result);

    if (String(result) !== "21") {
        throw new Error("Incorrect Oracle user context.");
    }
}

async function testContextCleanupAfterFailure() {
    try {
        await withAuthenticatedConnection(21, async () => {
            throw new Error("EXPECTED_TEST_ERROR");
        });

        throw new Error("Expected database operation to fail.");
    } catch (error) {
        if (error.message !== "EXPECTED_TEST_ERROR") {
            throw error;
        }

        console.log("Operation failure handled correctly.");
    }
}

async function testContextIsolation() {
    const connection = await getConnection();

    try {
        const query = await connection.execute(
            `SELECT SYS_CONTEXT('SHGT_USER_CONTEXT', 'USER_ID')
             FROM DUAL`
        );

        const remainingUserId = query.rows[0][0];

        console.log("Context after cleanup:", remainingUserId);

        if (remainingUserId !== null) {
            throw new Error("SECURITY FAILURE: User context remains.");
        }

        console.log("Connection isolation verified.");
    } finally {
        await connection.close();
    }
}

async function main() {
    try {
        await initializePool();

        await testAuthenticatedContext();
        await testContextCleanupAfterFailure();
        await testContextIsolation();

        console.log("All modular HMAC tests passed.");
    } catch (error) {
        console.error("HMAC integration test failed:", error.message);
        process.exitCode = 1;
    } finally {
        await closePool();
    }
}

main();
