require('dotenv').config();
const { JsonRpcProvider, ethers } = require('ethers');
const kleur = require("kleur");
const fs = require('fs');
const moment = require('moment-timezone');
const fetch = require('node-fetch').default;

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

// Run transactions for wallets sequentially
async function runTransaction() {
    // Read private keys from privatekeys.txt file
    const privateKeys = fs.readFileSync('privatekeys.txt', 'utf-8').split('\n').map(line => line.trim()).filter(line => line !== '');

    const totalWallets = privateKeys.length;
    console.log(`Detected ${totalWallets} wallets in privatekeys.txt.`);

    for (let i = 0; i < totalWallets; i++) {
        const privateKey = privateKeys[i];
        try {
            await sendTransaction(privateKey);
            console.log('');
            await delay(2000);  // Delay 2 seconds between transactions to prevent nonce issues
        } catch (error) {
            const errorMessage = `[${timelog()}] Error processing wallet ${i + 1}: ${error.message}`;
            console.log(kleur.red(errorMessage));
            appendLog(errorMessage);
        }
    }
}

// Main function to start the transaction and claiming process
async function main() {
    await runTransaction();  // Run transactions sequentially for wallets
    console.log("All transactions completed.");
}

main();
