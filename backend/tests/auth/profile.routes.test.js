const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

const { createProfileRouter } = require("../../src/routes/profile.routes");

async function createHarness({ findOwnProfile }) {
    const app = express();
    app.use("/api/v1/profile", createProfileRouter({
        authenticate: (_req, _res, next) => next(),
        authorizeUser: (req, _res, next) => {
            req.shgtUser = { userId: 7 };
            return next();
        },
        service: { findOwnProfile }
    }));
    const server = http.createServer(app);
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
        server.listen(0, "127.0.0.1");
    });
    return {
        async get() {
            const response = await fetch(
                `http://127.0.0.1:${server.address().port}/api/v1/profile/me`
            );
            return { status: response.status, body: await response.json() };
        },
        close() {
            return new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
            });
        }
    };
}

test("returns the authenticated user's own profile", async () => {
    let userId;
    const harness = await createHarness({
        findOwnProfile: async (id) => {
            userId = id;
            return { fullName: "Example Member" };
        }
    });
    try {
        const response = await harness.get();
        assert.equal(userId, 7);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            success: true,
            profile: { fullName: "Example Member" }
        });
    } finally {
        await harness.close();
    }
});

test("does not return success when the profile store is unavailable", async () => {
    const harness = await createHarness({
        findOwnProfile: async () => {
            throw new Error("unavailable");
        }
    });
    try {
        const response = await harness.get();
        assert.equal(response.status, 503);
        assert.equal(response.body.success, false);
        assert.equal(response.body.profile, undefined);
    } finally {
        await harness.close();
    }
});
