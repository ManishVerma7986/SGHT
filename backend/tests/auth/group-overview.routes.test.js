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
const overview = {
    groupId: 23,
    groupCode: "GRP-023",
    groupName: "Hillview Group",
    village: "Hillview",
    district: "North District",
    state: "Example State",
    formationDate: "2024-06-15T00:00:00.000Z",
    groupStatus: "ACTIVE",
    pinCode: "123456",
    createdAt: "internal-created",
    updatedAt: "internal-updated"
};

function createHarness({
    membership = {
        membershipId: 105,
        groupId: 23,
        memberRole: "MEMBER"
    },
    groupOverview = overview,
    overviewError,
    invalidToken = false
} = {}) {
    const calls = [];
    const middlewareOrder = [];

    const authenticate = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async (token) => {
            if (invalidToken || token !== "valid") {
                const error = new Error("Invalid token");
                error.name = "InvalidAuthTokenError";
                throw error;
            }

            return { user_id: PRIVY_USER_IDS.active };
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

    const groupMembership = createRequireGroupMembership({
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
        return groupMembership(req, res, next);
    };

    const app = express();
    app.use(
        "/api/v1/groups",
        createGroupsRouter({
            requirePrivyAuth: authenticateInOrder,
            requireShgtUser,
            requireGroupMembership: authorizeMembershipInOrder,
            findGroupOverview: async (userId, groupId) => {
                calls.push({
                    operation: "findGroupOverview",
                    userId,
                    groupId
                });

                if (overviewError) {
                    throw overviewError;
                }

                return groupOverview;
            }
        })
    );

    return { app, calls, middlewareOrder };
}

async function sendRequest(harness, {
    groupId = "23",
    token = "valid",
    headers = {},
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

        const response = await fetch(
            `http://127.0.0.1:${address.port}/api/v1/groups/${groupId}${query}`,
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

test("returns only approved group details to an active member", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        success: true,
        group: {
            groupId: 23,
            groupCode: "GRP-023",
            groupName: "Hillview Group",
            village: "Hillview",
            district: "North District",
            state: "Example State",
            formationDate: "2024-06-15T00:00:00.000Z",
            groupStatus: "ACTIVE"
        }
    });
    for (const excludedField of ["pinCode", "createdAt", "updatedAt"]) {
        assert.equal(
            Object.hasOwn(response.body.group, excludedField),
            false
        );
    }
});

test("rejects missing and invalid authentication", async () => {
    const missingHarness = createHarness();
    const missing = await sendRequest(missingHarness, { token: null });
    assert.equal(missing.status, 401);
    assert.deepEqual(missingHarness.middlewareOrder, ["requirePrivyAuth"]);

    const invalidHarness = createHarness({ invalidToken: true });
    const invalid = await sendRequest(invalidHarness);
    assert.equal(invalid.status, 401);
    assert.deepEqual(invalidHarness.middlewareOrder, ["requirePrivyAuth"]);
});

test("rejects missing and inactive SHGT accounts", async () => {
    for (const [userId, expectedStatus] of [
        [PRIVY_USER_IDS.missing, 404],
        [PRIVY_USER_IDS.inactive, 403]
    ]) {
        const harness = createHarness();
        const authenticate = requirePrivyAuth.createRequirePrivyAuth({
            verifyToken: async () => ({ user_id: userId })
        });
        const router = createGroupsRouter({
            requirePrivyAuth: authenticate,
            requireShgtUser: (req, res, next) => {
                harness.middlewareOrder.push("requireShgtUser");
                if (userId === PRIVY_USER_IDS.missing) {
                    return res.status(404).json({ success: false });
                }
                return res.status(403).json({ success: false });
            },
            requireGroupMembership: (req, res, next) => {
                harness.middlewareOrder.push("requireGroupMembership");
                return next();
            },
            findGroupOverview: async () => overview
        });
        const app = express();
        app.use("/api/v1/groups", router);
        const response = await sendRequest({ ...harness, app });

        assert.equal(response.status, expectedStatus);
        assert.deepEqual(harness.middlewareOrder, ["requireShgtUser"]);
    }
});

test("rejects invalid group IDs and skips membership lookup", async () => {
    const harness = createHarness();
    const response = await sendRequest(harness, { groupId: "not-an-id" });

    assert.equal(response.status, 400);
    assert.deepEqual(harness.calls, []);
});

test("rejects missing or inactive group membership", async () => {
    const harness = createHarness({ membership: null });
    const response = await sendRequest(harness);

    assert.equal(response.status, 404);
    assert.equal(
        harness.calls.some((call) => call.operation === "findGroupOverview"),
        false
    );
});

test("returns 404 when an authorized group is not found", async () => {
    const harness = createHarness({ groupOverview: null });

    const response = await sendRequest(harness);

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
        success: false,
        message: "Group not found."
    });
});

test("returns a safe error response when the overview lookup fails", async () => {
    const harness = createHarness({
        overviewError: new Error("Oracle password and SQL details")
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 503);
    assert.doesNotMatch(
        JSON.stringify(response.body),
        /Oracle password and SQL details/
    );
});

test("does not return an overview for a group different from the authorized group", async () => {
    const harness = createHarness({
        groupOverview: { ...overview, groupId: 24 }
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
        success: false,
        message: "Internal server error."
    });
});

test("frontend-supplied IDs and roles cannot override trusted context", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, {
        headers: {
            "X-User-Id": "900",
            "X-Member-Role": "PRESIDENT"
        },
        query: "?userId=901&groupId=24&memberRole=TREASURER"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(harness.calls, [
        {
            operation: "findActiveGroupMembership",
            userId: 42,
            groupId: 23
        },
        {
            operation: "findGroupOverview",
            userId: 42,
            groupId: 23
        }
    ]);
});

test("runs the three authorization middleware in the required order", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(harness.middlewareOrder, [
        "requirePrivyAuth",
        "requireShgtUser",
        "requireGroupMembership"
    ]);
});

test("performs only membership and read-only overview lookups", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(
        harness.calls.map((call) => call.operation),
        ["findActiveGroupMembership", "findGroupOverview"]
    );
});
