function createRequirePlatformAdmin({
    resolvePlatformAdmin
} = {}) {
    return async function requirePlatformAdmin(req, res, next) {
        if (typeof resolvePlatformAdmin !== "function") {
            return res.status(503).json({
                success: false,
                message: "Platform administrator authorization is not configured."
            });
        }

        try {
            const administrator = await resolvePlatformAdmin(
                req.shgtUser?.userId
            );
            if (
                !administrator ||
                !Number.isSafeInteger(administrator.userId) ||
                administrator.userId <= 0 ||
                administrator.userId !== req.shgtUser?.userId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Platform administrator access is required."
                });
            }

            req.platformAdmin = { userId: administrator.userId };
            return next();
        } catch (error) {
            console.error(
                "Platform administrator authorization failed:",
                error.message
            );
            return res.status(503).json({
                success: false,
                message: "Unable to verify platform administrator access."
            });
        }
    };
}

module.exports = {
    createRequirePlatformAdmin
};
