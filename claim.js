import org.json.JSONObject;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Base64;
import java.security.Signature;

public class GobiBear {
    
    private List<String> privateKeys = new ArrayList<>();
    private List<String> mistakelistFlush = new ArrayList<>();
    private List<String> mistakelistClaim = new ArrayList<>();
    
    public GobiBear(List<String> privateKeys) {
        this.privateKeys = privateKeys;
        System.out.println("A total of " + this.privateKeys.size() + " private keys.");
        start();
        System.out.println("Mistake list for flush: " + mistakelistFlush);
        System.out.println("Mistake list for claim: " + mistakelistClaim);
    }

    public void start() {
        ExecutorService executorService = Executors.newFixedThreadPool(10); // Use thread pool to manage async tasks
        privateKeys.forEach(privateKey -> {
            executorService.submit(() -> {
                try {
                    flush(privateKey);
                    claim(privateKey);
                } catch (Exception e) {
                    System.out.println("Error handling private key " + privateKey + ": " + e.getMessage());
                }
            });
        });
        executorService.shutdown();
    }

    public void flush(String privateKey) {
        try {
            String address = getAddressFromPrivateKey(privateKey); // Generate address from private key
            String taskId = "1004"; // Example task ID
            String url = "https://legends.saharalabs.ai/api/v1/task/flush";
            String data = "{\"taskID\":\"" + taskId + "\"}";

            Map<String, String> headers = createHeaders(privateKey);

            String response = postRequest(url, data, headers);
            JSONObject jsonResponse = new JSONObject(response);

            // Handle response logic
            System.out.println("Flush response: " + jsonResponse);
        } catch (Exception e) {
            System.out.println("Failed to flush for private key: " + privateKey + " Error: " + e.getMessage());
            mistakelistFlush.add(privateKey);
        }
    }

    public void claim(String privateKey) {
        try {
            String address = getAddressFromPrivateKey(privateKey);
            String taskId = "1004"; // Example task ID
            String url = "https://legends.saharalabs.ai/api/v1/task/claim";
            String data = "{\"taskID\":\"" + taskId + "\"}";

            Map<String, String> headers = createHeaders(privateKey);

            String response = postRequest(url, data, headers);
            JSONObject jsonResponse = new JSONObject(response);

            if (jsonResponse.has("message")) {
                if (jsonResponse.getString("message").contains("has been claimed")) {
                    System.out.println("Task already claimed for address " + address);
                } else {
                    System.out.println("Retrying after 60 seconds...");
                    Thread.sleep(60000); // Wait for 60 seconds before retrying
                    claim(privateKey);
                }
            } else {
                System.out.println("Claim successful for address " + address);
            }
        } catch (Exception e) {
            System.out.println("Failed to claim for private key: " + privateKey + " Error: " + e.getMessage());
            mistakelistClaim.add(privateKey);
        }
    }

    private String getAddressFromPrivateKey(String privateKey) {
        // Using web3j library to derive the address from the private key
        // In real scenario, you can use the Web3j library to derive Ethereum address
        return "0x" + privateKey.substring(0, 40); // For simplicity, we'll just take a substring
    }

    private Map<String, String> createHeaders(String privateKey) {
        Map<String, String> headers = new HashMap<>();
        headers.put("accept", "application/json, text/plain, */*");
        headers.put("content-type", "application/json");
        headers.put("authorization", "Bearer " + privateKey);  // Assuming the private key as Bearer token
        return headers;
    }

    private String postRequest(String urlString, String data, Map<String, String> headers) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);

        for (Map.Entry<String, String> header : headers.entrySet()) {
            connection.setRequestProperty(header.getKey(), header.getValue());
        }

        connection.getOutputStream().write(data.getBytes(StandardCharsets.UTF_8));
        BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }

        return response.toString();
    }

    public static void main(String[] args) throws IOException {
        // Read private keys from file
        List<String> privateKeys = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new FileReader("accounts.txt"));
        String line;
        while ((line = reader.readLine()) != null) {
            privateKeys.add(line.trim()); // Add each private key to the list
        }
        reader.close();

        GobiBear gobiBear = new GobiBear(privateKeys);
    }
}
