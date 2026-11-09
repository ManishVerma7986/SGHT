
const express = require("express");
const oracledb = require("oracledb");

const router = express.Router();

const requirePrivyAuth = require("../middleware/requirePrivyAuth");
const { getConnection } = require("../config/database");

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


// GET /api/v1/auth/me
// Checks whether the authenticated Privy identity is registered.
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
            await connection.close();
        }
    }
});


// POST /api/v1/auth/register
// Creates a user, member profile and pending KYC record atomically.
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

        // Validate and normalize optional phone number.
        let normalizedPhone = null;

        if (phoneNumber !== undefined && phoneNumber !== null) {
            if (typeof phoneNumber !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number."
                });
            }

            const cleanedPhone = phoneNumber
                .trim()
                .replace(/[\s()-]/g, "");

            if (cleanedPhone.length > 0) {
                if (!/^\+?[1-9]\d{7,14}$/.test(cleanedPhone)) {
                    return res.status(400).json({
                        success: false,
                        message: "Enter a valid international phone number."
                    });
                }

                normalizedPhone = cleanedPhone;
            }
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
        // Direct table INSERT privileges are not required.
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

        // A unique violation may mean another request registered
        // this same Privy identity while our request was executing.
        if (error.errorNum === 1 && rollbackSucceeded && connection) {
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

                // The unique violation was not caused by an existing
                // Privy identity. Do not misreport it as successful.
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

        console.error(
            "SHGT registration failed:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to complete SHGT registration. Please verify your account status before retrying."
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

module.exports = router;
