import {
  getTextProviderOption,
  type TextProvider,
} from "@/lib/ai-providers";

export type TextProviderAction = "screenplay extraction" | "text generation" | "regeneration";

export class TextProviderRequestError extends Error {
  readonly provider: TextProvider;
  readonly status: number;

  constructor({
    message,
    provider,
    status,
  }: {
    message: string;
    provider: TextProvider;
    status: number;
  }) {
    super(message);
    this.name = "TextProviderRequestError";
    this.provider = provider;
    this.status = status;
  }
}

const AUTH_ERROR_RE =
  /(authentication|unauthorized|forbidden|permission|invalid.*(?:api key|key|token)|incorrect.*(?:api key|key|token)|expired.*(?:api key|key|token)|x-api-key|api key)/i;
const BILLING_ERROR_RE =
  /(billing|credit balance|insufficient(?:_| )quota|quota exceeded|exceeded your current quota|payment required|payment|prepaid|balance|subscription|usage limit)/i;
const RATE_LIMIT_ERROR_RE = /(rate limit|too many requests)/i;

export function mapTextProviderError(
  error: unknown,
  provider: TextProvider,
  action: TextProviderAction,
): TextProviderRequestError {
  if (error instanceof TextProviderRequestError) {
    return error;
  }

  const providerOption = getTextProviderOption(provider);
  const status = readStatus(error);
  const details = collectErrorText(error);
  const lowerDetails = details.toLowerCase();

  if (status === 401 || status === 403 || AUTH_ERROR_RE.test(lowerDetails)) {
    return new TextProviderRequestError({
      provider,
      status: 401,
      message: `Your ${providerOption.label} API key was rejected. Open Settings, check the selected provider and key, then try again.`,
    });
  }

  if (status === 402 || BILLING_ERROR_RE.test(lowerDetails)) {
    return new TextProviderRequestError({
      provider,
      status: 402,
      message: `Your ${providerOption.label} account needs billing or credits before Scriptlook can run ${action}. Add credits in ${providerOption.company}'s console, then try again.`,
    });
  }

  if (status === 429 || RATE_LIMIT_ERROR_RE.test(lowerDetails)) {
    return new TextProviderRequestError({
      provider,
      status: 429,
      message: `Your ${providerOption.label} rate limit was hit. Wait a minute, then try again.`,
    });
  }

  if (status !== null && status >= 500) {
    return new TextProviderRequestError({
      provider,
      status: 502,
      message: `${providerOption.label} is not responding cleanly right now. Wait a minute, then try again.`,
    });
  }

  const fallbackStatus = status && status >= 400 && status < 500 ? status : 500;
  const safeDetails = details.trim().slice(0, 280);

  return new TextProviderRequestError({
    provider,
    status: fallbackStatus,
    message: safeDetails
      ? `The selected text provider could not finish ${action}. ${providerOption.label} said: ${safeDetails}`
      : `The selected text provider could not finish ${action}. Try again in a moment.`,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStatus(error: unknown): number | null {
  if (error instanceof Error) {
    const statusMatch = error.message.match(/\b(?:api|status)\s+(\d{3})\b/i);
    if (statusMatch) return Number(statusMatch[1]);
  }

  if (!isRecord(error)) return null;

  const status = error.status;
  if (typeof status === "number") return status;

  const statusCode = error.statusCode;
  if (typeof statusCode === "number") return statusCode;

  return null;
}

function collectErrorText(error: unknown): string {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  }

  if (isRecord(error)) {
    for (const key of ["message", "type", "code"] as const) {
      const value = error[key];
      if (typeof value === "string") parts.push(value);
    }

    const nestedError = error.error;
    if (isRecord(nestedError)) {
      for (const key of ["message", "type", "code"] as const) {
        const value = nestedError[key];
        if (typeof value === "string") parts.push(value);
      }
    }
  }

  if (typeof error === "string") {
    parts.push(error);
  }

  return Array.from(new Set(parts.filter(Boolean))).join(" ");
}
