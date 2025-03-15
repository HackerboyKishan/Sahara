require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { ethers } = require('ethers');
const { JsonRpcProvider } = require('ethers');

// Helper functions
const chains = loadModulesFromDir(path.join(__dirname, 'chains'));
const delay = chains.utils.etc.delay;
const header = chains.utils.etc.header;
const privateKeysFilePath = 'privatekeys.txt';

const logFile = "log.txt";
const maskedAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const logToFile = (message) => fs.appendFileSync(logFile, message + "\n", "utf8");

function log(address, message) {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const logMessage = address
        ? `[${timestamp} | ${maskedAddress(address)}] ${message}`
        : "";

    console.log(logMessage);
    logToFile(logMessage);
}

function loadModulesFromDir(dir) {
    const modules = {};
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isFile() && file.endsWith('.js')) {
            const moduleName = toCamelCase(path.basename(file, '.js'));
            modules[moduleName] = require(fullPath);
        }
    });
    return modules;
}

function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

// RPC Providers and Explorer
const rpcProviders = [
    new JsonRpcProvider('https://testnet.saharalabs.ai'),
];
let currentRpcProviderIndex = 0;

function provider() {
    return rpcProviders[currentRpcProviderIndex];
}

function rotateRpcProvider() {
    currentRpcProviderIndex = (currentRpcProviderIndex + 1) % rpcProviders.length;
    return provider();
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const baseExplorerUrl = 'https://testnet-explorer.saharalabs.ai';
const explorer = {
    get tx() {
        return (txHash) => `${baseExplorerUrl}/tx/${txHash}`;
    },
    get address() {
        return (address) => `${baseExplorerUrl}/address/${address}`;
    }
};

// Main logic for wallet tasks
async function getChallenge(address) {
    log(address, "🔹 Requesting challenge...");
    await delay(5000);

    const response = await fetch("https://legends.saharalabs.ai/api/v1/user/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, timestamp: Date.now() })
    });

    if (!response.ok) {
        throw new Error(`❌ Failed to get challenge: ${response.statusText}`);
    }

    const data = await response.json();
    log(address, `✅ Challenge received: ${data.challenge}`);
    return data.challenge;
}

async function signChallenge(wallet) {
    try {
        const address = wallet.address;
        const challenge = await getChallenge(address);
        const message = `Sign in to Sahara!\nChallenge:${challenge}`;
        const signature = await wallet.signMessage(message);

        log(address, `✅ Signature: ${signature.slice(0, 6)}...${signature.slice(-4)}`);

        log(address, "🔹 Submitting signature for login...");
        await delay(5000);
        const loginResponse = await fetch("https://legends.saharalabs.ai/api/v1/login/wallet", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "accept": "application/json",
                "authorization": "Bearer null",
                "origin": "https://legends.saharalabs.ai",
                "referer": "https://legends.saharalabs.ai/?code=THWD0T",
                "user-agent": "Mozilla/5.0"
            },
            body: JSON.stringify({
                address,
                sig: signature,
                referralCode: "THWD0T",
                walletUUID: "",
                walletName: "MetaMask",
                timestamp: Date.now()
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`❌ Login failed: ${loginResponse.statusText}`);
        }

        const loginData = await loginResponse.json();
        const maskedToken = loginData.accessToken
            ? `${loginData.accessToken.slice(0, 6)}***${loginData.accessToken.slice(-4)}`
            : "Token not found";

        log(address, `✅ Login successful! Access Token: ${maskedToken}`);

        if (!loginData.accessToken) {
            throw new Error(`❌ Failed to retrieve accessToken`);
        }

        return { accessToken: loginData.accessToken };
    } catch (error) {
        log(wallet.address, `❌ Error during login: ${error.message}`);
        throw error;
    }
}

async function sendTaskRequest(accessToken, taskID, address) {
    log(address, `🔹 Sending request for Task ${taskID}...`);
    await delay(5000);

    await fetch("https://legends.saharalabs.ai/api/v1/task/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ taskID, timestamp: Date.now() })
    });

    log(address, `✅ Task ${taskID} - Request successfully sent.`);
}

async function sendTaskClaim(accessToken, taskID, address) {
    log(address, `🔹 Claiming Task ${taskID}...`);
    await delay(5000);

    await fetch("https://legends.saharalabs.ai/api/v1/task/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ taskID, timestamp: Date.now() })
    });

    log(address, `✅ Task ${taskID} - Successfully claimed.`);
}

async function sendCheckTask(accessToken, taskID, address) {
    log(address, `🔹 Checking Task ${taskID} status...`);
    await delay(5000);

    const checkTask = await fetch("https://legends.saharalabs.ai/api/v1/task/dataBatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ taskIDs: [taskID], timestamp: Date.now() })
    });

    if (!checkTask.ok) {
        throw new Error(`❌ Request /task/dataBatch failed for Task ${taskID}`);
    }

    const taskData = await checkTask.json();
    const status = taskData[taskID]?.status;
    log(address, `✅ Task ${taskID} - Status: ${status}`);

    if (status === "1") {
        log(address, `🔹 Task ${taskID} requires verification, sending request...`);
        await sendTaskRequest(accessToken, taskID, address);
        await delay(10000);
        log(address, `🔹 Task ${taskID} verification completed, claiming reward...`);
        await sendTaskClaim(accessToken, taskID, address);
    } else if (status === "2") {
        log(address, `🔹 Task ${taskID} is claimable, claiming reward...`);
        await sendTaskClaim(accessToken, taskID, address);
    } else if (status === "3") {
        log(address, `✅ Task ${taskID} is already completed.`);
    } else {
        log(address, `⚠️ Task ${taskID} has an unknown status: ${status}`);
    }
}

async function sendDailyTask(wallet) {
    try {
        const { accessToken } = await signChallenge(wallet);
        if (!accessToken) {
            throw new Error(`❌ Access token not found!`);
        }

        const taskIDs = ["1001", "1002", "1004"];
        for (const taskID of taskIDs) {
            await sendCheckTask(accessToken, taskID, wallet.address);
        }
        log(wallet.address, "✅ All tasks completed.");
        log("", "");
    } catch (error) {
        log(wallet.address, `❌ Error: ${error.message}`);
    }
}

async function startBot() {
    fs.writeFileSync(logFile, "");
    header();

    // Load private keys from the file
    const privateKeys = fs.readFileSync(privateKeysFilePath, 'utf-8').split('\n').filter(Boolean);

    for (const privateKey of privateKeys) {
        const wallet = new ethers.Wallet(privateKey);
        log(wallet.address, `🔹 Processing wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);
        await sendDailyTask(wallet);
    }
}

startBot();
