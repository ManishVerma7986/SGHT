const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createAuthenticatedDatabaseService
} = require("../../src/services/authenticated-database.service");

function createHarness({
    setError,
    clearError,
    closeError,
    discardError
} = {}) {
    const calls = [];
    const closeArguments = [];
    const connection = {
        async close(options) {
            closeArguments.push(Array.from(arguments));
            calls.push(options?.drop ? "discard" : "release");

            if (options?.drop && discardError) {
                throw discardError;
            }

            if (!options?.drop && closeError) {
                throw closeError;
            }
        }
    };

    const service = createAuthenticatedDatabaseService({
        getConnection: async () => {
            calls.push("acquire");
            return connection;
        },
        setOracleUserContext: async () => {
            calls.push("set-context");

            if (setError) {
                throw setError;
            }
        },
        clearOracleUserContext: async () => {
            calls.push("clear-context");

            if (clearError) {
                throw clearError;
            }
        }
    });

    return {
        calls,
        closeArguments,
        connection,
        ...service
    };
}

test("sets and clears context before releasing a successful connection", async () => {
    const harness = createHarness();
    const result = await harness.withAuthenticatedConnection(
        42,
        async (connection) => {
            assert.equal(connection, harness.connection);
            return "complete";
        }
    );

    assert.equal(result, "complete");
    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "clear-context",
        "release"
    ]);
    assert.deepEqual(harness.closeArguments, [[]]);
});

test("preserves an operation failure and still clears the context", async () => {
    const harness = createHarness();
    const operationError = new Error("operation failed");

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async () => {
            throw operationError;
        }),
        (error) => error === operationError
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "clear-context",
        "release"
    ]);
});

test("preserves both context cleanup and connection discard failures", async () => {
    const cleanupError = new Error("context cleanup failed");
    const discardError = new Error("connection discard failed");
    const harness = createHarness({
        clearError: cleanupError,
        discardError
    });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async () => "unused"),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [cleanupError, discardError]);
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "clear-context",
        "discard"
    ]);
});

test("preserves operation and cleanup errors and discards the connection", async () => {
    const operationError = new Error("operation failed");
    const cleanupError = new Error("context cleanup failed");
    const harness = createHarness({
        clearError: cleanupError
    });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async () => {
            throw operationError;
        }),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [operationError, cleanupError]);
            return true;
        }
    );

    assert.equal(harness.calls.at(-1), "discard");
});

test("discards after a callback requests discard and context cleanup succeeds", async () => {
    const harness = createHarness();

    await harness.withAuthenticatedConnection(42, async (connection, control) => {
        assert.equal(connection, harness.connection);
        control.discardConnection();
    });

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "clear-context",
        "discard"
    ]);
});

test("discards after a request even when context cleanup fails", async () => {
    const cleanupError = new Error("context cleanup failed");
    const harness = createHarness({ clearError: cleanupError });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async (_connection, control) => {
            control.discardConnection();
        }),
        (error) => error === cleanupError
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "clear-context",
        "discard"
    ]);
});

test("preserves operation and discard errors when discard was requested", async () => {
    const operationError = new Error("operation failed");
    const discardError = new Error("connection discard failed");
    const harness = createHarness({ discardError });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async (_connection, control) => {
            control.discardConnection();
            throw operationError;
        }),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [operationError, discardError]);
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "clear-context",
        "discard"
    ]);
});

test("discards a connection when context setup fails", async () => {
    const setupError = new Error("context setup failed");
    const harness = createHarness({ setError: setupError });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async () => "unused"),
        (error) => error === setupError
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "discard"
    ]);
    assert.deepEqual(harness.closeArguments, [[{ drop: true }]]);
});

test("preserves context setup and discard errors", async () => {
    const setupError = new Error("context setup failed");
    const discardError = new Error("connection discard failed");
    const harness = createHarness({
        setError: setupError,
        discardError
    });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async () => "unused"),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [setupError, discardError]);
            return true;
        }
    );

    assert.deepEqual(harness.calls, [
        "acquire",
        "set-context",
        "discard"
    ]);
    assert.deepEqual(harness.closeArguments, [[{ drop: true }]]);
});

test("preserves connection release and discard errors", async () => {
    const releaseError = new Error("connection release failed");
    const discardError = new Error("connection discard failed");
    const harness = createHarness({
        closeError: releaseError,
        discardError
    });

    await assert.rejects(
        harness.withAuthenticatedConnection(42, async () => "complete"),
        (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [releaseError, discardError]);
            return true;
        }
    );
});

test("rejects nested authenticated operations before acquiring another connection", async () => {
    const harness = createHarness();
    let nestedError;

    await harness.withAuthenticatedConnection(42, async () => {
        try {
            await harness.withAuthenticatedConnection(42, async () => {});
        } catch (error) {
            nestedError = error;
        }
    });

    assert.match(nestedError.message, /Nested authenticated database operations/);
    assert.equal(
        harness.calls.filter((call) => call === "acquire").length,
        1
    );
});

test("allows independent authenticated operations to run concurrently", async () => {
    let nextConnection = 0;
    const calls = [];
    const service = createAuthenticatedDatabaseService({
        getConnection: async () => {
            const connectionId = ++nextConnection;
            calls.push(`acquire-${connectionId}`);
            return {
                async close() {
                    calls.push(`release-${connectionId}`);
                }
            };
        },
        setOracleUserContext: async (connection) => {
            calls.push(`set-${nextConnection}`);
        },
        clearOracleUserContext: async (connection) => {
            calls.push("clear");
        }
    });

    const results = await Promise.all([
        service.withAuthenticatedConnection(1, async () => "first"),
        service.withAuthenticatedConnection(2, async () => "second")
    ]);

    assert.deepEqual(results, ["first", "second"]);
    assert.equal(calls.filter((call) => call.startsWith("acquire-")).length, 2);
    assert.equal(calls.filter((call) => call.startsWith("release-")).length, 2);
});
