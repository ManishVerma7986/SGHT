
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { createAuthRouter } = require("../../src/routes/auth.routes");

const PRIVY_USER_ID = "did:privy:test-user";

function createMockConnection(scenario) {
    const calls = {
        select: 0,
        register: 0,
        commit: 0,
        rollback: 0,
        close: 0
    };

    const connection = {
        async execute(sql) {
            if (sql.includes("SELECT USER_ID, ACCOUNT_STATUS")) {
                calls.select++;

                if (
                    scenario === "duplicate-privy" &&
                    calls.select === 2
                ) {
                    return {
                        rows: [[123, "ACTIVE"]]
                    };
                }

                return { rows: [] };
            }

            if (sql.includes("AUTH_REGISTRATION_PKG.REGISTER_MEMBER")) {
                calls.register++;

                if (scenario === "duplicate-phone") {
                    const error = new Error(
                        "ORA-00001: unique constraint (SHGT_APP.UQ_MEMBER_PHONE) violated"
                    );
                    error.errorNum = 1;
                    throw error;
                }

                if (scenario === "duplicate-privy") {
                    const error = new Error(
                        "ORA-00001: unique constraint (SHGT_APP.UQ_USERS_PRIVY) violated"
                    );
                    error.errorNum = 1;
                    throw error;
                }

                if (scenario === "database-failure") {
                    const error = new Error("Simulated database failure");
                    error.errorNum = 20001;
                    throw error;
                }

                return {
                    outBinds: {
                        userId: 456
                    }
                };
            }

            throw new Error("Unexpected SQL execution in test.");
        },

        async commit() {
            calls.commit++;
        },

        async rollback() {
            calls.rollback++;
        },

        async close() {
            calls.close++;
        }
    };

    return { connection, calls };
}

async function runRegistrationTest(scenario, requestBody) {
    const { connection, calls } = createMockConnection(scenario);

    const app = express();

    app.use(express.json());

    const mockPrivyAuth = (req, res, next) => {
        req.privyUserId = PRIVY_USER_ID;
        next();
    };

    app.use(
        "/api/v1/auth",
        createAuthRouter({
            getConnection: async () => connection,
            requirePrivyAuth: mockPrivyAuth
        })
    );

    const server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    try {
        const address = server.address();

        const response = await fetch(
            `http://127.0.0.1:${address.port}/api/v1/auth/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            }
        );

        const body = await response.json();

        return {
            status: response.status,
            body,
            calls
        };

    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
}

const validRegistration = {
    fullName: "Test Member",
    phoneNumber: "+919876543210",
    email: "test@example.com"
};

test("Successfully registers a new member", async () => {
    const result = await runRegistrationTest(
        "success",
        validRegistration
    );

    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.registered, true);
    assert.equal(result.body.userId, 456);

    assert.equal(result.calls.register, 1);
    assert.equal(result.calls.commit, 1);
    assert.equal(result.calls.rollback, 0);
    assert.equal(result.calls.close, 1);
});

test("Returns 409 for an already registered phone number", async () => {
    const result = await runRegistrationTest(
        "duplicate-phone",
        validRegistration
    );

    assert.equal(result.status, 409);
    assert.equal(
        result.body.code,
        "PHONE_NUMBER_ALREADY_REGISTERED"
    );

    assert.equal(result.calls.rollback, 1);
    assert.equal(result.calls.commit, 0);
    assert.equal(result.calls.close, 1);
});

test("Recovers an existing account after a duplicate Privy identity", async () => {
    const result = await runRegistrationTest(
        "duplicate-privy",
        validRegistration
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.registered, true);
    assert.equal(result.body.userId, 123);
    assert.equal(result.body.accountStatus, "ACTIVE");

    assert.equal(result.calls.rollback, 1);
    assert.equal(result.calls.commit, 0);
    assert.equal(result.calls.close, 1);
});

test("Returns 500 and rolls back after a database failure", async () => {
    const result = await runRegistrationTest(
        "database-failure",
        validRegistration
    );

    assert.equal(result.status, 500);
    assert.equal(result.body.success, false);

    assert.equal(result.calls.rollback, 1);
    assert.equal(result.calls.commit, 0);
    assert.equal(result.calls.close, 1);
});

test("Rejects an invalid full name before opening a database connection", async () => {
    const result = await runRegistrationTest(
        "success",
        {
            ...validRegistration,
            fullName: "A"
        }
    );

    assert.equal(result.status, 400);
    assert.equal(result.calls.select, 0);
    assert.equal(result.calls.register, 0);
    assert.equal(result.calls.close, 0);
});
