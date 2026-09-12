import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import "dotenv/config";

// Wraps Circle's Developer-Controlled Wallets API.
//
// createAgentWallet(agentId) -> wallet address on Arc
// getBalance(walletId) -> USDC balance

function getCircleClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error(
      "Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in environment"
    );
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

/**
 * Creates a developer-controlled wallet on the Arc testnet for a given agent.
 * Checks for existing wallet first, and retries on transient connection errors.
 *
 * @param agentId - Unique identifier of the agent
 * @returns The created or existing wallet's blockchain address on Arc
 */
export async function createAgentWallet(
  agentId: string
): Promise<string | undefined> {
  if (
    !process.env.CIRCLE_API_KEY ||
    !process.env.CIRCLE_ENTITY_SECRET ||
    !process.env.CIRCLE_WALLET_SET_ID
  ) {
    console.warn(
      `[circleWallets] Circle credentials not set. Generating mock Arc address for agent "${agentId}"...`
    );
    const mockAddress = `0x${Buffer.from(agentId).toString("hex").padEnd(40, "0").slice(0, 40)}`;
    return mockAddress;
  }

  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  const blockchain: any = process.env.ARC_BLOCKCHAIN || "ARC-TESTNET";

  // Retry up to 3 times to handle transient ECONNRESET or socket errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const client = getCircleClient();

      // Check if wallet already exists in the wallet set
      try {
        const existingWallets = await client.listWallets({ walletSetId });
        const found = existingWallets.data?.wallets?.find(
          (w) => w.refId === agentId || w.name === `agent-${agentId}`
        );
        if (found?.address) {
          console.log(
            `[circleWallets] Found existing Arc wallet for agent "${agentId}": ${found.address} (id: ${found.id})`
          );
          return found.address;
        }
      } catch {
        // Continue to create if listWallets failed
      }

      const response = await client.createWallets({
        blockchains: [blockchain],
        count: 1,
        walletSetId,
        metadata: [
          {
            name: `agent-${agentId}`,
            refId: agentId,
          },
        ],
      });

      const wallet = response.data?.wallets?.[0];
      const address = wallet?.address;

      console.log(
        `[circleWallets] Created Arc wallet for agent "${agentId}": ${address} (id: ${wallet?.id})`
      );
      return address;
    } catch (error: any) {
      if (attempt < 3) {
        console.warn(
          `[circleWallets] Attempt ${attempt} to create wallet for "${agentId}" encountered ${error.code || error.message}. Retrying in 1.5s...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        console.error(
          `[circleWallets] Failed to create wallet for agent "${agentId}" after 3 attempts:`,
          error
        );
        return undefined;
      }
    }
  }
}

/**
 * Retrieves the USDC balance for a given wallet (by wallet ID or address).
 *
 * @param walletId - Circle wallet ID or blockchain address
 * @returns USDC balance string (e.g. "150.00")
 */
export async function getBalance(
  walletId: string
): Promise<string | undefined> {
  if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
    console.warn(
      `[circleWallets] Circle credentials not set. Returning mock USDC balance for wallet "${walletId}"...`
    );
    return "100.00";
  }

  try {
    const client = getCircleClient();
    let targetWalletId = walletId;

    // If passed an EVM address, resolve the wallet ID first
    if (walletId.startsWith("0x")) {
      const walletsRes = await client.listWallets({ address: walletId });
      const matched = walletsRes.data?.wallets?.[0];
      if (matched?.id) {
        targetWalletId = matched.id;
      }
    }

    const response = await client.getWalletTokenBalance({
      id: targetWalletId,
    });

    const tokenBalances = response.data?.tokenBalances || [];
    const usdc = tokenBalances.find(
      (b) =>
        b.token?.symbol?.toUpperCase() === "USDC" ||
        b.token?.name?.toUpperCase().includes("USDC")
    );

    const balance = usdc?.amount ?? "0";
    console.log(
      `[circleWallets] USDC balance for wallet "${walletId}": ${balance}`
    );
    return balance;
  } catch (error) {
    console.error(
      `[circleWallets] Failed to get balance for wallet "${walletId}":`,
      error
    );
    return undefined;
  }
}
