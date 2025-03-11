const fs = require('fs');
const fetch = require('node-fetch');
const { ethers } = require('ethers');

// Function to mask address
const maskedAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const logFile = "log.txt";

// Utility function to log to file
function logToFile(message) {
    fs.appendFileSync(logFile, message + "\n", "utf8");
}

// Log function for console and file
function log(address, message) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const logMessage = address 
      ? `[${timestamp} | ${maskedAddress(address)}] ${message}`
      : "";

  console.log(logMessage);
  logToFile(logMessage);
}

// Simulate a delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Print header when the bot starts
function header() {
    console.log("Sahara Task Bot Initialized.");
}

// Function to fetch a challenge
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

// Function to sign the challenge message
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

// Function to send a task request
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

// Function to claim the task reward
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

// Function to check task status
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

// Main function to send daily task
async function sendDailyTask(wallet) {
    try {
        const { accessToken } = await signChallenge(wallet);
        if (!accessToken) {
            throw new Error(`❌ Access token not found!`);
        }

        const taskIDs = ["1004"]; // Only task 1004 is now included
        for (const taskID of taskIDs) {
            await sendCheckTask(accessToken, taskID, wallet.address);
        }
        log(wallet.address, "✅ All tasks completed.");
        log("", "");
    } catch (error) {
        log(wallet.address, `❌ Error: ${error.message}`);
    }
}

// Function to start the bot and process the wallets from privateKeys.txt
async function startBot() {
    fs.writeFileSync(logFile, "");
    header();

    // Read private keys from 'privateKeys.txt'
    const privateKeys = fs.readFileSync('privateKeys.txt', 'utf8').split('\n').map(key => key.trim()).filter(key => key.length > 0);
    const provider = new ethers.JsonRpcProvider("https://testnet.saharalabs.ai");

    for (const privateKey of privateKeys) {
        const wallet = new ethers.Wallet(privateKey, provider);  // Use custom provider
        log(wallet.address, `🔹 Processing wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);
        await sendDailyTask(wallet);
    }
}

// Start the bot
startBot();
