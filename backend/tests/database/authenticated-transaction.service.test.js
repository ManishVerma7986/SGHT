const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createAuthenticatedDatabaseService
} = require("../../src/services/authenticated-database.service");

const {
    createAuthenticatedTransactionService
} = require("../../src/services/authenticated-transaction.service");

function createHarness({
    commitError,
    rollbackError,
    discardError,
    clearError
} = {}) {
    const calls = [];

    const connection = {
        async execute() {
            calls.push("execute");
            return { rows: [[1]] };
        },
        async commit() {
            calls.push("commit");

            if (commitError) {
                throw commitError;
            }
        },
        async rollback() {
            calls.push("rollback");

            if (rollbackError) {
                throw rollbackError;
            }
        },
        async close(options) {
            calls.push(options?.drop ? "discard" : "release");

            if (options?.drop && discardError) {
                throw discardError;
            }
        }
    };

    const databaseService = createAuthenticatedDatabaseService({
        getConnection: async () => {
            calls.push("acquire");
            return connection;
        },
        setOracleUserContext: async () => {
            calls.push("set-context");
        },
        clearOracleUserContext: async () => {
            calls.push("clear-context");

            if (clearError) {
                throw clearError;
            }
        }
    });

    const service = createAuthenticatedTransactionService({
        withConnection: databaseService.withAuthenticatedConnection
    });

    return {
        calls,
        connection,
        ...service
    };
}

test("authenticated reads do not commit or roll back and release normally", async () => {
    const harness = createHarness();

    const result = await harness.withAuthenticatedRead(42, async (connection) => {
        const query = await connection.execute("SELECT 1 FROM DUAL");
        return query.rows[0][0];
    });

    assert.equal(result, 1);
    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "execute",
        "clear-context",
        "release"
    ]);
});

test("commits a successful transaction and releases normally", async () => {
    const harness = createHarness();

    const result = await harness.withAuthenticatedTransaction(
        42,
        async (connection) => {
            await connection.execute("UPDATE example_table SET value = 1");
            return "committed";
        }
    );

    assert.equal(result, "committed");
    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "execute",
        "commit",
        "clear-context",
        "release"
    ]);
});

test("operation failure with successful rollback preserves the error and releases normally", async () => {
    const operationError = new Error("operation failed");
    const harness = createHarness();

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, async () => {
            throw operationError;
        }),
        (error) => error === operationError
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "rollback",
        "clear-context",
        "release"
    ]);
});

test("operation failure with failed rollback discards and preserves both errors", async () => {
    const operationError = new Error("operation failed");
    const rollbackError = new Error("rollback failed");
    const harness = createHarness({ rollbackError });

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, async () => {
            throw operationError;
        }),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [operationError, rollbackError]);
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "rollback",
        "clear-context",
        "discard"
    ]);
});

test("commit failure with successful rollback still discards the connection", async () => {
    const commitError = new Error("commit response lost");
    const harness = createHarness({ commitError });

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, async () => "result"),
        (error) => error === commitError
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "commit",
        "rollback",
        "clear-context",
        "discard"
    ]);
});

test("commit failure with failed rollback discards and preserves both errors", async () => {
    const commitError = new Error("commit response lost");
    const rollbackError = new Error("rollback failed");
    const harness = createHarness({ commitError, rollbackError });

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, async () => "result"),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [commitError, rollbackError]);
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "commit",
        "rollback",
        "clear-context",
        "discard"
    ]);
});

test("discard failure preserves the original transaction and discard errors", async () => {
    const operationError = new Error("operation failed");
    const rollbackError = new Error("rollback failed");
    const discardError = new Error("discard failed");
    const harness = createHarness({
        rollbackError,
        discardError
    });

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, async () => {
            throw operationError;
        }),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(
                error.errors,
                [operationError, rollbackError, discardError]
            );
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "rollback",
        "clear-context",
        "discard"
    ]);
});

test("discards even when context cleanup fails after a transaction requests discard", async () => {
    const commitError = new Error("commit response lost");
    const cleanupError = new Error("context cleanup failed");
    const harness = createHarness({
        commitError,
        clearError: cleanupError
    });

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, async () => "result"),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [commitError, cleanupError]);
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "commit",
        "rollback",
        "clear-context",
        "discard"
    ]);
});

test("rejects a missing transaction callback", async () => {
    const harness = createHarness();

    await assert.rejects(
        harness.withAuthenticatedTransaction(42, null),
        /transaction callback is required/
    );

    assert.deepEqual(harness.calls, []);
});
