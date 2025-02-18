import uuid
from eth_account import Account

def generate_account_format():
    # Ask for the private key as input
    private_key = input("Enter your private key: ")
    
    try:
        # Generate account details from the private key
        account = Account.from_key(private_key)
        address = account.address  # Ethereum address
        key = private_key  # Private key
        # Generate a unique UUID
        unique_uuid = str(uuid.uuid4())

        # Combine the address, key, and UUID in the desired format
        account_info = f"{address}@{key}@{unique_uuid}"

        # Print to console
        print(f"Generated Account Info: {account_info}")
        
        # Save the result in account.txt
        with open("account.txt", "a") as file:
            file.write(account_info + "\n")

        print("Account info saved in 'account.txt'.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_account_format()
