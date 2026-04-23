/**
 * Utility for simple HTTP content fetching and basic HTML/text extraction.
 * @param url - The URL to fetch
 * @returns { title, textContent, error }
 */
import { Readability } from "@mozilla/readability";
import axios from "axios";
import { JSDOM } from "jsdom";
import { CONFIG } from "../server/config.js";
import { logError, logInfo, logWarn } from "./logging.js";

// Helper functions for fetch content
async function performHttpRequest(url: string) {
  logInfo(`Simple fetch starting for: ${url}`);

  const response = await axios.get(url, {
    timeout: 8000,
    headers: {
      "User-Agent": CONFIG.USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    validateStatus: (status) => status >= 200 && status < 400,
    maxRedirects: 3,
  });

  return response;
}

function validateContentType(contentType: string): string | null {
  if (
    !contentType.includes("html") &&
    !contentType.includes("text/plain") &&
    !contentType.includes("text/")
  ) {
    const errorMsg = `Unsupported content type: ${contentType}`;
    logWarn(errorMsg);
    return errorMsg;
  }
  return null;
}

function validateResponseData(data: unknown): string | null {
  if (typeof data !== "string") {
    const errorMsg = "Response data is not a string";
    logWarn(errorMsg);
    return errorMsg;
  }
  return null;
}

function extractHtmlContent(
  dom: JSDOM,
): { title: string | null; textContent: string } {
  let title = dom.window.document.title ?? null;
  let textContent = "";

  // Try Readability first for better content extraction
  try {
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article?.textContent && article.textContent.trim().length > 100) {
      title = article.title ?? title;
      textContent = article.textContent.trim();
      logInfo(`Readability extraction successful (${textContent.length} chars)`);
    } else {
      // Fallback to body text extraction
      textContent = dom.window.document.body?.textContent ?? "";
      logInfo("Readability failed, using body text extraction");
    }
  } catch (readabilityError) {
    logWarn(`Readability failed: ${readabilityError}, falling back to body text`);
    textContent = dom.window.document.body?.textContent ?? "";
  }

  return { title, textContent };
}

function extractContent(
  contentType: string,
  responseData: string,
  url: string,
): { title: string | null; textContent: string } {
  const dom = new JSDOM(responseData, { url });

  if (contentType.includes("html")) {
    return extractHtmlContent(dom);
  }

  // For non-HTML content, just get the text
  return { title: dom.window.document.title ?? null, textContent: responseData };
}

function processTextContent(
  textContent: string,
): { processedContent: string | null; error?: string } {
  // Clean up the text content
  let processed = textContent.replace(/\s+/g, " ").trim();

  if (processed.length > 15000) {
    // Truncate if too long
    processed = `${processed.substring(0, 15000)}... (content truncated)`;
    logInfo("Content truncated due to length");
  }

  if (processed.length < 50) {
    const errorMsg = "Extracted content is too short to be meaningful";
    logWarn(errorMsg);
    return { processedContent: null, error: errorMsg };
  }

  return { processedContent: processed };
}

function formatAxiosError(
  axiosError: Error & { response?: { status?: number; statusText?: string }; code?: string },
): string {
  if (axiosError.response?.status) {
    const status = axiosError.response.status;
    if (status >= 400 && status < 500) {
      return `Client error (${status}): ${axiosError.response.statusText ?? "Unknown error"}`;
    }
    if (status >= 500) {
      return `Server error (${status}): ${axiosError.response.statusText ?? "Unknown error"}`;
    }
    return `HTTP error (${status}): ${axiosError.response.statusText ?? "Unknown error"}`;
  }

  if (axiosError.code) {
    // Network errors
    switch (axiosError.code) {
      case "ECONNABORTED":
        return "Request timeout - server took too long to respond";
      case "ENOTFOUND":
        return "DNS resolution failed - domain not found";
      case "ECONNREFUSED":
        return "Connection refused - server is not accepting connections";
      case "ECONNRESET":
        return "Connection reset - network connection was interrupted";
      case "ETIMEDOUT":
        return "Connection timeout - failed to establish connection";
      default:
        return `Network error (${axiosError.code}): ${axiosError.message}`;
    }
  }

  return `Request failed: ${axiosError.message}`;
}

function formatErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return `Unexpected error: ${String(error)}`;
  }

  const errorDetails = error.message;

  if (error.name === "AxiosError" && "response" in error) {
    const axiosError = error as Error & {
      response?: { status?: number; statusText?: string };
      code?: string;
    };
    return formatAxiosError(axiosError);
  }

  if (errorDetails.includes("timeout")) {
    return "Request timeout - server took too long to respond";
  }
  if (errorDetails.includes("ENOTFOUND")) {
    return "DNS resolution failed - domain not found";
  }
  if (errorDetails.includes("ECONNREFUSED")) {
    return "Connection refused - server is not accepting connections";
  }

  return `Request failed: ${errorDetails}`;
}

export async function fetchSimpleContent(
  url: string,
): Promise<{ title: string | null; textContent: string | null; error?: string }> {
  try {
    const response = await performHttpRequest(url);

    const rawContentType = response.headers["content-type"] ?? "";
    const contentType = typeof rawContentType === "string" ? rawContentType : String(rawContentType);
    logInfo(`Content-Type: ${contentType}, Status: ${response.status}`);

    const contentTypeError = validateContentType(contentType);
    if (contentTypeError) {
      return { title: null, textContent: null, error: contentTypeError };
    }

    const dataError = validateResponseData(response.data);
    if (dataError) {
      return { title: null, textContent: null, error: dataError };
    }

    const { title, textContent } = extractContent(contentType, response.data, url);
    const { processedContent, error: processingError } = processTextContent(textContent);

    if (processingError ?? !processedContent) {
      return { title, textContent: null, error: processingError };
    }

    logInfo(`Simple fetch successful (${processedContent.length} chars)`);
    return { title, textContent: processedContent };
  } catch (error: unknown) {
    const errorMsg = formatErrorMessage(error);
    logError(`Simple fetch failed for ${url}: ${errorMsg}`);
    return { title: null, textContent: null, error: errorMsg };
  }
}
