import { Readability } from "@mozilla/readability";
import axios from "axios";
/**
 * Content extraction utilities using axios + jsdom + Readability.
 * No browser automation required.
 */
import { JSDOM } from "jsdom";
import { CONFIG } from "../server/config.js";
import type { PageContentResult } from "../types/index.js";
import { fetchSimpleContent } from "./fetch.js";
import { logError, logInfo, logWarn } from "./logging.js";

// Helper functions for content extraction
function detectAndRewriteGitHubUrl(
  originalUrl: string,
): { extractionUrl: string; isGitHubRepo: boolean } {
  try {
    const parsedUrl = new URL(originalUrl);
    if (parsedUrl.hostname === "github.com") {
      const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
      if (pathParts.length === 2) {
        const gitingestUrl = `https://gitingest.com${parsedUrl.pathname}`;
        logInfo(`Detected GitHub repo URL. Rewriting to: ${gitingestUrl}`);
        return { extractionUrl: gitingestUrl, isGitHubRepo: true };
      }
    }
  } catch (urlParseError) {
    logWarn(`Failed to parse URL for GitHub check: ${urlParseError}`);
  }
  return { extractionUrl: originalUrl, isGitHubRepo: false };
}

async function performContentTypeCheck(
  extractionUrl: string,
  isGitHubRepo: boolean,
  originalUrl: string,
): Promise<PageContentResult | null> {
  if (isGitHubRepo) {
    return null; // Skip content type check for GitHub repos
  }

  try {
    logInfo(`Performing HEAD request for ${extractionUrl}...`);
    const headResponse = await axios.head(extractionUrl, {
      timeout: 5000,
      headers: { "User-Agent": CONFIG.USER_AGENT },
    });
    const contentType = headResponse.headers["content-type"];
    logInfo(`Content-Type: ${contentType}`);

    if (contentType && typeof contentType === "string" && !contentType.includes("html") && !contentType.includes("text/plain")) {
      const errorMsg = `Unsupported content type: ${contentType}`;
      logError(errorMsg);
      return { url: originalUrl, error: errorMsg };
    }
  } catch (headError) {
    logWarn(
      `HEAD request failed for ${extractionUrl}: ${headError instanceof Error ? headError.message : String(headError)}. Proceeding with GET request.`,
    );
  }

  return null;
}

async function fetchPageHtml(extractionUrl: string): Promise<{ html: string; pageTitle: string }> {
  logInfo(`Fetching ${extractionUrl} for extraction...`);
  const response = await axios.get(extractionUrl, {
    timeout: CONFIG.TIMEOUT_PROFILES.navigation,
    headers: {
      "User-Agent": CONFIG.USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    maxRedirects: 3,
  });

  const html = typeof response.data === "string" ? response.data : String(response.data);

  // Extract title from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const pageTitle = titleMatch?.[1]?.trim() || "";

  return { html, pageTitle };
}

function extractGeneralContent(
  dom: JSDOM,
  originalUrl: string,
  pageTitle: string,
): PageContentResult | null {
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.textContent && article.textContent.trim().length > (article.title?.length || 0)) {
    logInfo(`Readability extracted content (${article.textContent.length} chars)`);
    return {
      url: originalUrl,
      title: article.title || pageTitle,
      textContent: article.textContent.trim(),
      error: null,
    };
  }

  return null;
}

function extractFallbackContent(
  dom: JSDOM,
  originalUrl: string,
  pageTitle: string,
): PageContentResult | null {
  logWarn("Readability failed. Attempting fallback selectors...");

  const document = dom.window.document;
  const selectors = [
    "article",
    "main",
    '[role="main"]',
    "#content",
    ".content",
    "#main",
    ".main",
    "#article-body",
    ".article-body",
    ".post-content",
    ".entry-content",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element?.innerText && element.innerText.trim().length > 100) {
      logInfo(`Fallback extracted content (${element.innerText.length} chars) using selector: ${selector}`);
      return {
        url: originalUrl,
        title: pageTitle,
        textContent: element.innerText.trim(),
        error: null,
      };
    }
  }

  // Advanced body text cleanup
  const bodyClone = document.body?.cloneNode(true) as HTMLElement | undefined;
  if (bodyClone) {
    const elementsToRemove = bodyClone.querySelectorAll(
      'nav, header, footer, aside, script, style, noscript, button, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"]',
    );

    for (const el of elementsToRemove) {
      el.remove();
    }

    const bodyText = bodyClone.innerText.trim();
    if (bodyText.length > 200) {
      logInfo(`Fallback using filtered body text (${bodyText.length} chars)`);
      return {
        url: originalUrl,
        title: pageTitle,
        textContent: bodyText,
        error: null,
      };
    }
  }

  return null;
}

function formatExtractionError(
  error: unknown,
  extractionUrl: string,
  originalUrl: string,
): PageContentResult {
  let errorMessage = `Failed to extract content from ${extractionUrl}.`;
  let errorReason = "Unknown error";

  if (error instanceof Error) {
    if (error.message.includes("timeout")) {
      errorReason = "Navigation or content loading timed out.";
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
      errorReason = "Could not resolve the URL.";
    } else if (error.message.includes("ECONNREFUSED")) {
      errorReason = "Connection refused.";
    } else if (error.message.includes("extract meaningful content")) {
      errorReason = "Readability and fallback selectors failed.";
    } else {
      errorReason = error.message;
    }
  }

  errorMessage += ` Reason: ${errorReason}`;
  return { url: originalUrl, error: errorMessage };
}

/**
 * Extracts content from a single page using axios and Readability.
 * Includes GitHub/Gitingest URL rewriting, content-type pre-checking, and fallback extraction.
 */
export async function fetchSinglePageContent(url: string): Promise<PageContentResult> {
  const originalUrl = url;

  // GitHub URL detection and rewriting
  const { extractionUrl, isGitHubRepo } = detectAndRewriteGitHubUrl(originalUrl);

  // Content-Type pre-check (skip for GitHub)
  const contentTypeError = await performContentTypeCheck(
    extractionUrl,
    isGitHubRepo,
    originalUrl,
  );
  if (contentTypeError) {
    return contentTypeError;
  }

  try {
    // Fetch page HTML via axios
    const { html, pageTitle } = await fetchPageHtml(extractionUrl);

    // Create JSDOM
    const dom = new JSDOM(html, {
      url: extractionUrl,
      resources: undefined,
      runScripts: "outside-only",
    });

    // Try general Readability extraction first
    const generalResult = extractGeneralContent(dom, originalUrl, pageTitle);
    if (generalResult) {
      return generalResult;
    }

    // Try fallback extraction
    const fallbackResult = extractFallbackContent(dom, originalUrl, pageTitle);
    if (fallbackResult) {
      return fallbackResult;
    }

    return { url: originalUrl, error: "No meaningful content extracted" };
  } catch (error) {
    logError(
      `Error extracting content from ${extractionUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return formatExtractionError(error, extractionUrl, originalUrl);
  }
}

/**
 * Extracts all same-domain links from a page's HTML.
 * Filters out non-HTTP(S), anchor, mailto, and JavaScript links. Resolves relative URLs.
 * @param html - The page HTML content
 * @param baseUrl - The base URL for resolving relative links
 * @returns Array of { url, text } for same-domain links
 */
export function extractSameDomainLinks(
  html: string,
  baseUrl: string,
): { url: string; text: string }[] {
  try {
    const baseHostname = new URL(baseUrl).hostname;
    const dom = new JSDOM(html, { url: baseUrl });
    const links = Array.from(dom.window.document.querySelectorAll("a[href]"))
      .map((link) => {
        const href = link.getAttribute("href");
        const text = (link as HTMLElement).innerText || link.textContent || "";
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("javascript:") ||
          href.startsWith("data:") ||
          href.startsWith("vbscript:") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:")
        ) {
          return null;
        }
        return { url: new URL(href, baseUrl).href, text: text.trim() };
      })
      .filter(Boolean) as { url: string; text: string }[];

    const resolvedLinks = links.filter((link) => {
      try {
        return new URL(link.url).hostname === baseHostname;
      } catch {
        return false;
      }
    });

    // Prioritize links with longer text, limit count
    resolvedLinks.sort((a, b) => b.text.length - a.text.length);
    return resolvedLinks.slice(0, 10);
  } catch (error) {
    // On error, return empty array
    return [];
  }
}

/**
 * Recursively fetches content from a root URL, exploring links up to maxDepth.
 * Uses fetchSinglePageContent and extractSameDomainLinks.
 * @param startUrl - The root URL to start crawling
 * @param maxDepth - Maximum recursion depth
 * @param currentDepth - Current recursion depth
 * @param visitedUrls - Set of already visited URLs
 * @param results - Array to collect PageContentResult
 * @param globalTimeoutSignal - Object with .timedOut boolean to abort on timeout
 */
export async function recursiveFetch(
  startUrl: string,
  maxDepth: number,
  currentDepth: number,
  visitedUrls: Set<string>,
  results: PageContentResult[],
  globalTimeoutSignal: { timedOut: boolean },
): Promise<void> {
  if (currentDepth > maxDepth || visitedUrls.has(startUrl) || globalTimeoutSignal.timedOut) {
    return;
  }
  logInfo(`[Depth ${currentDepth}] Fetching: ${startUrl}`);
  visitedUrls.add(startUrl);
  const pageResult: PageContentResult = {
    url: startUrl,
    title: null,
    textContent: null,
    error: null,
  };
  let linksToExplore: { url: string; text: string }[] = [];
  try {
    if (currentDepth === 1) {
      // Use Readability for the initial page
      const result = await fetchSinglePageContent(startUrl);
      pageResult.title = result.title;
      pageResult.textContent = result.textContent;
      pageResult.error = result.error || null;
      // Extract links from the fetched HTML for further exploration
      try {
        const response = await axios.get(startUrl, {
          timeout: 8000,
          headers: { "User-Agent": CONFIG.USER_AGENT },
        });
        const html = typeof response.data === "string" ? response.data : String(response.data);
        linksToExplore = extractSameDomainLinks(html, startUrl);
      } catch {
        // Ignore link extraction errors
      }
    } else {
      // Use the simpler fetch for deeper levels
      const result = await fetchSimpleContent(startUrl);
      pageResult.title = result.title;
      pageResult.textContent = result.textContent;
      pageResult.error = result.error || null;
    }
    if (pageResult.textContent === null && pageResult.error === null) {
      pageResult.error = "Failed to extract content";
    }
  } catch (error) {
    logError(
      `[Depth ${currentDepth}] Error fetching ${startUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
    pageResult.error = error instanceof Error ? error.message : String(error);
  }
  results.push(pageResult);
  // Explore links only if depth allows and initial fetch was successful
  if (currentDepth < maxDepth && !pageResult.error && linksToExplore.length > 0) {
    const linksToFollow = linksToExplore.slice(0, 3); // Limit to 3 links per page
    const promises = linksToFollow.map((link) => {
      if (globalTimeoutSignal.timedOut) return Promise.resolve();
      return recursiveFetch(
        link.url,
        maxDepth,
        currentDepth + 1,
        visitedUrls,
        results,
        globalTimeoutSignal,
      );
    });
    await Promise.all(promises);
  }
}
