const express = require("express");

const requirePrivyAuth = require("../middleware/requirePrivyAuth");
const requireShgtUser = require("../middleware/requireShgtUser");
const {
    PROFILE_INTEGRITY_ERROR,
    createProfileService
} = require("../services/profile.service");

function createProfileRouter({
    authenticate = requirePrivyAuth,
    authorizeUser = requireShgtUser,
    service = createProfileService()
} = {}) {
    const router = express.Router();

    router.get("/me", authenticate, authorizeUser, async (req, res) => {
        try {
            const profile = await service.findOwnProfile(req.shgtUser.userId);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: "Member profile not found."
                });
            }
            return res.status(200).json({ success: true, profile });
        } catch (error) {
            if (error?.code === PROFILE_INTEGRITY_ERROR) {
                console.error("Member profile integrity check failed.");
                return res.status(500).json({
                    success: false,
                    message: "Internal server error."
                });
            }
            console.error("Member profile lookup failed.", {
                errorName: error?.name,
                errorCode: error?.code
            });
            return res.status(503).json({
                success: false,
                message: "Unable to retrieve your profile. Please try again."
            });
        }
    });

    return router;
}

module.exports = { createProfileRouter };
