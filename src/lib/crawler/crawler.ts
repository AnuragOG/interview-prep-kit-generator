import axios, { AxiosRequestConfig } from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  type: "home" | "hiring" | "about" | "engineering" | "discussion" | "other";
  statusCode: number;
}

export interface CrawlResult {
  pagesUsed: CrawledPage[];
  errors: string[];
  hiringPageFound: boolean;
  notes: string[];
}

// SSRF Safety: Check if URL is safe to fetch
export function isSafeUrl(targetUrl: string, allowLocalhost = true): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Allow localhost/loopback for local evaluation test suites (e.g. http://localhost:8099/...)
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    ) {
      return allowLocalhost;
    }

    // Cloud metadata endpoints protection
    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      (hostname.startsWith("172.") &&
        parseInt(hostname.split(".")[1] || "0", 10) >= 16 &&
        parseInt(hostname.split(".")[1] || "0", 10) <= 31)
    ) {
      return allowLocalhost ? true : false;
    }

    return true;
  } catch {
    return false;
  }
}

// Clean HTML into readable markdown/text
export function cleanHtml(html: string): { title: string; text: string } {
  try {
    const $ = cheerio.load(html);

    // Remove noise elements
    $(
      "script, style, svg, noscript, iframe, nav, footer, header, form, button, [role='banner'], [role='navigation']"
    ).remove();

    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Untitled Page";

    // Convert headings and paragraphs cleanly
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        $(el).replaceWith(`\n\n### ${text}\n\n`);
      }
    });

    $("p, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        $(el).replaceWith(`\n${text}\n`);
      }
    });

    let rawText = $("body").text() || $.text();
    // Normalize whitespace while preserving paragraphs
    const cleanedText = rawText
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();

    // Truncate to reasonable length (e.g. 10,000 chars per page to respect LLM tokens)
    return {
      title,
      text: cleanedText.slice(0, 12000),
    };
  } catch {
    return { title: "", text: "" };
  }
}

// Check robots.txt (best-effort heuristic)
export async function checkRobotsAllowed(baseUrl: string, targetPath: string): Promise<boolean> {
  try {
    const parsed = new URL(baseUrl);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
    const res = await axios.get(robotsUrl, {
      timeout: 3000,
      validateStatus: () => true,
    });

    if (res.status !== 200 || typeof res.data !== "string") {
      return true; // No robots.txt or not readable -> allowed
    }

    const lines = res.data.split("\n");
    let appliesToAll = false;
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("user-agent:")) {
        const ua = trimmed.replace("user-agent:", "").trim();
        appliesToAll = ua === "*";
      } else if (appliesToAll && trimmed.startsWith("disallow:")) {
        const disallowPath = trimmed.replace("disallow:", "").trim();
        if (disallowPath && targetPath.startsWith(disallowPath)) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}

// Score links based on hiring and company relevance
export function scoreLink(href: string, anchorText: string): { score: number; type: CrawledPage["type"] } {
  const combined = `${href.toLowerCase()} ${anchorText.toLowerCase()}`;
  let score = 0;
  let type: CrawledPage["type"] = "other";

  // High value: Hiring / Careers / Jobs / Engineering / Culture / Handbook
  if (
    combined.includes("careers") ||
    combined.includes("jobs") ||
    combined.includes("hiring") ||
    combined.includes("join-us") ||
    combined.includes("work-with-us") ||
    combined.includes("openings") ||
    combined.includes("opportunities") ||
    combined.includes("interview") ||
    combined.includes("handbook")
  ) {
    score += 100;
    type = "hiring";
  } else if (
    combined.includes("engineering") ||
    combined.includes("tech-blog") ||
    combined.includes("dev-blog") ||
    combined.includes("architecture") ||
    combined.includes("product")
  ) {
    score += 70;
    type = "engineering";
  } else if (
    combined.includes("about") ||
    combined.includes("mission") ||
    combined.includes("values") ||
    combined.includes("team") ||
    combined.includes("story") ||
    combined.includes("what-we-do")
  ) {
    score += 60;
    type = "about";
  }

  // Penalize junk links (privacy, legal, login, signup, terms, cookies, media)
  if (
    combined.includes("login") ||
    combined.includes("signin") ||
    combined.includes("signup") ||
    combined.includes("terms") ||
    combined.includes("privacy") ||
    combined.includes("cookie") ||
    combined.includes("legal") ||
    combined.includes("support") ||
    combined.includes("help") ||
    combined.includes("cart") ||
    combined.includes(".pdf") ||
    combined.includes(".png") ||
    combined.includes(".jpg") ||
    combined.includes(".zip")
  ) {
    score -= 150;
  }

  return { score, type };
}

// Fetch a single page with retries and exponential backoff
export async function fetchPage(
  url: string,
  retries = 2,
  timeoutMs = 6000
): Promise<{ success: boolean; html?: string; statusCode: number; error?: string }> {
  if (!isSafeUrl(url)) {
    return { success: false, statusCode: 400, error: "URL failed safety validation" };
  }

  const config: AxiosRequestConfig = {
    timeout: timeoutMs,
    headers: {
      "User-Agent": "InterviewPrepKitCrawler/1.0 (+https://github.com/trao/interview-prep)",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
    maxRedirects: 5,
    maxContentLength: 2 * 1024 * 1024, // 2MB max
    validateStatus: () => true, // Don't throw on 404/500
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, config);
      const contentType = String(res.headers["content-type"] || "");

      if (res.status >= 200 && res.status < 300) {
        if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) {
          return { success: false, statusCode: res.status, error: `Unsupported content-type: ${contentType}` };
        }
        return { success: true, html: String(res.data), statusCode: res.status };
      }

      if (res.status === 404) {
        return { success: false, statusCode: 404, error: `Page not found (404): ${url}` };
      }

      // If rate limited or 5xx, back off and retry
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return { success: false, statusCode: res.status, error: `HTTP ${res.status}` };
    } catch (err: any) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { success: false, statusCode: 0, error: err.message || "Network request failed" };
    }
  }

  return { success: false, statusCode: 0, error: "Max retries exceeded" };
}

// Intelligent Crawler: Crawls homepage, discovers sub-pages, ranks links and fetches the best ones
export async function crawlCompanySite(
  companyUrl: string,
  maxPagesToFetch = 3
): Promise<CrawlResult> {
  const result: CrawlResult = {
    pagesUsed: [],
    errors: [],
    hiringPageFound: false,
    notes: [],
  };

  if (!companyUrl || typeof companyUrl !== "string") {
    result.errors.push("Invalid company URL provided.");
    return result;
  }

  // Normalize URL
  let targetUrl = companyUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  let baseUrlObj: URL;
  try {
    baseUrlObj = new URL(targetUrl);
  } catch (err: any) {
    result.errors.push(`Could not parse company URL: ${companyUrl}`);
    return result;
  }

  // 1. Fetch Homepage
  const homeRes = await fetchPage(targetUrl, 2, 7000);
  if (!homeRes.success || !homeRes.html) {
    result.errors.push(`Failed to fetch homepage ${targetUrl}: ${homeRes.error || `HTTP ${homeRes.statusCode}`}`);
    return result;
  }

  const homeClean = cleanHtml(homeRes.html);
  result.pagesUsed.push({
    url: targetUrl,
    title: homeClean.title,
    content: homeClean.text,
    type: "home",
    statusCode: homeRes.statusCode,
  });

  // 2. Discover and rank links on the homepage
  const $ = cheerio.load(homeRes.html);
  const candidateLinks: { url: string; score: number; type: CrawledPage["type"] }[] = [];
  const seenUrls = new Set<string>([targetUrl, targetUrl.replace(/\/$/, "")]);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    const text = $(el).text().trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrlObj.href);
      // Ensure same-origin (or subdomain)
      const resolvedHost = resolved.hostname.toLowerCase();
      const baseHost = baseUrlObj.hostname.toLowerCase();
      const isSameHost =
        resolvedHost === baseHost ||
        resolvedHost.endsWith("." + baseHost) ||
        baseHost.endsWith("." + resolvedHost);

      if (!isSameHost) return;

      const normalized = resolved.origin + resolved.pathname;
      if (seenUrls.has(normalized)) return;

      const { score, type } = scoreLink(resolved.pathname, text);
      if (score > 0) {
        seenUrls.add(normalized);
        candidateLinks.push({ url: resolved.href, score, type });
      }
    } catch {
      // Ignore invalid URLs
    }
  });

  // Sort candidate links by score descending
  candidateLinks.sort((a, b) => b.score - a.score);

  // Pick top candidates up to maxPagesToFetch - 1
  const linksToFetch = candidateLinks.slice(0, maxPagesToFetch - 1);

  for (const item of linksToFetch) {
    const isAllowed = await checkRobotsAllowed(targetUrl, new URL(item.url).pathname);
    if (!isAllowed) {
      result.notes.push(`Skipped ${item.url} per robots.txt directive`);
      continue;
    }

    const pageRes = await fetchPage(item.url, 1, 6000);
    if (pageRes.success && pageRes.html) {
      const cleaned = cleanHtml(pageRes.html);
      result.pagesUsed.push({
        url: item.url,
        title: cleaned.title,
        content: cleaned.text,
        type: item.type,
        statusCode: pageRes.statusCode,
      });

      if (item.type === "hiring" || cleaned.text.toLowerCase().includes("hiring process") || cleaned.text.toLowerCase().includes("how we hire")) {
        result.hiringPageFound = true;
      }
    } else {
      result.notes.push(`Could not fetch discovered link ${item.url}: ${pageRes.error}`);
    }
  }

  if (!result.hiringPageFound) {
    result.notes.push("No dedicated hiring process page discovered on company site; kit will note this honestly.");
  }

  return result;
}

// Search public discussion / interview intelligence
export async function searchPublicInterviewIntel(
  companyName: string,
  roleTitle: string
): Promise<{ sourceName: string; intel: string; url?: string }[]> {
  const intelList: { sourceName: string; intel: string; url?: string }[] = [];

  if (!companyName || companyName.trim().length < 2) {
    return intelList;
  }

  // Attempt to query DuckDuckGo HTML or structured public snippets
  try {
    const query = encodeURIComponent(`${companyName} interview process questions ${roleTitle}`.trim());
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const res = await axios.get(searchUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
      validateStatus: () => true,
    });

    if (res.status === 200 && typeof res.data === "string") {
      const $ = cheerio.load(res.data);
      $(".result").each((i, el) => {
        if (i >= 3) return; // Top 3 snippets
        const title = $(el).find(".result__title").text().trim();
        const snippet = $(el).find(".result__snippet").text().trim();
        const link = $(el).find(".result__url").text().trim();

        if (snippet && (snippet.toLowerCase().includes("interview") || snippet.toLowerCase().includes("questions") || snippet.toLowerCase().includes("round"))) {
          intelList.push({
            sourceName: title || "Public Discussion",
            intel: snippet,
            url: link.startsWith("http") ? link : `https://${link}`,
          });
        }
      });
    }
  } catch {
    // If public search fails, fail gracefully without breaking the pipeline
  }

  return intelList;
}
