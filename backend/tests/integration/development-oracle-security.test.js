const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createHmacAssertion
} = require("../../src/security/hmac.service");

const OPT_IN = process.env.SHGT_RUN_DEV_ORACLE_INTEGRATION === "1";
const skipReason = OPT_IN
    ? false
    : "Set SHGT_RUN_DEV_ORACLE_INTEGRATION=1 to run against SHGT_DEV.";

test(
    "SHGT development Oracle authentication and connection lifecycle",
    { skip: skipReason },
    async (suite) => {
        assert.equal(
            process.env.SHGT_DEPLOYMENT_PROFILE,
            "development",
            "The integration process must explicitly select development."
        );

        const {
            createDevelopmentOraclePool
        } = require("../support/development-oracle-pool");
        const {
            loadDeploymentEnvironment,
            DEVELOPMENT_REQUIRED_VARIABLES
        } = require("../../src/config/environment");
        const {
            getOracleSecurityPackage
        } = require("../../src/config/deployment-profile");
        const {
            setOracleUserContext,
            clearOracleUserContext
        } = require("../../src/security/oracle-context.service");
        const {
            createAuthenticatedDatabaseService
        } = require("../../src/services/authenticated-database.service");
        const {
            createAuthenticatedTransactionService
        } = require("../../src/services/authenticated-transaction.service");

        loadDeploymentEnvironment({
            requiredVariables: DEVELOPMENT_REQUIRED_VARIABLES.filter(
                (name) => !name.startsWith("PRIVY_")
            )
        });

        const userIds = {
            activeA: readUserId("SHGT_DEV_TEST_USER_1_ID"),
            activeB: readUserId("SHGT_DEV_TEST_USER_2_ID"),
            suspended: readUserId("SHGT_DEV_TEST_USER_3_ID")
        };
        assert.equal(new Set(Object.values(userIds)).size, 3);

        const pool = await createDevelopmentOraclePool();
        const securityPackage = getOracleSecurityPackage();
        const withConnection = createAuthenticatedDatabaseService({
            getConnection: () => pool.getConnection(),
            setOracleUserContext,
            clearOracleUserContext
        }).withAuthenticatedConnection;
        let rollbackCalls = 0;
        const instrumentedWithConnection = (userId, callback) =>
            withConnection(userId, (connection, control) =>
                callback(new Proxy(connection, {
                    get(target, property) {
                        if (property === "rollback") {
                            return async (...args) => {
                                rollbackCalls += 1;
                                return target.rollback(...args);
                            };
                        }

                        const value = target[property];
                        return typeof value === "function"
                            ? value.bind(target)
                            : value;
                    }
                }), control)
            );
        const {
            withAuthenticatedTransaction
        } = createAuthenticatedTransactionService({
            withConnection: instrumentedWithConnection
        });

        try {
            await verifySyntheticUsers(pool, userIds);

            await suite.test("valid assertion sets user 1 context", async () => {
                await assertSetContext(
                    pool,
                    userIds.activeA,
                    securityPackage
                );
            });

            await suite.test("valid assertion sets user 2 context", async () => {
                await assertSetContext(
                    pool,
                    userIds.activeB,
                    securityPackage
                );
            });

            await suite.test("invalid signature is rejected and leaves context empty", async () => {
                const assertion = createAssertion(userIds.activeA);
                assertion.signature = mutateHex(assertion.signature);
                await assertRejectedAuthentication(
                    pool,
                    assertion,
                    20090,
                    securityPackage
                );
            });

            await suite.test("expired timestamp is rejected and leaves context empty", async () => {
                const assertion = createAssertion(userIds.activeA, {
                    issuedAtEpoch: Math.floor(Date.now() / 1000) - 86_400
                });
                await assertRejectedAuthentication(
                    pool,
                    assertion,
                    20086,
                    securityPackage
                );
            });

            await suite.test("future timestamp is rejected and leaves context empty", async () => {
                const assertion = createAssertion(userIds.activeA, {
                    issuedAtEpoch: Math.floor(Date.now() / 1000) + 86_400
                });
                await assertRejectedAuthentication(
                    pool,
                    assertion,
                    20087,
                    securityPackage
                );
            });

            await suite.test("suspended user is rejected and leaves context empty", async () => {
                const assertion = createAssertion(userIds.suspended);
                await assertRejectedAuthentication(
                    pool,
                    assertion,
                    20088,
                    securityPackage
                );
            });

            await suite.test("replayed nonce is rejected and leaves context empty", async () => {
                const assertion = createAssertion(userIds.activeA);
                const connection = await pool.getConnection();

                try {
                    await callSet(connection, assertion, securityPackage);
                    await callClear(connection, securityPackage);
                    assert.equal(await getCurrentUserId(
                        connection,
                        securityPackage
                    ), null);

                    await assertOracleError(
                        20081,
                        () => callSet(connection, assertion, securityPackage)
                    );
                    assert.equal(await getCurrentUserId(
                        connection,
                        securityPackage
                    ), null);
                } finally {
                    await connection.close();
                }
            });

            await suite.test("CLEAR_USER_CONTEXT clears the current identity", async () => {
                const connection = await pool.getConnection();

                try {
                    await callSet(
                        connection,
                        createAssertion(userIds.activeA),
                        securityPackage
                    );
                    assert.equal(
                        await getCurrentUserId(connection, securityPackage),
                        userIds.activeA
                    );

                    await callClear(connection, securityPackage);
                    assert.equal(
                        await getCurrentUserId(connection, securityPackage),
                        null
                    );
                } finally {
                    await connection.close();
                }
            });

            await suite.test("pool reuse clears user A before authenticating user B", async () => {
                const firstSession = await withConnection(
                    userIds.activeA,
                    async (connection) => {
                        assert.equal(
                            await getCurrentUserId(connection, securityPackage),
                            userIds.activeA
                        );
                        return getSessionIdentity(connection);
                    }
                );

                let connection = await pool.getConnection();
                try {
                    assert.equal(
                        await getCurrentUserId(connection, securityPackage),
                        null
                    );
                    assert.deepEqual(
                        await getSessionIdentity(connection),
                        firstSession
                    );
                } finally {
                    await connection.close();
                }

                const secondSession = await withConnection(
                    userIds.activeB,
                    async (authenticatedConnection) => {
                        assert.equal(
                            await getCurrentUserId(
                                authenticatedConnection,
                                securityPackage
                            ),
                            userIds.activeB
                        );
                        return getSessionIdentity(authenticatedConnection);
                    }
                );
                assert.deepEqual(secondSession, firstSession);
            });

            await suite.test("normal transaction failure rolls back, clears context, and reuses the session", async () => {
                const sessionBefore = await withConnection(
                    userIds.activeA,
                    async (connection) => getSessionIdentity(connection)
                );
                const operationError = new Error(
                    "synthetic callback failure"
                );
                const rollbackCountBefore = rollbackCalls;

                await assert.rejects(
                    withAuthenticatedTransaction(
                        userIds.activeB,
                        async (connection) => {
                            assert.equal(
                                await getCurrentUserId(
                                    connection,
                                    securityPackage
                                ),
                                userIds.activeB
                            );
                            throw operationError;
                        }
                    ),
                    (error) => error === operationError
                );
                assert.equal(rollbackCalls, rollbackCountBefore + 1);

                const connection = await pool.getConnection();
                try {
                    assert.equal(
                        await getCurrentUserId(connection, securityPackage),
                        null
                    );
                    assert.deepEqual(
                        await getSessionIdentity(connection),
                        sessionBefore
                    );
                } finally {
                    await connection.close();
                }
            });

            await suite.test("context setup failure discards the unsafe physical session", async () => {
                const beforeConnection = await pool.getConnection();
                let sessionBefore;

                try {
                    sessionBefore = await getUniqueSessionId(beforeConnection);
                    assert.equal(
                        await getCurrentUserId(
                            beforeConnection,
                            securityPackage
                        ),
                        null
                    );
                } finally {
                    await beforeConnection.close();
                }

                await assertOracleError(
                    20088,
                    () => withConnection(
                        userIds.suspended,
                        async () => assert.fail(
                            "Callback must not run for a suspended user."
                        )
                    )
                );

                const afterConnection = await pool.getConnection();
                try {
                    assert.equal(
                        await getCurrentUserId(
                            afterConnection,
                            securityPackage
                        ),
                        null
                    );
                    assert.notEqual(
                        await getUniqueSessionId(afterConnection),
                        sessionBefore,
                        "A setup-failed physical session must not return to the pool."
                    );
                } finally {
                    await afterConnection.close();
                }
            });
        } finally {
            await pool.close(10);
        }
    }
);

function readUserId(name) {
    const value = process.env[name];
    const userId = Number(value);

    if (!/^[1-9]\d*$/.test(value || "") || !Number.isSafeInteger(userId)) {
        throw new Error(
            `Development integration requires a valid ${name} value.`
        );
    }

    return userId;
}

function createAssertion(userId, options = {}) {
    return createHmacAssertion(userId, options);
}

function mutateHex(hex) {
    return `${hex[0] === "A" ? "B" : "A"}${hex.slice(1)}`;
}

async function callSet(connection, assertion, securityPackage) {
    await connection.execute(
        `BEGIN
            ${securityPackage}.SET_USER_CONTEXT(
                P_USER_ID         => :userId,
                P_ISSUED_AT_EPOCH => :issuedAtEpoch,
                P_NONCE           => :nonce,
                P_SIGNATURE       => :signature
            );
         END;`,
        {
            userId: assertion.userId,
            issuedAtEpoch: assertion.issuedAtEpoch,
            nonce: assertion.nonce,
            signature: assertion.signature
        }
    );
}

async function callClear(connection, securityPackage) {
    await connection.execute(
        `BEGIN
            ${securityPackage}.CLEAR_USER_CONTEXT;
         END;`
    );
}

async function getCurrentUserId(connection, securityPackage) {
    const result = await connection.execute(
        `SELECT ${securityPackage}.GET_CURRENT_USER_ID()
         FROM DUAL`
    );

    return result.rows[0][0] === null
        ? null
        : Number(result.rows[0][0]);
}

async function getSessionIdentity(connection) {
    const result = await connection.execute(
        `SELECT SYS_CONTEXT('USERENV', 'SID'),
                SYS_CONTEXT('USERENV', 'SESSIONID')
         FROM DUAL`
    );

    return result.rows[0].map(String);
}

async function verifySyntheticUsers(pool, userIds) {
    const connection = await pool.getConnection();

    try {
        for (const [userId, expectedStatus] of [
            [userIds.activeA, "ACTIVE"],
            [userIds.activeB, "ACTIVE"],
            [userIds.suspended, "SUSPENDED"]
        ]) {
            const result = await connection.execute(
                `SELECT ACCOUNT_STATUS
                 FROM SHGT_DEV.USERS
                 WHERE USER_ID = :userId`,
                { userId }
            );

            assert.equal(result.rows.length, 1);
            assert.equal(result.rows[0][0], expectedStatus);
        }
    } finally {
        await connection.close();
    }
}

async function assertSetContext(pool, userId, securityPackage) {
    const connection = await pool.getConnection();

    try {
        await callSet(
            connection,
            createAssertion(userId),
            securityPackage
        );
        assert.equal(
            await getCurrentUserId(connection, securityPackage),
            userId
        );

        await callClear(connection, securityPackage);
        assert.equal(
            await getCurrentUserId(connection, securityPackage),
            null
        );
    } finally {
        await connection.close();
    }
}

async function assertRejectedAuthentication(
    pool,
    assertion,
    expectedCode,
    securityPackage
) {
    const connection = await pool.getConnection();
    let authenticationError;

    try {
        try {
            await callSet(
                connection,
                assertion,
                securityPackage
            );
        } catch (error) {
            authenticationError = error;
        }

        assert.equal(
            await getCurrentUserId(connection, securityPackage),
            null
        );

        assertOracleErrorResult(authenticationError, expectedCode);
    } finally {
        await connection.close();
    }
}

async function assertOracleError(expectedCode, operation) {
    let caught;

    try {
        await operation();
    } catch (error) {
        caught = error;
    }

    assertOracleErrorResult(caught, expectedCode);
    return caught;
}

function assertOracleErrorResult(error, expectedCode) {
    const diagnostic = formatOracleError(error);
    assert.ok(error, `Expected Oracle error ORA-${expectedCode}; received none.`);

    const errorNumber = Number(error.errorNum);
    const codeMatches = errorNumber === expectedCode ||
        errorNumber === -expectedCode ||
        new RegExp(`ORA-${expectedCode}\\b`).test(error.code || "") ||
        new RegExp(`ORA-${expectedCode}\\b`).test(error.message || "");

    assert.ok(
        codeMatches,
        `Expected Oracle error ORA-${expectedCode}; actual error: ${diagnostic}`
    );
}

function formatOracleError(error) {
    if (!error) {
        return JSON.stringify({
            errorNum: null,
            code: null,
            message: null,
            offset: null
        });
    }

    return JSON.stringify({
        errorNum: error.errorNum ?? null,
        code: error.code ?? null,
        message: redactSensitiveText(error.message ?? ""),
        offset: error.offset ?? null
    });
}

function redactSensitiveText(message) {
    let safeMessage = String(message);

    for (const name of [
        "SHGT_BACKEND_HMAC_KEY",
        "DB_PASSWORD",
        "DB_WALLET_PASSWORD",
        "DB_CONNECT_STRING",
        "DB_WALLET_LOCATION",
        "PRIVY_APP_SECRET",
        "PRIVY_APP_ID"
    ]) {
        const value = process.env[name];
        if (value) {
            safeMessage = safeMessage.split(value).join("[REDACTED]");
        }
    }

    return safeMessage
        .replace(/\b[0-9A-Fa-f]{64}\b/g, "[REDACTED_HEX]")
        .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]");
}

async function getUniqueSessionId(connection) {
    const result = await connection.execute(
        "SELECT DBMS_SESSION.UNIQUE_SESSION_ID() FROM DUAL"
    );

    return String(result.rows[0][0]);
}
