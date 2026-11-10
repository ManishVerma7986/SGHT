const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

const requirePrivyAuth = require("../../src/middleware/requirePrivyAuth");
const {
    createRequireGroupMembership
} = require("../../src/middleware/requireGroupMembership");
const {
    createGroupsRouter
} = require("../../src/routes/groups.routes");

const PRIVY_USER_IDS = {
    valid: "did:privy:member",
    missing: "did:privy:unregistered",
    inactive: "did:privy:inactive"
};

function createHarness({
    accountStatus = "ACTIVE",
    membership = {
        membershipId: 123,
        groupId: 10,
        memberRole: "MEMBER"
    },
    membershipError,
    customGroupMiddleware
} = {}) {
    const calls = [];
    const middlewareOrder = [];

    const authenticate = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async (token) => {
            if (token !== "valid" && token !== "missing" && token !== "inactive") {
                const error = new Error("Invalid token");
                error.name = "InvalidAuthTokenError";
                throw error;
            }

            return { user_id: PRIVY_USER_IDS[token] };
        }
    });

    const requirePrivyAuthForRoute = (req, res, next) => {
        middlewareOrder.push("requirePrivyAuth");
        return authenticate(req, res, next);
    };

    const requireShgtUser = (req, res, next) => {
        middlewareOrder.push("requireShgtUser");

        if (req.privyUserId === PRIVY_USER_IDS.missing) {
            return res.status(404).json({
                success: false,
                message: "SHGT account not found."
            });
        }

        if (
            req.privyUserId === PRIVY_USER_IDS.inactive ||
            accountStatus !== "ACTIVE"
        ) {
            return res.status(403).json({
                success: false,
                message: "SHGT account is not active."
            });
        }

        req.shgtUser = { userId: 42 };
        return next();
    };

    const membershipMiddleware = customGroupMiddleware ||
        createRequireGroupMembership({
            findMembership: async (userId, groupId) => {
                calls.push({
                    operation: "findActiveGroupMembership",
                    userId,
                    groupId
                });

                if (membershipError) {
                    throw membershipError;
                }

                return membership;
            }
        });

    const requireGroupMembershipForRoute = (req, res, next) => {
        middlewareOrder.push("requireGroupMembership");
        return membershipMiddleware(req, res, next);
    };

    const app = express();
    app.use(express.json());
    app.use(
        "/api/v1/groups",
        createGroupsRouter({
            requirePrivyAuth: requirePrivyAuthForRoute,
            requireShgtUser,
            requireGroupMembership: requireGroupMembershipForRoute
        })
    );

    return {
        app,
        calls,
        middlewareOrder
    };
}

async function sendRequest(harness, {
    groupId = "10",
    token = "valid",
    headers = {},
    body,
    query = ""
} = {}) {
    const server = harness.app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    try {
        const address = server.address();
        const requestHeaders = { ...headers };

        if (token !== null) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }

        if (body !== undefined) {
            requestHeaders["Content-Type"] = "application/json";
        }

        const requestBody = body === undefined
            ? undefined
            : JSON.stringify(body);

        return await new Promise((resolve, reject) => {
            const request = http.request({
                hostname: "127.0.0.1",
                port: address.port,
                path: `/api/v1/groups/${groupId}/membership${query}`,
                method: "GET",
                headers: {
                    ...requestHeaders,
                    ...(requestBody === undefined
                        ? {}
                        : {
                            "Content-Type": "application/json",
                            "Content-Length": Buffer.byteLength(requestBody)
                        })
                }
            }, (response) => {
                let responseBody = "";
                response.setEncoding("utf8");
                response.on("data", (chunk) => {
                    responseBody += chunk;
                });
                response.on("end", () => {
                    resolve({
                        status: response.statusCode,
                        body: JSON.parse(responseBody)
                    });
                });
            });

            request.on("error", reject);
            if (requestBody !== undefined) {
                request.write(requestBody);
            }
            request.end();
        });
    } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
}

test("returns only the trusted membership context", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        success: true,
        membership: {
            membershipId: 123,
            groupId: 10,
            memberRole: "MEMBER"
        }
    });
    assert.deepEqual(harness.calls, [{
        operation: "findActiveGroupMembership",
        userId: 42,
        groupId: 10
    }]);
});

test("missing and invalid Privy tokens return 401", async () => {
    const missingTokenHarness = createHarness();
    const missingTokenResponse = await sendRequest(missingTokenHarness, {
        token: null
    });

    assert.equal(missingTokenResponse.status, 401);
    assert.deepEqual(missingTokenHarness.middlewareOrder, [
        "requirePrivyAuth"
    ]);

    const invalidTokenHarness = createHarness();
    const invalidTokenResponse = await sendRequest(invalidTokenHarness, {
        token: "invalid"
    });

    assert.equal(invalidTokenResponse.status, 401);
    assert.deepEqual(invalidTokenHarness.middlewareOrder, [
        "requirePrivyAuth"
    ]);
});

test("a missing SHGT account returns 404", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, { token: "missing" });

    assert.equal(response.status, 404);
    assert.deepEqual(harness.middlewareOrder, [
        "requirePrivyAuth",
        "requireShgtUser"
    ]);
    assert.deepEqual(harness.calls, []);
});

test("an inactive SHGT account returns 403", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, { token: "inactive" });

    assert.equal(response.status, 403);
    assert.deepEqual(harness.middlewareOrder, [
        "requirePrivyAuth",
        "requireShgtUser"
    ]);
    assert.deepEqual(harness.calls, []);
});

test("returns 404 when missing or inactive membership resolves to null", async () => {
    const harness = createHarness({ membership: null });
    const response = await sendRequest(harness);

    assert.equal(response.status, 404);
    assert.equal(harness.calls.length, 1);
});

test("invalid group ID returns 400 without looking up membership", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, { groupId: "invalid" });

    assert.equal(response.status, 400);
    assert.deepEqual(harness.middlewareOrder, [
        "requirePrivyAuth",
        "requireShgtUser",
        "requireGroupMembership"
    ]);
    assert.deepEqual(harness.calls, []);
});

test("membership lookup failure returns 503", async () => {
    const harness = createHarness({
        membershipError: new Error("internal database details")
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(response.body), /internal database details/);
});

test("frontend-supplied user IDs and roles cannot override trusted values", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, {
        headers: {
            "X-User-Id": "999",
            "X-Member-Role": "PRESIDENT"
        },
        body: {
            userId: 999,
            memberRole: "PRESIDENT",
            membershipId: 999
        },
        query: "?userId=888&memberRole=SECRETARY&membershipId=888"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.membership, {
        membershipId: 123,
        groupId: 10,
        memberRole: "MEMBER"
    });
    assert.deepEqual(harness.calls, [{
        operation: "findActiveGroupMembership",
        userId: 42,
        groupId: 10
    }]);
});

test("runs authentication and membership middleware in the required order", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(harness.middlewareOrder, [
        "requirePrivyAuth",
        "requireShgtUser",
        "requireGroupMembership"
    ]);
});

test("performs only the membership lookup and no financial operation", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(harness.calls, [{
        operation: "findActiveGroupMembership",
        userId: 42,
        groupId: 10
    }]);
});
