
const {
    connectDB,
    closePool
} = require("../src/config/database");

async function testDatabase() {
    let connection;

    try {
        connection = await connectDB();

        const result = await connection.execute(
            "SELECT USER FROM DUAL"
        );

        console.log("Connected database user:", result.rows[0][0]);
        console.log("SHGT database test passed!");
    } catch (error) {
        console.error("Database test failed:", error.message);
        process.exitCode = 1;
    } finally {
        if (connection) {
            await connection.close();
        }

        await closePool();
    }
}

testDatabase();
