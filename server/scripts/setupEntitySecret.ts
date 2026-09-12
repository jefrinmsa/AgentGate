import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { generateEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

// Ensure .env from server package is loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  console.log("==========================================================");
  console.log("       Circle Developer-Controlled Wallets Setup          ");
  console.log("       Generate Entity Secret & Registration Ciphertext    ");
  console.log("==========================================================\n");

  const apiKey = process.env.CIRCLE_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.error("❌ ERROR: CIRCLE_API_KEY is not set in server/.env");
    console.error("Please add your CIRCLE_API_KEY to server/.env and try again.\n");
    process.exit(1);
  }

  // 1. Generate a new 32-byte hex entity secret (64 hex characters)
  const entitySecret = crypto.randomBytes(32).toString("hex");

  console.log("----------------------------------------------------------");
  console.log("🔑 NEW 32-BYTE ENTITY SECRET (SAVE THIS SECURELY):");
  console.log("----------------------------------------------------------");
  console.log(entitySecret);
  console.log("----------------------------------------------------------");
  console.log("⚠️  IMPORTANT: Do NOT lose this secret! It cannot be recovered.");
  console.log("   Once registered in the Circle Console, copy it to server/.env as:");
  console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret}`);
  console.log("   (This secret is NOT saved to any file automatically).\n");

  // 2. Encrypt the entity secret using Circle's public key to create the ciphertext
  console.log("Fetching Circle's public key and generating Entity Secret Ciphertext...");

  try {
    const entitySecretCiphertext = await generateEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });

    console.log("\n----------------------------------------------------------");
    console.log("📦 ENTITY SECRET CIPHERTEXT:");
    console.log("----------------------------------------------------------");
    console.log(entitySecretCiphertext);
    console.log("----------------------------------------------------------\n");

    // 3. Clear registration instructions
    console.log("==========================================================");
    console.log("                  NEXT STEPS / INSTRUCTIONS               ");
    console.log("==========================================================");
    console.log("1. Open the Circle Developer Console in your browser:");
    console.log("   👉 https://console.circle.com/wallets/dev/config\n");
    console.log("2. In the \"Entity Secret\" or \"Developer Controlled Wallets\" section,");
    console.log("   click \"Register Entity Secret\".\n");
    console.log("3. Paste the entire CIPHERTEXT printed above into the registration field.\n");
    console.log("4. Complete the registration (and download the recovery file if prompted).\n");
    console.log("5. After registration completes, update server/.env with:");
    console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret}`);
    console.log("   CIRCLE_WALLET_SET_ID=<your-wallet-set-id-from-circle-console>\n");
    console.log("==========================================================\n");
  } catch (error: any) {
    console.error("\n❌ Failed to generate Entity Secret Ciphertext via Circle API:");
    console.error(error?.response?.data || error?.message || error);
    console.error("\nPlease verify that your CIRCLE_API_KEY in server/.env is valid and active.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
