import requests
import json

# Read wallet private keys from accounts.txt
def load_wallets(file_path):
    with open(file_path, 'r') as file:
        wallets = file.readlines()
    # Clean up any extra spaces/newlines
    return [wallet.strip() for wallet in wallets]

# Function to login and get the token using the private key
def login_with_wallet(private_key):
    login_url = "https://legends.saharalabs.ai/api/v1/login/wallet"
    login_payload = {
        'private_key': private_key  # Assuming API accepts private key for login
    }
    login_response = requests.post(login_url, json=login_payload)
    
    if login_response.status_code == 200:
        print(f"Login successful for wallet: {private_key}")
        return login_response.json().get('token')
    else:
        print(f"Login failed for wallet: {private_key}")
        return None

# Function to claim the task
def claim_task(token):
    task_url = "https://legends.saharalabs.ai/api/v1/task/claim"
    headers = {
        'Authorization': f'Bearer {token}'
    }
    task_response = requests.post(task_url, headers=headers)
    
    if task_response.status_code == 200:
        print("Claim success!")
        return True
    else:
        print(f"Failed to claim task. Status code: {task_response.status_code}")
        return False

# Main function to handle login and task claiming for each wallet
def process_wallets(file_path):
    wallets = load_wallets(file_path)
    
    for wallet_private_key in wallets:
        print(f"Processing wallet: {wallet_private_key}")
        
        # Step 1: Login and get token
        token = login_with_wallet(wallet_private_key)
        
        if token:
            # Step 2: Claim the task if login was successful
            if not claim_task(token):
                print(f"Error claiming task for wallet: {wallet_private_key}")
        else:
            print(f"Skipping wallet due to login failure: {wallet_private_key}")
    
if __name__ == "__main__":
    # Specify the path to the accounts.txt file containing wallet private keys
    accounts_file = "accounts.txt"
    
    # Start processing all wallets
    process_wallets(accounts_file)
