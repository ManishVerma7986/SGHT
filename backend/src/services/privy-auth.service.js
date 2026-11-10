
const {
    loadDeploymentEnvironment
} = require("../config/environment");

loadDeploymentEnvironment();

const {
    PrivyClient,
    InvalidAuthTokenError
} = require("@privy-io/node");

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
    throw new Error("Missing PRIVY_APP_ID or PRIVY_APP_SECRET.");
}

const privy = new PrivyClient({
    appId,
    appSecret
});

async function verifyPrivyAccessToken(accessToken) {
    return privy
        .utils()
        .auth()
        .verifyAccessToken(accessToken);
}

module.exports = {
    verifyPrivyAccessToken,
    InvalidAuthTokenError
};
