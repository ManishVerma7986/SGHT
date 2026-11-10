const express = require("express");
const oracledb = require("oracledb");

const defaultRequirePrivyAuth = require("../middleware/requirePrivyAuth");
const { getConnection: defaultGetConnection } = require("../config/database");
const { isPhoneNumberDuplicate } = require("../utils/oracle-error.util");
const { normalizePhoneNumber } = require("../utils/phone-number.util");

// Find an SHGT account using the verified Privy identity.
async function findExistingMember(connection, privyUserId) {
    const result = await connection.execute(
        `SELECT USER_ID, ACCOUNT_STATUS
         FROM SHGT_APP.USERS
         WHERE PRIVY_USER_ID = :privyUserId`,
        { privyUserId }
    );

    if (result.rows.length === 0) {
        return null;
    }

    const [userId, accountStatus] = result.rows[0];

    return { userId, accountStatus };
}

// Return the actual state of an existing account.
function respondWithExistingMember(res, member) {
    if (member.accountStatus !== "ACTIVE") {
        return res.status(403).json({
            success: false,
            authenticated: true,
            registered: true,
            userId: member.userId,
            accountStatus: member.accountStatus,
            message: "This SHGT account is not active."
        });
    }

    return res.status(200).json({
        success: true,
        authenticated: true,
        registered: true,
        userId: member.userId,
        accountStatus: member.accountStatus,
        message: "This Privy identity is already registered with SHGT."
    });
}

// Create an injectable authentication router.
// Production uses real dependencies; tests can supply mocks.
function createAuthRouter({
    getConnection = defaultGetConnection,
    requirePrivyAuth = defaultRequirePrivyAuth
} = {}) {
    const router = express.Router();

    // GET /api/v1/auth/me
    router.get("/me", requirePrivyAuth, async (req, res) => {
        let connection;

        try {
            connection = await getConnection();

            const member = await findExistingMember(
                connection,
                req.privyUserId
            );

            if (!member) {
                return res.json({
                    success: true,
                    authenticated: true,
                    registered: false,
                    message: "Privy identity verified. SHGT registration is pending."
                });
            }

            return respondWithExistingMember(res, member);

        } catch (error) {
            console.error(
                "Authenticated identity lookup failed:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve member identity."
            });

        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (closeError) {
                    console.error(
                        "Authentication lookup connection cleanup failed:",
                        closeError.message
                    );
                }
            }
        }
    });

    // POST /api/v1/auth/register
    router.post("/register", requirePrivyAuth, async (req, res) => {
        let connection;
        let transactionStarted = false;

        try {
            const {
                fullName,
                phoneNumber,
                email
            } = req.body || {};

            // Validate full name.
            if (
                typeof fullName !== "string" ||
                fullName.trim().length < 2 ||
                fullName.trim().length > 150 ||
                /[\u0000-\u001F\u007F]/.test(fullName)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid full name (2-150 characters)."
                });
            }

            const normalizedName = fullName.trim();

            // Validate and normalize mandatory phone number.
            let normalizedPhone;

            try {
                normalizedPhone = normalizePhoneNumber(phoneNumber);

                if (!normalizedPhone) {
                    return res.status(400).json({
                        success: false,
                        message: "Phone number is required."
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid international phone number with country code."
                });
            }

            // Validate and normalize optional email.
            let normalizedEmail = null;

            if (email !== undefined && email !== null) {
                if (typeof email !== "string") {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid email address."
                    });
                }

                const cleanedEmail = email.trim().toLowerCase();

                if (cleanedEmail.length > 0) {
                    if (
                        cleanedEmail.length > 254 ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)
                    ) {
                        return res.status(400).json({
                            success: false,
                            message: "Enter a valid email address."
                        });
                    }

                    normalizedEmail = cleanedEmail;
                }
            }

            // Identity comes exclusively from verified Privy middleware.
            const privyUserId = req.privyUserId;

            if (
                typeof privyUserId !== "string" ||
                privyUserId.length === 0 ||
                privyUserId.length > 100
            ) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid authenticated identity."
                });
            }

            connection = await getConnection();

            // Make ordinary registration retries idempotent.
            const existingMember = await findExistingMember(
                connection,
                privyUserId
            );

            if (existingMember) {
                return respondWithExistingMember(res, existingMember);
            }

            // Execute the restricted Oracle registration package.
            transactionStarted = true;

            const result = await connection.execute(
                `BEGIN
                    SHGT_APP.AUTH_REGISTRATION_PKG.REGISTER_MEMBER(
                        P_PRIVY_USER_ID => :privyUserId,
                        P_FULL_NAME     => :fullName,
                        P_PHONE_NUMBER  => :phoneNumber,
                        P_EMAIL         => :email,
                        P_USER_ID       => :userId
                    );
                 END;`,
                {
                    privyUserId: {
                        val: privyUserId,
                        type: oracledb.STRING,
                        maxSize: 100
                    },
                    fullName: {
                        val: normalizedName,
                        type: oracledb.STRING,
                        maxSize: 150
                    },
                    phoneNumber: {
                        val: normalizedPhone,
                        type: oracledb.STRING,
                        maxSize: 20
                    },
                    email: {
                        val: normalizedEmail,
                        type: oracledb.STRING,
                        maxSize: 254
                    },
                    userId: {
                        dir: oracledb.BIND_OUT,
                        type: oracledb.NUMBER
                    }
                },
                { autoCommit: false }
            );

            const userId = result.outBinds.userId;

            // Commit only after the entire package succeeds.
            await connection.commit();
            transactionStarted = false;

            return res.status(201).json({
                success: true,
                registered: true,
                userId,
                accountStatus: "ACTIVE",
                verificationStatus: "PENDING",
                message: "SHGT registration completed. Identity verification is pending."
            });

        } catch (error) {
            // Roll back before attempting duplicate recovery.
            let rollbackSucceeded = !transactionStarted;

            if (connection && transactionStarted) {
                try {
                    await connection.rollback();
                    transactionStarted = false;
                    rollbackSucceeded = true;

                } catch (rollbackError) {
                    console.error(
                        "Registration rollback failed:",
                        rollbackError.message
                    );
                }
            }

            // Handle duplicate phone numbers separately.
            if (
                isPhoneNumberDuplicate(error) &&
                rollbackSucceeded
            ) {
                return res.status(409).json({
                    success: false,
                    registered: false,
                    code: "PHONE_NUMBER_ALREADY_REGISTERED",
                    message: "This mobile number is already registered."
                });
            }

            // Handle duplicate Privy identity.
            if (
                error.errorNum === 1 &&
                rollbackSucceeded &&
                connection
            ) {
                try {
                    const existingMember = await findExistingMember(
                        connection,
                        req.privyUserId
                    );

                    if (existingMember) {
                        return respondWithExistingMember(
                            res,
                            existingMember
                        );
                    }

                    return res.status(409).json({
                        success: false,
                        registered: false,
                        message: "Registration conflicts with an existing database record."
                    });

                } catch (lookupError) {
                    console.error(
                        "Duplicate registration recovery failed:",
                        lookupError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Unable to verify registration status."
                    });
                }
            }

            // Handle all other failures.
            console.error(
                "SHGT registration failed:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Unable to complete SHGT registration."
            });

        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (closeError) {
                    console.error(
                        "Registration connection cleanup failed:",
                        closeError.message
                    );
                }
            }
        }
    });

    return router;
}

// Production router uses real dependencies.
const router = createAuthRouter();

module.exports = router;
module.exports.createAuthRouter = createAuthRouter;
