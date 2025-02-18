import time
import os
import web3
import requests
import json
import asyncio
from web3 import Web3
from eth_account import Account

class Super_Testnet01:
    def __init__(self):
        self.mistakelist = []
        self.accounts = []
        self.start()

    def start(self):
        self.accounts = self.read_eth_accounts()
        asyncio.run(self.giveaway())  # Start the transfer process to random generated addresses
        print("[][][][]---Transfers are complete!---[][][][]")

    async def giveaway(self):
        value = 0.0000001
        to_address_list = []
        for i in range(len(self.accounts)):
            account = Account.create()  # Generate Ethereum account
            address = account.address  # Ethereum address
            to_address_list.append(address)
        
        w3 = self.connect_to_web3()
        
        # Creating tasks to transfer funds from each account to a randomly generated address
        tasks = [
            self.transfer(
                w3,
                Web3.to_checksum_address(from_address["address"]),
                from_address["key"],
                Web3.to_checksum_address(to_address),
                value
            )
            for from_address, to_address in zip(self.accounts, to_address_list)
        ]
        await asyncio.gather(*tasks)

    def get_recent_addresses(self, block_number, limit=100):
        url = 'https://testnet-explorer.saharalabs.ai/api/v2/transactions?block_number={}&index=19&items_count={}&filter=validated'.format(block_number, limit)
        result = requests.get(url).json()
        print(result)

    def connect_to_web3(self):
        # Connect to the Sahara Labs testnet
        rpc_url = "https://testnet.saharalabs.ai"
        w3 = Web3(Web3.HTTPProvider(rpc_url))

        # Check if the connection is successful
        if not w3.is_connected():
            raise Exception("Unable to connect to Sahara Labs testnet")
        return w3

    async def transfer(self, w3, from_address, private_key, to_address, value):
        try:
            # Get the nonce
            nonce = w3.eth.get_transaction_count(from_address)

            # Construct the transaction
            tx = {
                "nonce": nonce,
                "to": to_address,
                "value": Web3.to_wei(value, "ether"),  # 0.0000001 Sahara
                "gas": 21000,  # 0x5208
                "gasPrice": w3.eth.gas_price,  # You can set manually
                "chainId": w3.eth.chain_id,
            }

            # Sign the transaction with private key
            signed_tx = w3.eth.account.sign_transaction(tx, private_key)

            # Send the transaction
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            # Get transaction hash
            print(f"Transaction sent, hash: {tx_hash.hex()}")
            # Wait for transaction receipt (optional)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"✅ Transaction successful, block number: {receipt['blockNumber']}")
            return tx_hash.hex()
        except Exception as e:
            print(f"❌ Address: from_address: {from_address} to_address: {to_address}. Transfer failed: {e}")
            self.mistakelist.append({"from_address": from_address, "to_address": to_address})

    def read_eth_accounts(self, filename="accounts.txt"):
        accounts = []
        # Check if the file exists
        if not os.path.exists(filename):
            print(f"File {filename} does not exist.")
            return accounts
        
        with open(filename, "r") as file:
            for line in file:
                line = line.strip()  # Remove newline character
                if not line:
                    continue  # Skip empty lines
                try:
                    address, key, uid = line.split("@")  # Split by "@"
                    accounts.append({"address": address, "key": key, "uuid": uid})
                except ValueError:
                    print(f"Warning: Skipping incorrectly formatted line -> {line}")
        return accounts


if __name__ == '__main__':
    Super_Testnet01 = Super_Testnet01()
    input("Press Enter to exit...")
