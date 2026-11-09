
const {
    getConnection
} = require("../config/database");

const {
    setOracleUserContext,
    clearOracleUserContext
} = require("../security/oracle-context.service");

async function discardConnection(connection) {
    try {
        await connection.close({ drop: true });
    } catch (error) {
        console.error(
            "Failed to discard Oracle connection:",
            error.message
        );
    }
}

async function withAuthenticatedConnection(userId, callback) {
    if (typeof callback !== "function") {
        throw new Error("Authenticated database callback is required.");
    }

    const connection = await getConnection();

    // Establish context. Discard the connection if setup fails.
    try {
        await setOracleUserContext(connection, userId);
    } catch (error) {
        await discardConnection(connection);
        throw error;
    }

    let result;
    let operationError;

    try {
        result = await callback(connection);
    } catch (error) {
        operationError = error;
    }

    // Always clear the Oracle context before releasing the connection.
    let cleanupError;

    try {
        await clearOracleUserContext(connection);
    } catch (error) {
        cleanupError = error;
    }

    if (cleanupError) {
        await discardConnection(connection);

        if (operationError) {
            throw new AggregateError(
                [operationError, cleanupError],
                "Database operation and Oracle context cleanup both failed."
            );
        }

        throw cleanupError;
    }

    try {
        await connection.close();
    } catch (closeError) {
        if (operationError) {
            throw new AggregateError(
                [operationError, closeError],
                "Database operation and connection release both failed."
            );
        }

        throw closeError;
    }

    if (operationError) {
        throw operationError;
    }

    return result;
}

module.exports = {
    withAuthenticatedConnection
};
