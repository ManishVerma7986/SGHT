
const test = require("node:test");
const {
    connectDB,
    closePool
} = require("../../src/config/database");

const RUN_ORACLE_INTEGRATION =
    process.env.SHGT_RUN_DEV_ORACLE_INTEGRATION === "1" &&
    process.env.SHGT_DEPLOYMENT_PROFILE === "development";

test("Oracle connection smoke check", {
    skip: RUN_ORACLE_INTEGRATION
        ? false
        : "Set SHGT_RUN_DEV_ORACLE_INTEGRATION=1 and select the development profile."
}, async () => {
    let connection;

    try {
        connection = await connectDB();

        await connection.execute("SELECT 1 FROM DUAL");
    } catch (error) {
        throw new Error("Oracle connection smoke check failed.", {
            cause: error
        });
    } finally {
        if (connection) {
            await connection.close();
        }

        await closePool();
    }
});
