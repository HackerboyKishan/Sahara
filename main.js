require('dotenv').config();
const { JsonRpcProvider, ethers } = require('ethers');
const kleur = require("kleur");
const fs = require('fs');
const moment = require('moment-timezone');
const fetch = require('node-fetch').default; // Corrected import for node-fetch

// RPC Providers
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

// Explorer base URL
const baseExplorerUrl = 'https://testnet-explorer.saharalabs.ai';

// Explorer URLs
const explorer = {
  get tx() {
    return (txHash) => `${baseExplorerUrl}/tx/${txHash}`;
  },
  get address() {
    return (address) => `${baseExplorerUrl}/address/${address}`;
  }
};

// Log helper
function appendLog(message) {
  fs.appendFileSync('log-sahara.txt', message + '\n');
}

// Function to generate random transaction value
function getRandomTransactionValue() {
  const min = 0.000001;  // Minimum value for transaction
  const max = 0.00001;   // Maximum value for transaction
  return Math.random() * (max - min) + min;
}

// Function to add delay between transactions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Single transaction for each private key
async function sendTransaction(privateKey) {
    const wallet = new ethers.Wallet(privateKey, provider());
    
    // Display loading
    console.log(`Start Transaction for Wallet ${wallet.address}...`);

    // Get the current nonce before sending the transaction (to avoid mismatch)
    const nonce = await provider().getTransactionCount(wallet.address, 'latest');  // Use 'latest' to ensure the correct nonce

    const tx = {
        to: wallet.address,
        value: ethers.parseEther(getRandomTransactionValue().toFixed(8)),  // Randomized ETH value
        nonce: nonce,  // Set the correct nonce
    };

    try {
        const signedTx = await wallet.sendTransaction(tx);
        const receipt = await signedTx.wait();
        const successMessage = `[${timelog()}] Transaction Confirmed: ${explorer.tx(receipt.hash)}`;
        console.log(kleur.green(successMessage));
        appendLog(successMessage);
    } catch (error) {
        const errorMessage = `[${timelog()}] Error processing wallet: ${error.message}`;
        console.log(kleur.red(errorMessage));
        appendLog(errorMessage);
    }
}

// Time logging function
function timelog() {
  return moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
}

// Run transactions for multiple wallets simultaneously (100 wallets)
async function runTransaction() {
    const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));

    const promises = PRIVATE_KEYS.slice(0, 100).map(async (privateKey, index) => {
        try {
            await sendTransaction(privateKey);
            console.log('');
            await delay(2000);  // Delay 2 seconds between transactions to prevent nonce issues
        } catch (error) {
            const errorMessage = `[${timelog()}] Error processing wallet ${index + 1}: ${error.message}`;
            console.log(kleur.red(errorMessage));
            appendLog(errorMessage);
        }
    });

    // Wait for all transactions to finish
    await Promise.all(promises);
}

// Claim.js logic
const header = function() {
    console.log("Sahara Bot Initialized.");
};

const logFile = "log.txt";

// Logging function for both console and file
function logToFile(message) {
    fs.appendFileSync(logFile, message + "\n", "utf8");
}

function log(address, message) {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const logMessage = address 
        ? `[${timestamp} | ${maskedAddress(address)}] ${message}`
        : ""; // Add a blank line

    console.log(logMessage);
    logToFile(logMessage);
}

// Utility function for masked address
const maskedAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

// Request the challenge
async function getChallenge(address) {
    log(address, "🔹 Requesting challenge...");
    await delay(5000);

    const response = await fetch("https://legends.saharalabs.ai/api/v1/user/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
    });

    if (!response.ok) {
        throw new Error(`❌ Failed to get challenge: ${response.statusText}`);
    }

    const data = await response.json();
    log(address, `✅ Challenge received: ${data.challenge}`);
    return data.challenge;
}

// Sign the challenge with the wallet
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
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({
                address,
                sig: signature,
                referralCode: "THWD0T",
                walletUUID: "",
                walletName: "MetaMask"
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

// Send request for Task ID
async function sendTaskRequest(accessToken, taskID, address) {
    log(address, `🔹 Sending request for Task ${taskID}...`);
    await delay(5000);
    
    await fetch("https://legends.saharalabs.ai/api/v1/task/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ taskID })
    });

    log(address, `✅ Task ${taskID} - Request successfully sent.`);
}

// Claim Task ID
async function sendTaskClaim(accessToken, taskID, address) {
    log(address, `🔹 Claiming Task ${taskID}...`);
    await delay(5000);

    await fetch("https://legends.saharalabs.ai/api/v1/task/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ taskID })
    });

    log(address, `✅ Task ${taskID} - Successfully claimed.`);
}

// Check Task status and handle accordingly
async function sendCheckTask(accessToken, taskID, address) {
    log(address, `🔹 Checking Task ${taskID} status...`);
    await delay(5000);

    const checkTask = await fetch("https://legends.saharalabs.ai/api/v1/task/dataBatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ taskIDs: [taskID] })
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

// Main daily task logic
async function sendDailyTask(wallet) {
    try {
        const { accessToken } = await signChallenge(wallet);
        if (!accessToken) {
            throw new Error(`❌ Access token not found!`);
        }

        const taskID = "1004";  // Only process Task 1004
        await sendCheckTask(accessToken, taskID, wallet.address);

        log(wallet.address, "✅ Task 1004 completed.");
        log("", "");
    } catch (error) {
        log(wallet.address, `❌ Error: ${error.message}`);
    }
}

// Process 50 wallets concurrently for daily tasks
async function startClaiming() {
    const privateKeys = JSON.parse(fs.readFileSync("privateKeys.json"));
    const wallets = privateKeys.map(privateKey => new ethers.Wallet(privateKey));

    fs.writeFileSync(logFile, "");
    header();

    const taskPromises = wallets.slice(0, 50).map(wallet => {
        log(wallet.address, `🔹 Processing wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);
        return sendDailyTask(wallet);
    });

    // Wait for all wallet tasks to finish
    await Promise.all(taskPromises);
    log("", "✅ All tasks completed for 50 wallets.");
}

// Main entry point for the combined process
async function main() {
    await runTransaction();  // First run transactions for wallets
    await startClaiming();   // After successful transactions, run claiming
}

main();
