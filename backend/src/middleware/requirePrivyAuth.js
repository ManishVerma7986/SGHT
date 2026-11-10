
const {
    verifyPrivyAccessToken,
    InvalidAuthTokenError
} = require("../services/privy-auth.service");

function createRequirePrivyAuth({
    verifyToken = verifyPrivyAccessToken,
    isInvalidTokenError = (error) =>
        error instanceof InvalidAuthTokenError ||
        error?.name === "InvalidAuthTokenError"
} = {}) {
    return async function requirePrivyAuth(req, res, next) {
        const authorization = req.headers.authorization;

        if (
            typeof authorization !== "string" ||
            !authorization.startsWith("Bearer ")
        ) {
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

        let claims;

        try {
            claims = await verifyToken(accessToken);
        } catch (error) {
            if (isInvalidTokenError(error)) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired authentication token."
                });
            }

            console.error(
                "Privy verification service error:",
                error.message
            );

            return res.status(503).json({
                success: false,
                message: "Authentication service temporarily unavailable."
            });
        }

        if (
            !claims ||
            typeof claims.user_id !== "string" ||
            !claims.user_id.trim()
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication identity."
            });
        }

        req.privyUserId = claims.user_id;

        return next();
    };
}

const requirePrivyAuth = createRequirePrivyAuth();

requirePrivyAuth.createRequirePrivyAuth = createRequirePrivyAuth;

module.exports = requirePrivyAuth;
