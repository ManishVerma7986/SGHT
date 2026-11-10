const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const requirePrivyAuth = require("../../src/middleware/requirePrivyAuth");
const {
    createGroupsRouter
} = require("../../src/routes/groups.routes");

const PRIVY_USER_IDS = {
    active: "did:privy:active-user",
    missing: "did:privy:missing-account",
    inactive: "did:privy:inactive-account"
};
const memberships = [
    {
        groupId: 23,
        groupCode: "GRP-023",
        groupName: "Hillview Group",
        memberRole: "MEMBER",
        membershipStatus: "ACTIVE",
        membershipId: 105,
        groupStatus: "ACTIVE"
    },
    {
        groupId: 24,
        groupCode: "GRP-024",
        groupName: "Lakeside Group",
        memberRole: "SECRETARY",
        membershipStatus: "ACTIVE",
        membershipId: 106,
        groupStatus: "ACTIVE"
    }
];

function createHarness({
    userMemberships = memberships,
    lookupError
} = {}) {
    const calls = [];
    const middlewareOrder = [];

    const authenticate = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async (token) => {
            if (!Object.hasOwn(PRIVY_USER_IDS, token)) {
                const error = new Error("Invalid token");
                error.name = "InvalidAuthTokenError";
                throw error;
            }

            return { user_id: PRIVY_USER_IDS[token] };
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

    const app = express();
    app.use(
        "/api/v1/groups",
        createGroupsRouter({
            requirePrivyAuth: authenticateInOrder,
            requireShgtUser,
            findUserGroupMemberships: async (userId) => {
                calls.push({ userId });
                if (lookupError) {
                    throw lookupError;
                }
                return userMemberships;
            }
        })
    );

    return { app, calls, middlewareOrder };
}

async function sendRequest(harness, {
    token = "active",
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
            `http://127.0.0.1:${address.port}/api/v1/groups/mine${query}`,
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

test("lists the caller's multiple active groups without internal IDs", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        success: true,
        groups: [
            {
                groupId: 23,
                groupCode: "GRP-023",
                groupName: "Hillview Group",
                memberRole: "MEMBER",
                membershipStatus: "ACTIVE"
            },
            {
                groupId: 24,
                groupCode: "GRP-024",
                groupName: "Lakeside Group",
                memberRole: "SECRETARY",
                membershipStatus: "ACTIVE"
            }
        ]
    });
    assert.deepEqual(harness.calls, [{ userId: 42 }]);
    assert.deepEqual(harness.middlewareOrder, [
        "requirePrivyAuth",
        "requireShgtUser"
    ]);
});

test("returns an empty groups list when the caller has no active groups", async () => {
    const harness = createHarness({ userMemberships: [] });

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        success: true,
        groups: []
    });
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
        assert.deepEqual(harness.calls, []);
    }
});

test("ignores frontend-supplied user IDs", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, {
        headers: { "X-User-Id": "900" },
        query: "?userId=901"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(harness.calls, [{ userId: 42 }]);
});

test("returns a safe error response when membership lookup fails", async () => {
    const harness = createHarness({
        lookupError: new Error("Oracle credentials and internal SQL")
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
        success: false,
        message: "Unable to retrieve your groups. Please try again."
    });
    assert.doesNotMatch(
        JSON.stringify(response.body),
        /Oracle credentials and internal SQL/
    );
});
