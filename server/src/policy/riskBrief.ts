import "dotenv/config";
import { TrustRecord } from "../db/store.js";

// Calls an LLM to turn a flagged payment into a one-line, plain-English
// risk summary for the human approver, e.g.:
// "DataVault99 wants $340 for 'premium research access.' Never paid this
//  vendor before. This is 40x what you normally spend on API calls."
//
// generateRiskBrief({ counterpartyId, amount, description, trustHistory }) -> string

export interface GenerateRiskBriefParams {
  counterpartyId: string;
  amount: number | string;
  description: string;
  trustHistory?: TrustRecord | null;
}

const SYSTEM_PROMPT = `You are AgentGate's risk assessment engine. Provide a single-sentence, plain-English explanation of why a flagged AI agent payment was frozen for human approval.
Match this style exactly:
"DataVault99 wants $340 for 'premium research access.' Never paid this vendor before. This is 40x what you normally spend on API calls."
Return only the concise explanation sentence with no preamble, markdown, or quotation wrappers.`;

/**
 * Deterministic fallback brief in the target style if Anthropic API key is absent or unreachable.
 */
function generateFallbackBrief({
  counterpartyId,
  amount,
  description,
  trustHistory,
}: GenerateRiskBriefParams): string {
  const numericAmount = Number(amount);

  if (!trustHistory || !trustHistory.paymentCount || trustHistory.paymentCount <= 0) {
    return `${counterpartyId} wants $${numericAmount} for '${description}'. Never paid this vendor before. This payment exceeds the automatic approval limit.`;
  }

  if (trustHistory.averageAmount > 0) {
    const ratio = Math.round(numericAmount / trustHistory.averageAmount);
    return `${counterpartyId} wants $${numericAmount} for '${description}'. This is ${ratio}x what you normally spend with this vendor (average: $${trustHistory.averageAmount}).`;
  }

  return `${counterpartyId} wants $${numericAmount} for '${description}'. Amount exceeds current trust ceiling of $${trustHistory.totalPaid || 0}.`;
}

/**
 * Generates a one-sentence, plain-English risk explanation for a flagged payment
 * by calling the Anthropic API (claude-sonnet-4-6).
 *
 * @param params - { counterpartyId, amount, description, trustHistory }
 * @returns Plain-English explanation string
 */
export async function generateRiskBrief({
  counterpartyId,
  amount,
  description,
  trustHistory,
}: GenerateRiskBriefParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn(
      "[riskBrief] ANTHROPIC_API_KEY not configured. Using deterministic fallback brief."
    );
    return generateFallbackBrief({
      counterpartyId,
      amount,
      description,
      trustHistory,
    });
  }

  const historyContext =
    !trustHistory || !trustHistory.paymentCount || trustHistory.paymentCount <= 0
      ? "No prior transaction history. This is a brand-new counterparty."
      : `${trustHistory.paymentCount} previous transactions, total paid: $${trustHistory.totalPaid}, historical average: $${trustHistory.averageAmount}, last outcome: '${trustHistory.lastOutcome}'.`;

  const userPrompt = `Payment details:
- Counterparty: ${counterpartyId}
- Requested Amount: $${amount}
- Description: "${description}"
- Counterparty History: ${historyContext}

Explain in a single sentence why this payment was flagged.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[riskBrief] Anthropic API returned HTTP ${response.status}: ${errorText}`
      );
      return generateFallbackBrief({
        counterpartyId,
        amount,
        description,
        trustHistory,
      });
    }

    const data: any = await response.json();
    const text = data?.content?.[0]?.text?.trim();

    if (text) {
      return text;
    }

    return generateFallbackBrief({
      counterpartyId,
      amount,
      description,
      trustHistory,
    });
  } catch (error: any) {
    console.error("[riskBrief] Failed to generate risk brief via Anthropic API:", error);
    return generateFallbackBrief({
      counterpartyId,
      amount,
      description,
      trustHistory,
    });
  }
}
