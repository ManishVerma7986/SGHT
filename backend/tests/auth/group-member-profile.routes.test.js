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
const {
    INTEGRITY_ERROR_CODE
} = require("../../src/services/group-member-profile.service");

const PRIVY_USER_IDS = {
    valid: "did:privy:member",
    missing: "did:privy:unregistered",
    inactive: "did:privy:inactive"
};

function createHarness({
    membership = {
        membershipId: 105,
        groupId: 23,
        memberRole: "MEMBER"
    },
    profileResult = {
        authorized: true,
        profile: { fullName: "Member Example" }
    },
    profileError
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

    const membershipAuthorization = createRequireGroupMembership({
        findMembership: async (userId, groupId) => {
            calls.push({
                operation: "findActiveGroupMembership",
                userId,
                groupId
            });
            return membership;
        }
    });
    const membershipInOrder = (req, res, next) => {
        middlewareOrder.push("requireGroupMembership");
        return membershipAuthorization(req, res, next);
    };

    const app = express();
    app.use(
        "/api/v1/groups",
        createGroupsRouter({
            requirePrivyAuth: authenticateInOrder,
            requireShgtUser,
            requireGroupMembership: membershipInOrder,
            findGroupMemberProfile: async (userId, groupId) => {
                calls.push({
                    operation: "findOwnGroupProfile",
                    userId,
                    groupId
                });
                if (profileError) {
                    throw profileError;
                }
                return profileResult;
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
            `http://127.0.0.1:${address.port}/api/v1/groups/${groupId}/members/me${query}`,
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

test("returns exactly the approved own-profile response", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        success: true,
        profile: {
            fullName: "Member Example"
        }
    });
    assert.deepEqual(harness.calls, [
        {
            operation: "findActiveGroupMembership",
            userId: 42,
            groupId: 23
        },
        {
            operation: "findOwnGroupProfile",
            userId: 42,
            groupId: 23
        }
    ]);
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

test("rejects nonmembers, inactive memberships, and suspended groups", async () => {
    for (const scenario of [
        "nonmember",
        "inactive membership",
        "suspended group"
    ]) {
        const harness = createHarness({ membership: null });
        const response = await sendRequest(harness);

        assert.equal(response.status, 404, scenario);
        assert.equal(harness.calls.length, 1, scenario);
        assert.equal(
            harness.calls.some(
                (call) => call.operation === "findOwnGroupProfile"
            ),
            false,
            scenario
        );
    }
});

test("returns 404 for a missing profile after confirming authorization", async () => {
    const harness = createHarness({
        profileResult: {
            authorized: true,
            profile: null
        }
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
        success: false,
        message: "Member profile not found."
    });
    assert.equal(harness.calls[1].operation, "findOwnGroupProfile");
});

test("fails closed with 500 for duplicate or malformed profile data", async () => {
    for (const message of [
        "Duplicate profile.",
        "Duplicate active membership.",
        "Malformed profile row."
    ]) {
        const error = new Error(message);
        error.code = INTEGRITY_ERROR_CODE;
        const harness = createHarness({ profileError: error });

        const response = await sendRequest(harness);

        assert.equal(response.status, 500);
        assert.deepEqual(response.body, {
            success: false,
            message: "Internal server error."
        });
        assert.doesNotMatch(JSON.stringify(response.body), new RegExp(message));
    }
});

test("returns a safe 503 for unexpected database failures", async () => {
    const harness = createHarness({
        profileError: new Error("Oracle credentials and SQL details")
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
        success: false,
        message: "Unable to retrieve member profile. Please try again."
    });
    assert.doesNotMatch(
        JSON.stringify(response.body),
        /Oracle credentials and SQL details/
    );
});

test("ignores frontend-supplied user and group IDs", async () => {
    const harness = createHarness();

    const response = await sendRequest(harness, {
        headers: {
            "X-User-Id": "900",
            "X-Group-Id": "901"
        },
        query: "?userId=902&groupId=903"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(harness.calls, [
        {
            operation: "findActiveGroupMembership",
            userId: 42,
            groupId: 23
        },
        {
            operation: "findOwnGroupProfile",
            userId: 42,
            groupId: 23
        }
    ]);
});

test("returns 404 when service authorization context is inactive", async () => {
    const harness = createHarness({
        profileResult: {
            authorized: false,
            profile: null
        }
    });

    const response = await sendRequest(harness);

    assert.equal(response.status, 404);
    assert.equal(response.body.message, "Active membership in this group was not found.");
});
