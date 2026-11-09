
const {
    findShgtUserByPrivyId
} = require("../services/shgt-user.service");

async function requireShgtUser(req, res, next) {
    if (!req.privyUserId) {
        return res.status(401).json({
            success: false,
            message: "Privy authentication is required."
        });
    }

    let user;

    try {
        user = await findShgtUserByPrivyId(req.privyUserId);
    } catch (error) {
        console.error("SHGT user authorization failed:", error.message);

        return res.status(503).json({
            success: false,
            message: "Unable to verify SHGT account. Please try again."
        });
    }

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "SHGT account not found. Please complete registration."
        });
    }

    if (user.accountStatus !== "ACTIVE") {
        return res.status(403).json({
            success: false,
            message: "Your SHGT account is not active."
        });
    }

    req.shgtUser = {
        userId: user.userId
    };

    return next();
}

module.exports = requireShgtUser;
