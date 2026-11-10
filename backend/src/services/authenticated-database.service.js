const { AsyncLocalStorage } = require("node:async_hooks");

const {
    getConnection: defaultGetConnection
} = require("../config/database");

const {
    setOracleUserContext: defaultSetOracleUserContext,
    clearOracleUserContext: defaultClearOracleUserContext
} = require("../security/oracle-context.service");

function throwFailures(errors, message) {
    const flattenedErrors = errors.flatMap((error) =>
        error instanceof AggregateError
            ? [...error.errors]
            : [error]
    );

    if (flattenedErrors.length === 1) {
        throw flattenedErrors[0];
    }

    throw new AggregateError(flattenedErrors, message, {
        cause: flattenedErrors[0]
    });
}

async function discardConnection(connection) {
    try {
        await connection.close({ drop: true });
    } catch (error) {
        return {
            failed: true,
            error
        };
    }

    return {
        failed: false
    };
}

function createAuthenticatedDatabaseService({
    getConnection = defaultGetConnection,
    setOracleUserContext = defaultSetOracleUserContext,
    clearOracleUserContext = defaultClearOracleUserContext
} = {}) {
    const activeConnection = new AsyncLocalStorage();

    async function withAuthenticatedConnection(userId, callback) {
        if (typeof callback !== "function") {
            throw new Error("Authenticated database callback is required.");
        }

        if (activeConnection.getStore()) {
            throw new Error(
                "Nested authenticated database operations are not supported."
            );
        }

        const connection = await getConnection();

        try {
            await setOracleUserContext(connection, userId);
        } catch (setupError) {
            const discardResult = await discardConnection(connection);

            if (discardResult.failed) {
                throwFailures(
                    [setupError, discardResult.error],
                    "Oracle context setup and connection discard both failed."
                );
            }

            throw setupError;
        }

        let result;
        let operationError;
        let operationFailed = false;
        let discardRequested = false;
        const control = {
            discardConnection() {
                discardRequested = true;
            }
        };

        try {
            result = await activeConnection.run(
                connection,
                () => callback(connection, control)
            );
        } catch (error) {
            operationFailed = true;
            operationError = error;
        }

        let cleanupError;
        let cleanupFailed = false;

        try {
            await clearOracleUserContext(connection);
        } catch (error) {
            cleanupFailed = true;
            cleanupError = error;
        }

        if (cleanupFailed || discardRequested) {
            const errors = [];

            if (operationFailed) {
                errors.push(operationError);
            }

            if (cleanupFailed) {
                errors.push(cleanupError);
            }

            const discardResult = await discardConnection(connection);

            if (discardResult.failed) {
                errors.push(discardResult.error);
            }

            if (errors.length === 0) {
                if (operationFailed) {
                    throw operationError;
                }

                return result;
            }

            throwFailures(
                errors,
                "Database operation, Oracle context cleanup, or connection discard failed."
            );
        }

        try {
            await connection.close();
        } catch (releaseError) {
            const errors = [];

            if (operationFailed) {
                errors.push(operationError);
            }

            errors.push(releaseError);

            const discardResult = await discardConnection(connection);

            if (discardResult.failed) {
                errors.push(discardResult.error);
            }

            throwFailures(
                errors,
                "Database operation or connection release failed."
            );
        }

        if (operationFailed) {
            throw operationError;
        }

        return result;
    }

    return {
        withAuthenticatedConnection
    };
}

const authenticatedDatabaseService =
    createAuthenticatedDatabaseService();

module.exports = {
    ...authenticatedDatabaseService,
    createAuthenticatedDatabaseService
};
