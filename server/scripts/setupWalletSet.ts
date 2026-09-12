import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

async function main() {
  console.log("==========================================================");
  console.log("          AgentGate - Wallet Set Initialization           ");
  console.log("==========================================================\n");

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("❌ Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in server/.env");
    process.exit(1);
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log("Checking for existing Wallet Sets in Circle Console...");
  let walletSetId: string | undefined;

  try {
    const listRes = await client.listWalletSets();
    const existingSets = listRes.data?.walletSets || [];

    if (existingSets.length > 0) {
      walletSetId = existingSets[0].id;
      console.log(`✅ Found existing Wallet Set "${existingSets[0].name || "Default"}": ${walletSetId}`);
    } else {
      console.log("Creating a new Wallet Set: 'AgentGate Wallets'...");
      const createRes = await client.createWalletSet({
        name: "AgentGate Wallets",
      });
      walletSetId = createRes.data?.walletSet?.id;
      console.log(`✅ Successfully created Wallet Set: ${walletSetId}`);
    }

    if (walletSetId) {
      // Update server/.env with CIRCLE_WALLET_SET_ID
      let envContent = fs.readFileSync(envPath, "utf-8");
      if (envContent.includes("CIRCLE_WALLET_SET_ID=")) {
        envContent = envContent.replace(
          /CIRCLE_WALLET_SET_ID=.*/,
          `CIRCLE_WALLET_SET_ID=${walletSetId}`
        );
      } else {
        envContent += `\nCIRCLE_WALLET_SET_ID=${walletSetId}\n`;
      }
      fs.writeFileSync(envPath, envContent, "utf-8");
      console.log(`✅ Saved CIRCLE_WALLET_SET_ID to server/.env!\n`);
      console.log("==========================================================");
      console.log("🎉 Setup complete! You can now run:");
      console.log("   npm run test:payments");
      console.log("==========================================================\n");
    }
  } catch (error: any) {
    console.error("❌ Failed to query or create Wallet Set via Circle SDK:");
    console.error(error?.response?.data || error?.message || error);
    console.log("\nMake sure you have clicked the blue confirmation button in Circle Console:");
    console.log("\"I've safely saved my entity secret and downloaded my recovery files\"");
    process.exit(1);
  }
}

main();
