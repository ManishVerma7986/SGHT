function listen(app, port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port);

        const handleError = (error) => {
            server.removeListener("listening", handleListening);
            reject(error);
        };

        const handleListening = () => {
            server.removeListener("error", handleError);
            resolve(server);
        };

        server.once("error", handleError);
        server.once("listening", handleListening);
    });
}

function closeHttpServer(server, timeoutMs, logger) {
    if (!server) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        let settled = false;

        const finish = (error) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);

            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        const timeout = setTimeout(() => {
            logger.warn(
                "HTTP shutdown deadline reached. Closing remaining connections."
            );

            try {
                server.closeAllConnections();
            } catch (error) {
                finish(error);
            }
        }, timeoutMs);

        timeout.unref?.();

        try {
            server.close(finish);
            server.closeIdleConnections?.();
        } catch (error) {
            finish(error);
        }
    });
}

function createServerLifecycle({
    app,
    initializePool,
    closePool,
    port,
    shutdownTimeoutMs = 30_000,
    logger = console
}) {
    let server;
    let startupPromise;
    let shutdownPromise;
    let shuttingDown = false;

    function start() {
        if (startupPromise) {
            return startupPromise;
        }

        if (shuttingDown) {
            return Promise.resolve(null);
        }

        startupPromise = (async () => {
            await initializePool();

            if (shuttingDown) {
                return null;
            }

            server = await listen(app, port);
            server.on("error", (error) => {
                logger.error("HTTP server error:", error.message);
            });

            const address = server.address();
            const listeningPort =
                address && typeof address === "object"
                    ? address.port
                    : port;

            logger.log(
                `SHGT Backend running on http://localhost:${listeningPort}`
            );

            return server;
        })();

        return startupPromise;
    }

    function shutdown(signal) {
        if (shutdownPromise) {
            return shutdownPromise;
        }

        shuttingDown = true;

        shutdownPromise = (async () => {
            logger.log(`\n${signal} received. Shutting down SHGT...`);

            let exitCode = 0;

            if (startupPromise) {
                try {
                    await startupPromise;
                } catch (error) {
                    exitCode = 1;
                    logger.error(
                        "SHGT startup failed:",
                        error.message
                    );
                }
            }

            if (server) {
                const activeServer = server;
                server = undefined;

                try {
                    await closeHttpServer(
                        activeServer,
                        shutdownTimeoutMs,
                        logger
                    );
                    logger.log("HTTP server stopped.");
                } catch (error) {
                    exitCode = 1;
                    logger.error(
                        "HTTP server shutdown failed:",
                        error.message
                    );
                }
            }

            try {
                await closePool();
                logger.log("Oracle connection pool closed.");
            } catch (error) {
                exitCode = 1;
                logger.error(
                    "Oracle pool shutdown failed:",
                    error.message
                );
            }

            logger.log("SHGT shutdown completed.");

            return exitCode;
        })();

        return shutdownPromise;
    }

    return {
        start,
        shutdown
    };
}

module.exports = {
    createServerLifecycle
};
