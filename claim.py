import time
import asyncio
import requests
import json
import os
import uuid
import random
import string
from eth_account import Account
from eth_account.messages import encode_defunct

class Gobi_Bear:
    def __init__(self, login_info):
        self.mistakelist_flush = []
        self.mistakelist_claim = []
        self.login_info = login_info  # list
        print(f"Total number of accounts: {len(self.login_info)}.")
        self.start()
        print(f"mistakelist_flush: {self.mistakelist_flush}")
        print(f"mistakelist_claim: {self.mistakelist_claim}")

    def start(self):
        asyncio.run(self.task_flush())
        print("All flush actions completed!")
        asyncio.run(self.task_claim())
        print("All claim actions completed!")

    async def task_flush(self):
        tasks = [self.flush("1004", login_info) for login_info in self.login_info]
        await asyncio.gather(*tasks)

    async def task_claim(self):
        tasks = [self.claim("1004", login_info) for login_info in self.login_info]
        await asyncio.gather(*tasks)

    async def flush(self, task_id, login_info):
        try:
            url = 'https://legends.saharalabs.ai/api/v1/task/flush'
            data = {"taskID": task_id}
            headers = {
                "accept": "application/json, text/plain, */*",
                "accept-encoding": "gzip, deflate, br, zstd",
                "accept-language": "en;q=0.8",
                "authorization": 'Bearer ' + login_info["accessToken"],
                "content-type": "application/json",
                "origin": "https://legends.saharalabs.ai",
                "priority": "u=1, i",
                "referer": "https://legends.saharalabs.ai",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            }
            result = requests.post(url, data=json.dumps(data), headers=headers)
            print(result)
        except Exception as e:
            address = login_info["username"]
            print(f"❌ Address: {address} flush failed: {e}")
            self.mistakelist_flush.append(address)

    async def claim(self, task_id, login_info):
        try:
            address = login_info["username"]
            accessToken = login_info["accessToken"]
            url = 'https://legends.saharalabs.ai/api/v1/task/claim'
            data = {"taskID": task_id}
            headers = {
                "accept": "application/json, text/plain, */*",
                "accept-encoding": "gzip, deflate, br, zstd",
                "accept-language": "en;q=0.8",
                "authorization": 'Bearer ' + accessToken,
                "content-type": "application/json",
                "origin": "https://legends.saharalabs.ai",
                "priority": "u=1, i",
                "referer": "https://legends.saharalabs.ai",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            }
            result = requests.post(url, data=json.dumps(data), headers=headers)
            result = result.json()

            if 'message' in result:
                if 'has been claimed' in result["message"]:
                    print(f"Task {task_id}: Already claimed.")
                else:
                    print("Waiting 60 seconds before trying again.")
                    time.sleep(60)
                    print(result)
            else:
                earned = result[0]["amount"]
                print(f"✅ Address: {address} claim successful. Earned: {earned} points.")
        except Exception as e:
            address = login_info["username"]
            print(f"❌ Address: {address} claim failed: {e}")
            self.mistakelist_claim.append(address)

class Sahara_Login:
    def __new__(cls):
        instance = super().__new__(cls)
        instance.mistakelist_wallet = []
        instance.mistakelist_chanllge = []
        instance.chanllges = []
        instance.login_info = []
        instance.accounts = []
        instance.read_eth_accounts()
        instance.start()
        return instance.login_info

    def start(self):
        print(self.accounts)
        asyncio.run(self.task_chanllge())
        asyncio.run(self.task_wallet())
        print(f"mistakelist_chanllge: {self.mistakelist_chanllge}")
        print(f"mistakelist_wallet: {self.mistakelist_wallet}")

    async def task_chanllge(self):
        tasks = [self.chanllge(account) for account in self.accounts]
        await asyncio.gather(*tasks)

    async def task_wallet(self):
        tasks = [self.wallet(self.sign_wallet_data(chanllge["account"], chanllge["challenge"])) for chanllge in self.chanllges]
        await asyncio.gather(*tasks)

    def read_eth_accounts(self, filename="accounts.txt"):
        accounts = []
        if not os.path.exists(filename):
            print(f"File {filename} does not exist.")
        with open(filename, "r") as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                try:
                    address, key, uid = line.split("@")
                    accounts.append({"address": address, "key": key, "uuid": uid})
                except ValueError:
                    print(f"Warning: Skipping incorrect line format -> {line}")
        self.accounts = accounts

    async def chanllge(self, account):
        try:
            address = account["address"]
            url = 'https://legends.saharalabs.ai/api/v1/user/challenge'
            data = {"address": address}
            headers = {
                "accept": "application/json, text/plain, */*",
                "accept-encoding": "gzip, deflate, br, zstd",
                "accept-language": "en;q=0.8",
                "content-type": "application/json",
                "origin": "https://legends.saharalabs.ai",
                "priority": "u=1, i",
                "referer": "https://legends.saharalabs.ai",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            }
            result = requests.post(url, data=json.dumps(data), headers=headers).json()
            if "challenge" in result:
                challenge = result["challenge"]
                self.chanllges.append({"account": account, "challenge": challenge})
            else:
                print("Challenge failed!")
                challenge = None

            return challenge
        except Exception as e:
            address = account["address"]
            print(f"❌ Address: {address} challenge failed: {e}")
            self.mistakelist_chanllge.append(address)

    async def wallet(self, data):
        try:
            url = 'https://legends.saharalabs.ai/api/v1/login/wallet'
            headers = {
                "accept": "application/json, text/plain, */*",
                "accept-encoding": "gzip, deflate, br, zstd",
                "accept-language": "en;q=0.8",
                "content-type": "application/json",
                "origin": "https://legends.saharalabs.ai",
                "priority": "u=1, i",
                "referer": "https://legends.saharalabs.ai",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            }
            login_info = requests.post(url, data=json.dumps(data), headers=headers).json()
            print(login_info)
            if "accessToken" in login_info:
                accessToken = login_info["accessToken"]
            else:
                print("Failed to get accessToken!")
                accessToken = None
            self.login_info.append(login_info)

        except Exception as e:
            address = data["address"]
            print(f"❌ Address: {address} wallet failed: {e}")
            self.mistakelist_wallet.append(address)

    def sign_wallet_data(self, account, challenge):
        address = account["address"]
        private_key = account["key"]
        walletUUID = account["uuid"]
        message = f"Sign in to Sahara!\nChallenge:{challenge}"

        message_hash = encode_defunct(text=message)
        signed_message = Account.sign_message(message_hash, private_key)

        data = {
            "address": address,
            "sig": '0x' + signed_message.signature.hex(),
            "walletUUID": walletUUID,
            "walletName": "OKX Wallet"
        }

        return data

if __name__ == '__main__':
    login_info = Sahara_Login()
    print(login_info)
    GB = Gobi_Bear(login_info)
    input("Press Enter to exit...")

