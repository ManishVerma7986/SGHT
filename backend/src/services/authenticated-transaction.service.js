const {
    withAuthenticatedConnection
} = require("./authenticated-database.service");

function throwTransactionFailures(errors, message) {
    if (errors.length === 1) {
        throw errors[0];
    }

    throw new AggregateError(errors, message, {
        cause: errors[0]
    });
}

function createAuthenticatedTransactionService({
    withConnection = withAuthenticatedConnection
} = {}) {
    function withAuthenticatedRead(userId, callback) {
        return withConnection(userId, callback);
    }

    function withAuthenticatedTransaction(userId, callback) {
        if (typeof callback !== "function") {
            return Promise.reject(
                new Error("Authenticated transaction callback is required.")
            );
        }

        return withConnection(userId, async (connection, control) => {
            let result;

            try {
                result = await callback(connection);
            } catch (operationError) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    control?.discardConnection();
                    throwTransactionFailures(
                        [operationError, rollbackError],
                        "Database operation and transaction rollback both failed."
                    );
                }

                throw operationError;
            }

            try {
                await connection.commit();
            } catch (commitError) {
                control?.discardConnection();

                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    throwTransactionFailures(
                        [commitError, rollbackError],
                        "Transaction commit outcome is uncertain and rollback also failed."
                    );
                }

                throw commitError;
            }

            return result;
        });
    }

    return {
        withAuthenticatedRead,
        withAuthenticatedTransaction
    };
}

const authenticatedTransactionService =
    createAuthenticatedTransactionService();

module.exports = {
    ...authenticatedTransactionService,
    createAuthenticatedTransactionService
};
