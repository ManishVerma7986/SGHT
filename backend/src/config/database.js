
const oracledb = require("oracledb");
const path = require("path");
require("dotenv").config();

let pool;

async function initializePool() {
    if (pool) {
        return pool;
    }

    const walletLocation = path.resolve(
        __dirname,
        "../..",
        process.env.DB_WALLET_LOCATION
    );

    try {
        pool = await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING,

            configDir: walletLocation,
            walletLocation: walletLocation,
            walletPassword: process.env.DB_WALLET_PASSWORD,

            poolMin: 1,
            poolMax: 5,
            poolIncrement: 1,
            poolTimeout: 60
        });

        console.log("Oracle connection pool initialized.");

        return pool;
    } catch (error) {
        console.error(
            "Oracle connection pool initialization failed:",
            error.message
        );

        throw error;
    }
}

async function getConnection() {
    if (!pool) {
        throw new Error("Oracle connection pool is not initialized.");
    }

    return pool.getConnection();
}

// Retained for the existing database test.
async function connectDB() {
    if (!pool) {
        await initializePool();
    }

    return getConnection();
}

async function closePool() {
    if (pool) {
        await pool.close(10);
        pool = undefined;
        console.log("Oracle connection pool closed.");
    }
}

module.exports = {
    initializePool,
    getConnection,
    connectDB,
    closePool
};
