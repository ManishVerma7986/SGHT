const { PrivyClient, InvalidAuthTokenError } = require("@privy-io/node");

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
    throw new Error("Missing PRIVY_APP_ID or PRIVY_APP_SECRET.");
}

const privy = new PrivyClient({
    appId,
    appSecret
});

async function requirePrivyAuth(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required."
        });
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is empty."
        });
    }

    try {
        const claims = await privy
            .utils()
            .auth()
            .verifyAccessToken(accessToken);

        if (!claims.user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication identity."
            });
        }

        // This ID comes from the verified token, not the request body.
        req.privyUserId = claims.user_id;

        next();
    } catch (error) {
        if (
            error instanceof InvalidAuthTokenError ||
            error.name === "InvalidAuthTokenError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired authentication token."
            });
        }

        // A verifier/network failure is not automatically an invalid token.
        console.error("Privy verification service error:", error.message);

        return res.status(503).json({
            success: false,
            message: "Authentication service temporarily unavailable."
        });
    }
}

module.exports = requirePrivyAuth;