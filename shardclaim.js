const fs = require('fs');
const fetch = require('node-fetch');  // Ensure node-fetch is imported correctly
const { ethers, JsonRpcProvider } = require('ethers');
const axios = require('axios');
const moment = require('moment-timezone');
const path = require('path');
require('colors');

// RPC Providers Setup
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

// Utility functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logFile = "log.txt";
function logToFile(message) {
    fs.appendFileSync(logFile, message + "\n", "utf8");
}

function log(address, message) {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const logMessage = address 
        ? `[${timestamp} | ${maskedAddress(address)}] ${message}`
        : "";

    console.log(logMessage);
    logToFile(logMessage);
}

const maskedAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

// Function to get challenge from the API
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

// Function to sign the challenge
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

// Main bot loop
async function startBot() {
    fs.writeFileSync(logFile, "");
    header();

    // Load private keys from file
    const privateKeys = fs.readFileSync('privatekeys.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);

    for (const privateKey of privateKeys) {
        const wallet = new ethers.Wallet(privateKey);
        log(wallet.address, `🔹 Processing wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);
        await sendDailyTask(wallet);
    }
}

startBot();
