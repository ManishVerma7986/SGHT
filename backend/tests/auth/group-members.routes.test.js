const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const requirePrivyAuth = require("../../src/middleware/requirePrivyAuth");
const {
    createRequireGroupMembership
} = require("../../src/middleware/requireGroupMembership");
const {
    createGroupsRouter
} = require("../../src/routes/groups.routes");

const PRIVY_USER_IDS = {
    active: "did:privy:active-user",
    missing: "did:privy:missing-account",
    inactive: "did:privy:inactive-account"
};
const defaultMembers = [
    {
        fullName: "Member One",
        memberRole: "MEMBER",
        membershipStatus: "ACTIVE",
        joinedDate: "2025-03-10T00:00:00.000Z",
        membershipId: 101,
        userId: 42,
        phoneNumber: "555-0101"
    }
];

function createHarness({
    membership = {
        membershipId: 105,
        groupId: 23,
        memberRole: "MEMBER"
    },
    members = defaultMembers,
    hasMore = false,
    membersError
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

            const userId = token === "missing"
                ? PRIVY_USER_IDS.missing
                : token === "inactive"
                    ? PRIVY_USER_IDS.inactive
                    : PRIVY_USER_IDS.active;
            return { user_id: userId };
        }
    });

    const authenticateInOrder = (req, res, next) => {
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
        if (req.privyUserId === PRIVY_USER_IDS.inactive) {
            return res.status(403).json({
                success: false,
                message: "SHGT account is not active."
            });
        }

        req.shgtUser = { userId: 42 };
        return next();
    };

    const membershipMiddleware = createRequireGroupMembership({
        findMembership: async (userId, groupId) => {
            calls.push({
                operation: "findActiveGroupMembership",
                userId,
                groupId
            });
            return membership;
        }
    });
    const authorizeMembershipInOrder = (req, res, next) => {
        middlewareOrder.push("requireGroupMembership");
        return membershipMiddleware(req, res, next);
    };

    const app = express();
    app.use(
        "/api/v1/groups",
        createGroupsRouter({
            requirePrivyAuth: authenticateInOrder,
            requireShgtUser,
            requireGroupMembership: authorizeMembershipInOrder,
            findGroupMembers: async (userId, groupId, pagination) => {
                calls.push({
                    operation: "findActiveGroupMembers",
                    userId,
                    groupId,
                    pagination
                });
                if (membersError) {
                    throw membersError;
                }
                return {
                    members,
                    pagination: {
                        ...pagination,
                        hasMore
                    }
                };
            }
        })
    );

    return { app, calls, middlewareOrder };
}

async function sendRequest(harness, {
    groupId = "23",
    token = "valid",
    query = "",
    headers = {}
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

        const response = await fetch(
            `http://127.0.0.1:${address.port}/api/v1/groups/${groupId}/members${query}`,
            { headers: requestHeaders }
        );

        return {
            status: response.status,
            body: await response.json()
        };
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

test("returns only approved directory fields to an active member", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        success: true,
        members: [{
            fullName: "Member One",
            memberRole: "MEMBER",
            membershipStatus: "ACTIVE",
            joinedDate: "2025-03-10T00:00:00.000Z"
        }],
        pagination: {
            page: 1,
            limit: 25,
            hasMore: false
        }
    });
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

test("rejects missing and invalid authentication", async () => {
    const missingHarness = createHarness();
    assert.equal(
        (await sendRequest(missingHarness, { token: null })).status,
        401
    );
    assert.deepEqual(missingHarness.middlewareOrder, ["requirePrivyAuth"]);

    const invalidHarness = createHarness();
    assert.equal(
        (await sendRequest(invalidHarness, { token: "invalid" })).status,
        401
    );
    assert.deepEqual(invalidHarness.middlewareOrder, ["requirePrivyAuth"]);
});

test("rejects missing and inactive SHGT accounts", async () => {
    for (const [token, expectedStatus] of [
        ["missing", 404],
        ["inactive", 403]
    ]) {
        const harness = createHarness();
        const response = await sendRequest(harness, { token });

        assert.equal(response.status, expectedStatus);
        assert.deepEqual(harness.middlewareOrder, [
            "requirePrivyAuth",
            "requireShgtUser"
        ]);
        assert.deepEqual(harness.calls, []);
    }
});

test("returns 404 when membership lookup returns null for a nonmember or inactive membership", async () => {
    const harness = createHarness({ membership: null });
    const response = await sendRequest(harness);

    assert.equal(response.status, 404);
    assert.equal(harness.calls.length, 1);
    assert.equal(
        harness.calls.some(
            (call) => call.operation === "findActiveGroupMembers"
        ),
        false
    );
});

test("rejects invalid group IDs", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, { groupId: "invalid" });

    assert.equal(response.status, 400);
    assert.deepEqual(harness.calls, []);
});

test("rejects invalid pagination values", async () => {
    for (const query of [
        "?page=0",
        "?page=-1",
        "?page=1.5",
        "?page=9007199254740992",
        "?page=9007199254740991&limit=100",
        "?limit=0",
        "?limit=-1",
        "?limit=1.5",
        "?limit=101",
        "?limit=9007199254740992"
    ]) {
        const harness = createHarness();
        const response = await sendRequest(harness, { query });

        assert.equal(response.status, 400, query);
        assert.equal(
            harness.calls.some(
                (call) => call.operation === "findActiveGroupMembers"
            ),
            false,
            query
        );
    }
});

test("uses default pagination and enforces the maximum limit", async () => {
    const defaultHarness = createHarness();
    const defaultResponse = await sendRequest(defaultHarness);

    assert.equal(defaultResponse.status, 200);
    assert.deepEqual(
        defaultHarness.calls[1].pagination,
        { page: 1, limit: 25 }
    );

    const maxHarness = createHarness();
    const maxResponse = await sendRequest(maxHarness, {
        query: "?limit=100"
    });

    assert.equal(maxResponse.status, 200);
    assert.deepEqual(maxHarness.calls[1].pagination, { page: 1, limit: 100 });
    assert.deepEqual(maxResponse.body.pagination, {
        page: 1,
        limit: 100,
        hasMore: false
    });
});

test("returns a safe error response when the directory service fails", async () => {
    const harness = createHarness({
        membersError: new Error("Oracle credentials and SQL details")
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 503);
    assert.doesNotMatch(
        JSON.stringify(response.body),
        /Oracle credentials and SQL details/
    );
});

test("frontend-supplied group IDs cannot override the authorized group", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, {
        groupId: "23",
        query: "?groupId=999"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(harness.calls, [
        {
            operation: "findActiveGroupMembership",
            userId: 42,
            groupId: 23
        },
        {
            operation: "findActiveGroupMembers",
            userId: 42,
            groupId: 23,
            pagination: { page: 1, limit: 25 }
        }
    ]);
});

test("reports hasMore from limit plus one service result", async () => {
    const harness = createHarness({ hasMore: true });

    const response = await sendRequest(harness, { query: "?limit=1" });

    assert.equal(response.status, 200);
    assert.equal(response.body.pagination.hasMore, true);
});
