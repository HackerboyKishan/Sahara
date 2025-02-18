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
                    private_key = line.strip()  # Now only reading the private key
                    accounts.append({"key": private_key})  # Store only the private key
                except ValueError:
                    print(f"Warning: Skipping incorrect line format -> {line}")
        self.accounts = accounts

    async def chanllge(self, account):
        try:
            # Now only using the private key
            private_key = account["key"]
            address = Account.privateKeyToAccount(private_key).address  # Derive address from private key

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
            print(f"❌ Error while processing challenge for account: {e}")
            self.mistakelist_chanllge.append(account)

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
            print(f"❌ Wallet failed: {e}")
            self.mistakelist_wallet.append(account)

    def sign_wallet_data(self, account, challenge):
        private_key = account["key"]
        # Derive the address from the private key
        address = Account.privateKeyToAccount(private_key).address

        message = f"Sign in to Sahara!\nChallenge:{challenge}"

        message_hash = encode_defunct(text=message)
        signed_message = Account.sign_message(message_hash, private_key)

        data = {
            "address": address,
            "sig": '0x' + signed_message.signature.hex(),
            "walletUUID": "0",  # UUID is no longer needed
            "walletName": "OKX Wallet"
        }

        return data
