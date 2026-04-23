import { Readability } from "@mozilla/readability";
import axios from "axios";
import { JSDOM } from "jsdom";
import { CONFIG } from "../server/config.js";
import type { PageContentResult } from "../types/index.js";
import { fetchSimpleContent } from "./fetch.js";

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
        console.log(`Detected GitHub repo URL. Rewriting to: ${gitingestUrl}`);
        return { extractionUrl: gitingestUrl, isGitHubRepo: true };
      }
    }
  } catch (urlParseError) {
    console.warn(`Failed to parse URL for GitHub check: ${urlParseError}`);
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
    console.log(`Performing HEAD request for ${extractionUrl}...`);
    const headResponse = await axios.head(extractionUrl, {
      timeout: 5000,
      headers: { "User-Agent": CONFIG.USER_AGENT },
    });
    const rawContentType = headResponse.headers["content-type"];
    const contentType = typeof rawContentType === "string" ? rawContentType : String(rawContentType);
    console.log(`Content-Type: ${contentType}`);

    if (contentType && !contentType.includes("html") && !contentType.includes("text/plain")) {
      const errorMsg = `Unsupported content type: ${contentType}`;
      console.error(errorMsg);
      return { url: originalUrl, error: errorMsg };
    }
  } catch (headError) {
    console.warn(
      `HEAD request failed for ${extractionUrl}: ${headError instanceof Error ? headError.message : String(headError)}. Proceeding with fetch.`,
    );
  }

  return null;
}

function extractGeneralContent(
  dom: JSDOM,
  originalUrl: string,
  pageTitle: string,
): PageContentResult | null {
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.textContent && article.textContent.trim().length > (article.title?.length || 0)) {
    console.log(`Readability extracted content (${article.textContent.length} chars)`);
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
  console.warn("Readability failed. Attempting fallback selectors...");

  const fallbackResult = (() => {
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
      const element = dom.window.document.querySelector(selector) as HTMLElement | null;
      if (element?.innerText && element.innerText.trim().length > 100) {
        console.log(`Fallback using selector: ${selector}`);
        return { text: element.innerText.trim(), selector: selector };
      }
    }

    // Advanced body text cleanup
    const bodyClone = dom.window.document.body.cloneNode(true) as HTMLElement;
    const elementsToRemove = bodyClone.querySelectorAll(
      'nav, header, footer, aside, script, style, noscript, button, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"]',
    );

    for (const el of elementsToRemove) {
      el.remove();
    }

    const bodyText = bodyClone.innerText.trim();
    if (bodyText.length > 200) {
      console.log("Fallback using filtered body text.");
      return { text: bodyText, selector: "body (filtered)" };
    }

    return null;
  })();

  if (fallbackResult) {
    console.log(
      `Fallback extracted content (${fallbackResult.text.length} chars) using selector: ${fallbackResult.selector}`,
    );
    return {
      url: originalUrl,
      title: pageTitle,
      textContent: fallbackResult.text,
      error: null,
    };
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
    } else if (error.message.includes("net::") || error.message.includes("Failed to load")) {
      errorReason = "Could not resolve or load the URL.";
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
 * Includes GitHub/Gitingest URL rewriting and content-type pre-checking.
 */
export async function fetchSinglePageContent(url: string): Promise<PageContentResult> {
  const originalUrl = url;

  // GitHub URL detection and rewriting
  const { extractionUrl, isGitHubRepo } = detectAndRewriteGitHubUrl(originalUrl);

  // Content-Type pre-check (skip for GitHub)
  const contentTypeError = await performContentTypeCheck(extractionUrl, isGitHubRepo, originalUrl);
  if (contentTypeError) {
    return contentTypeError;
  }

  try {
    console.log(`Fetching ${extractionUrl}...`);
    const response = await axios.get(extractionUrl, {
      timeout: CONFIG.TIMEOUT_PROFILES.navigation,
      headers: {
        "User-Agent": CONFIG.USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      maxRedirects: 3,
    });

    const html = response.data;
    const pageTitle = (() => {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return titleMatch ? titleMatch[1].trim() : extractionUrl;
    })();

    // Suppress CSS/HTML parsing output
    const virtualConsole = new (await import("jsdom")).VirtualConsole();
    virtualConsole.on("error", (err: string) => {
      if (!err.includes("Could not parse CSS") && !err.includes("Error parsing")) {
        console.warn(`JSDOM error: ${err}`);
      }
    });

    const dom = new JSDOM(html, {
      url: extractionUrl,
      virtualConsole,
      resources: undefined,
      runScripts: "outside-only",
    });

    // Try general Readability extraction
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
    console.error(
      `Error extracting content from ${extractionUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return formatExtractionError(error, extractionUrl, originalUrl);
  }
}

/**
 * Extracts all same-domain links from fetched HTML content.
 * Filters out non-HTTP(S), anchor, mailto, and JavaScript links. Resolves relative URLs.
 * @param html - The HTML content to parse
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
        return { url: href, text: text.trim() };
      })
      .filter(Boolean);

    const resolvedLinks: { url: string; text: string }[] = [];
    for (const link of links) {
      if (!link) continue;
      try {
        const absoluteUrl = new URL(link.url, baseUrl).href;
        if (new URL(absoluteUrl).hostname === baseHostname) {
          resolvedLinks.push({ url: absoluteUrl, text: link.text || absoluteUrl });
        }
      } catch {
        // Ignore invalid URLs
      }
    }
    // Prioritize links with longer text, limit count
    resolvedLinks.sort((a, b) => b.text.length - a.text.length);
    return resolvedLinks.slice(0, 10);
  } catch (error) {
    return [];
  }
}

/**
 * Recursively fetches content from a root URL, exploring links up to maxDepth.
 * Uses fetchSimpleContent and extractSameDomainLinks.
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
  console.log(`[Depth ${currentDepth}] Fetching: ${startUrl}`);
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
      // Use full extraction for the initial page
      const result = await fetchSinglePageContent(startUrl);
      pageResult.title = result.title;
      pageResult.textContent = result.textContent;
      pageResult.error = result.error || null;

      // Extract links for deeper exploration
      try {
        const response = await axios.get(startUrl, {
          timeout: 10000,
          headers: { "User-Agent": CONFIG.USER_AGENT },
          maxRedirects: 3,
        });
        linksToExplore = extractSameDomainLinks(response.data, startUrl);
      } catch {
        // Ignore link extraction errors
      }
    } else {
      // Use simpler fetch for deeper levels
      const result = await fetchSimpleContent(startUrl);
      pageResult.title = result.title;
      pageResult.textContent = result.textContent;
      pageResult.error = result.error || null;
    }

    if (pageResult.textContent === null && pageResult.error === null) {
      pageResult.error = "Failed to extract content";
    }
  } catch (error) {
    console.error(
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
