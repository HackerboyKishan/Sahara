require('dotenv').config();
const { JsonRpcProvider, ethers } = require('ethers');
const kleur = require("kleur");
const fs = require('fs');
const moment = require('moment-timezone');

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

// Run transaction for a single wallet using the private key
async function runTransaction() {
    const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));

    // Process each private key once (only one transaction per private key)
    for (const [index, privateKey] of PRIVATE_KEYS.entries()) {
        try {
            await sendTransaction(privateKey);
            console.log('');
            await delay(2000);  // Delay 2 seconds between transactions to prevent nonce issues
        } catch (error) {
            const errorMessage = `[${timelog()}] Error processing wallet ${index + 1}: ${error.message}`;
            console.log(kleur.red(errorMessage));
            appendLog(errorMessage);
        }
    }
}

// Time logging function
function timelog() {
  return moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
}

// Run the main transaction loop
runTransaction();
