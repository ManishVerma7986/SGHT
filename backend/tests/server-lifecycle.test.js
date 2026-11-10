const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const {
    createServerLifecycle
} = require("../src/services/server-lifecycle.service");

function createLogger() {
    return {
        log() {},
        warn() {},
        error() {}
    };
}

function createServer({ closeAfterForce = false } = {}) {
    const server = new EventEmitter();
    server.closeCalls = 0;
    server.closed = false;
    server.close = (callback) => {
        server.closeCalls += 1;

        if (closeAfterForce) {
            server.finishClose = () => {
                if (!server.closed) {
                    server.closed = true;
                    callback();
                }
            };
        } else {
            setImmediate(() => {
                server.closed = true;
                callback();
            });
        }
    };
    server.closeIdleConnections = () => {
        server.idleConnectionsClosed = true;
    };
    server.closeAllConnections = () => {
        server.forcedClose = true;
        server.finishClose?.();
    };
    server.address = () => ({ port: 5000 });

    return server;
}

function createHarness({
    initializeError,
    closePoolError,
    closeAfterForce,
    shutdownTimeoutMs = 100
} = {}) {
    const calls = [];
    const server = createServer({ closeAfterForce });
    const app = {
        listen() {
            calls.push("listen");
            setImmediate(() => server.emit("listening"));
            return server;
        }
    };

    const lifecycle = createServerLifecycle({
        app,
        initializePool: async () => {
            calls.push("initialize-pool");

            if (initializeError) {
                throw initializeError;
            }
        },
        closePool: async () => {
            calls.push("close-pool");

            if (closePoolError) {
                throw closePoolError;
            }
        },
        port: 5000,
        shutdownTimeoutMs,
        logger: createLogger()
    });

    return {
        calls,
        lifecycle,
        server
    };
}

test("coordinates one startup and drains HTTP before closing the Oracle pool", async () => {
    const harness = createHarness();

    const firstStart = harness.lifecycle.start();
    const secondStart = harness.lifecycle.start();
    assert.equal(await firstStart, harness.server);
    assert.equal(await secondStart, harness.server);

    const firstShutdown = harness.lifecycle.shutdown("SIGTERM");
    const secondShutdown = harness.lifecycle.shutdown("SIGINT");

    assert.equal(firstShutdown, secondShutdown);
    assert.equal(await firstShutdown, 0);
    assert.deepEqual(harness.calls, [
        "initialize-pool",
        "listen",
        "close-pool"
    ]);
    assert.equal(harness.server.closeCalls, 1);
    assert.equal(harness.server.idleConnectionsClosed, true);
    assert.equal(harness.server.closed, true);
});

test("waits for startup to settle before shutting down during pool initialization", async () => {
    let finishInitialization;
    const calls = [];
    const server = createServer();
    const app = {
        listen() {
            calls.push("listen");
            setImmediate(() => server.emit("listening"));
            return server;
        }
    };

    const lifecycle = createServerLifecycle({
        app,
        initializePool: () => new Promise((resolve) => {
            finishInitialization = resolve;
        }),
        closePool: async () => calls.push("close-pool"),
        port: 5000,
        logger: createLogger()
    });

    const startup = lifecycle.start();
    const shutdown = lifecycle.shutdown("SIGTERM");

    finishInitialization();

    assert.equal(await startup, null);
    assert.equal(await shutdown, 0);
    assert.deepEqual(calls, ["close-pool"]);
});

test("cleans up the pool and reports startup failures", async () => {
    const harness = createHarness({
        initializeError: new Error("pool unavailable")
    });

    await assert.rejects(harness.lifecycle.start(), /pool unavailable/);
    assert.equal(await harness.lifecycle.shutdown("STARTUP_FAILURE"), 1);
    assert.deepEqual(harness.calls, [
        "initialize-pool",
        "close-pool"
    ]);
});

test("handles HTTP listen failures and still closes the Oracle pool", async () => {
    const listenError = new Error("port unavailable");
    const calls = [];
    const server = new EventEmitter();

    const lifecycle = createServerLifecycle({
        app: {
            listen() {
                setImmediate(() => server.emit("error", listenError));
                return server;
            }
        },
        initializePool: async () => calls.push("initialize-pool"),
        closePool: async () => calls.push("close-pool"),
        port: 5000,
        logger: createLogger()
    });

    await assert.rejects(
        lifecycle.start(),
        (error) => error === listenError
    );
    assert.equal(await lifecycle.shutdown("STARTUP_FAILURE"), 1);
    assert.deepEqual(calls, ["initialize-pool", "close-pool"]);
});

test("closes remaining HTTP connections after the shutdown deadline", async () => {
    const harness = createHarness({
        closeAfterForce: true,
        shutdownTimeoutMs: 10
    });
    await harness.lifecycle.start();

    assert.equal(await harness.lifecycle.shutdown("SIGTERM"), 0);
    assert.equal(harness.server.forcedClose, true);
    assert.equal(harness.server.closed, true);
});

test("reports pool cleanup failures while still completing shutdown", async () => {
    const harness = createHarness({
        closePoolError: new Error("pool close failed")
    });
    await harness.lifecycle.start();

    assert.equal(await harness.lifecycle.shutdown("SIGTERM"), 1);
    assert.equal(harness.server.closed, true);
    assert.equal(harness.calls.at(-1), "close-pool");
});

test("does not start listening after shutdown is requested during startup", async () => {
    let finishInitialization;
    const calls = [];

    const lifecycle = createServerLifecycle({
        app: {
            listen() {
                calls.push("listen");
                throw new Error("should not listen");
            }
        },
        initializePool: () => new Promise((resolve) => {
            finishInitialization = resolve;
        }),
        closePool: async () => calls.push("close-pool"),
        port: 5000,
        logger: createLogger()
    });

    const startup = lifecycle.start();
    const shutdown = lifecycle.shutdown("SIGTERM");

    finishInitialization();

    assert.equal(await startup, null);
    assert.equal(await shutdown, 0);
    assert.deepEqual(calls, ["close-pool"]);
});
