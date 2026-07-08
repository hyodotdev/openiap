#!/usr/bin/env node
import { chromium, request as playwrightRequest } from "@playwright/test";

const DEFAULT_TIMEOUT_MS = Number(process.env.WEB_E2E_TIMEOUT_MS ?? 30_000);
const STRICT = process.env.WEB_E2E_STRICT === "1";
const DOCS_BASE_URL = normalizeBaseUrl(
  process.env.WEB_E2E_DOCS_BASE_URL ?? "https://www.openiap.dev",
);
const KIT_BASE_URL = normalizeBaseUrl(
  process.env.WEB_E2E_KIT_BASE_URL ?? "https://kit.openiap.dev",
);

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800, isMobile: true },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
  { name: "tablet", width: 768, height: 1024, isMobile: false },
  { name: "desktop", width: 1280, height: 900, isMobile: false },
];

const SITES = [
  {
    name: "docs",
    baseUrl: DOCS_BASE_URL,
    canonicalOrigins: ["https://openiap.dev", "https://www.openiap.dev"],
    routes: [
      "/",
      "/introduction",
      "/languages",
      "/docs/getting-started",
      "/docs/setup",
      "/docs/setup/store",
      "/docs/setup/store/amazon",
      "/docs/setup/store/horizon",
      "/docs/setup/store/onside",
      "/docs/updates/releases",
    ],
    apiRoutes: ["/llms.txt", "/llms-full.txt"],
  },
  {
    name: "iapkit",
    baseUrl: KIT_BASE_URL,
    canonicalOrigins: ["https://kit.openiap.dev"],
    routes: [
      "/",
      "/docs",
      "/docs/quickstart",
      "/docs/api",
      "/docs/verification/apple",
      "/about",
      "/contact",
      "/privacy-policy",
      "/terms-of-service",
      "/blog",
    ],
    apiRoutes: ["/health", "/v1", "/api/v1"],
  },
];

const CONSOLE_IGNORE = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Failed to load resource.*analytics/i,
  /Failed to load resource.*sentry/i,
  /Failed to load resource.*mixpanel/i,
];

const PERFORMANCE_BUDGETS = {
  domContentLoadedMs: Number(process.env.WEB_E2E_DCL_BUDGET_MS ?? 5_000),
  loadMs: Number(process.env.WEB_E2E_LOAD_BUDGET_MS ?? 10_000),
  totalTransferBytes: Number(
    process.env.WEB_E2E_TRANSFER_BUDGET_BYTES ?? 7_500_000,
  ),
  jsTransferBytes: Number(process.env.WEB_E2E_JS_BUDGET_BYTES ?? 5_000_000),
  longTaskMs: Number(process.env.WEB_E2E_LONG_TASK_BUDGET_MS ?? 1_000),
};

function readPositiveIntegerEnv(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsedValue));
}

const PERFORMANCE_ATTEMPTS = readPositiveIntegerEnv(
  "WEB_E2E_PERFORMANCE_ATTEMPTS",
  2,
);
const RETRYABLE_PERFORMANCE_PREFIXES = [
  "domContentLoaded ",
  "load ",
  "long tasks ",
];

class PerformanceBudgetError extends Error {
  constructor(siteName, route, errors, metrics) {
    super(
      `${siteName} ${route} performance failure:\n${summarizeErrors(errors)}`,
    );
    this.name = "PerformanceBudgetError";
    this.errors = errors;
    this.metrics = metrics;
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function compact(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIgnoredConsole(text) {
  return CONSOLE_IGNORE.some((pattern) => pattern.test(text));
}

function absoluteUrl(baseUrl, path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function sameOriginUrl(baseUrl, href) {
  try {
    const parsed = new URL(href, `${baseUrl}/`);
    return parsed.origin === new URL(baseUrl).origin ? parsed : null;
  } catch {
    return null;
  }
}

function summarizeErrors(errors) {
  return errors.map((error) => `  - ${error}`).join("\n");
}

async function checkHttpRoute(request, site, route, expectedStatuses = [200]) {
  const url = absoluteUrl(site.baseUrl, route);
  const response = await request.get(url, {
    timeout: DEFAULT_TIMEOUT_MS,
    failOnStatusCode: false,
  });
  const status = response.status();
  if (!expectedStatuses.includes(status)) {
    throw new Error(
      `${site.name} ${route} expected ${expectedStatuses.join("/")} got ${status}`,
    );
  }
}

async function collectPageErrors(page) {
  const errors = [];

  page.on("pageerror", (error) => {
    if (!isIgnoredConsole(error.message)) {
      errors.push(`pageerror: ${error.message}`);
    }
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!isIgnoredConsole(text)) {
      errors.push(`console.error: ${text}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    const failure = request.failure();
    if (["image", "stylesheet", "script", "document"].includes(resourceType)) {
      errors.push(
        `requestfailed ${resourceType}: ${url} (${failure?.errorText ?? "unknown"})`,
      );
    }
  });

  return errors;
}

async function waitForAppReady(page) {
  await page.waitForSelector("body", { timeout: DEFAULT_TIMEOUT_MS });
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#root");
      if (!root) return document.body.innerText.trim().length > 0;
      return root.children.length > 0 && root.innerText.trim().length > 0;
    },
    { timeout: DEFAULT_TIMEOUT_MS },
  );
}

async function checkResponsiveLayout(page, siteName, route, viewportName) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const pageScrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight
      );
    }

    function isInsideBoundedScroller(element) {
      let current = element.parentElement;
      while (
        current &&
        current !== document.body &&
        current !== document.documentElement
      ) {
        const style = window.getComputedStyle(current);
        const rect = current.getBoundingClientRect();
        const scrollsX =
          current.scrollWidth > current.clientWidth + 1 &&
          ["auto", "scroll", "hidden", "clip"].includes(style.overflowX);
        const bounded = rect.left >= -2 && rect.right <= viewportWidth + 2;
        if (scrollsX && bounded) return true;
        current = current.parentElement;
      }
      return false;
    }

    const wideElements = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => {
        if (!isVisible(element)) return false;
        if (element.closest(".docs-sidebar:not(.open)")) return false;
        if (element.closest("[aria-hidden='true']")) return false;
        if (isInsideBoundedScroller(element)) return false;
        return true;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className:
            typeof element.className === "string"
              ? element.className
              : String(element.className ?? ""),
          text: (element.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(
        (item) =>
          item.width > 0 && (item.left < -2 || item.right > viewportWidth + 2),
      )
      .slice(0, 12);

    const verticalText = Array.from(
      document.body.querySelectorAll("h1,h2,h3,p,li,a,button"),
    )
      .filter((element) => isVisible(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 90),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(
        (item) =>
          item.text.length >= 10 &&
          item.width > 0 &&
          item.width < 28 &&
          item.height > 120,
      )
      .slice(0, 8);

    return {
      viewportWidth,
      pageOverflow: pageScrollWidth - viewportWidth,
      wideElements,
      verticalText,
    };
  });

  const errors = [];
  if (metrics.pageOverflow > 2) {
    errors.push(`document overflows horizontally by ${metrics.pageOverflow}px`);
  }
  if (metrics.wideElements.length > 0) {
    errors.push(`wide elements: ${JSON.stringify(metrics.wideElements)}`);
  }
  if (metrics.verticalText.length > 0) {
    errors.push(
      `suspicious vertical text: ${JSON.stringify(metrics.verticalText)}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `${siteName} ${route} ${viewportName} responsive failure:\n${summarizeErrors(
        errors,
      )}`,
    );
  }
}

async function checkSeo(page, site, route) {
  const seo = await page.evaluate(() => {
    const meta = (selector) =>
      document.head.querySelector(selector)?.getAttribute("content") ?? "";
    const link = (selector) =>
      document.head.querySelector(selector)?.getAttribute("href") ?? "";
    const jsonLd = Array.from(
      document.head.querySelectorAll('script[type="application/ld+json"]'),
    ).map((script) => script.textContent ?? "");

    return {
      lang: document.documentElement.getAttribute("lang") ?? "",
      title: document.title,
      description: meta('meta[name="description"]'),
      viewport: meta('meta[name="viewport"]'),
      canonical: link('link[rel="canonical"]'),
      ogTitle: meta('meta[property="og:title"]'),
      ogDescription: meta('meta[property="og:description"]'),
      ogImage: meta('meta[property="og:image"]'),
      twitterCard: meta(
        'meta[name="twitter:card"], meta[property="twitter:card"]',
      ),
      h1Count: document.querySelectorAll("h1").length,
      h1Text: Array.from(document.querySelectorAll("h1"))
        .map((element) => element.textContent?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 3),
      jsonLd,
    };
  });

  const warnings = [];
  const errors = [];

  if (!seo.lang) errors.push("html lang is missing");
  if (!compact(seo.title)) errors.push("title is missing");
  if (compact(seo.title).length > 70) {
    warnings.push(`title is long (${compact(seo.title).length} chars)`);
  }
  if (compact(seo.description).length < 40) {
    errors.push("meta description is missing or too short");
  }
  if (!seo.viewport.includes("width=device-width")) {
    errors.push("viewport meta is missing width=device-width");
  }
  const allowedCanonicalOrigins = site.canonicalOrigins ?? [site.baseUrl];
  const hasAllowedCanonical =
    seo.canonical &&
    allowedCanonicalOrigins.some((origin) => seo.canonical.startsWith(origin));
  if (!hasAllowedCanonical) {
    errors.push(`canonical missing or outside site origin: ${seo.canonical}`);
  }
  if (!compact(seo.ogTitle)) errors.push("og:title is missing");
  if (!compact(seo.ogDescription)) errors.push("og:description is missing");
  if (!compact(seo.ogImage)) warnings.push("og:image is missing");
  if (!compact(seo.twitterCard)) warnings.push("twitter card is missing");
  if (seo.h1Count < 1) errors.push("page has no h1");

  for (const [index, value] of seo.jsonLd.entries()) {
    try {
      JSON.parse(value);
    } catch (error) {
      errors.push(`JSON-LD #${index + 1} is invalid: ${error.message}`);
    }
  }

  if (STRICT && warnings.length > 0) errors.push(...warnings);

  if (errors.length > 0) {
    throw new Error(
      `${site.name} ${route} SEO failure:\n${summarizeErrors(errors)}`,
    );
  }

  return warnings;
}

async function collectPerformanceMetrics(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const totalTransferBytes = resources.reduce(
      (sum, entry) => sum + (entry.transferSize || 0),
      0,
    );
    const jsTransferBytes = resources
      .filter((entry) => /\.m?js($|\?)/.test(entry.name))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const longTaskMs = performance
      .getEntriesByType("longtask")
      .reduce((sum, entry) => sum + entry.duration, 0);

    return {
      domContentLoadedMs: Math.round(
        navigation ? navigation.domContentLoadedEventEnd : 0,
      ),
      loadMs: Math.round(navigation ? navigation.loadEventEnd : 0),
      totalTransferBytes,
      jsTransferBytes,
      longTaskMs: Math.round(longTaskMs),
    };
  });
}

function getPerformanceErrors(metrics) {
  const errors = [];
  if (metrics.domContentLoadedMs > PERFORMANCE_BUDGETS.domContentLoadedMs) {
    errors.push(
      `domContentLoaded ${metrics.domContentLoadedMs}ms > ${PERFORMANCE_BUDGETS.domContentLoadedMs}ms`,
    );
  }
  if (metrics.loadMs > PERFORMANCE_BUDGETS.loadMs) {
    errors.push(`load ${metrics.loadMs}ms > ${PERFORMANCE_BUDGETS.loadMs}ms`);
  }
  if (metrics.totalTransferBytes > PERFORMANCE_BUDGETS.totalTransferBytes) {
    errors.push(
      `transfer ${metrics.totalTransferBytes}B > ${PERFORMANCE_BUDGETS.totalTransferBytes}B`,
    );
  }
  if (metrics.jsTransferBytes > PERFORMANCE_BUDGETS.jsTransferBytes) {
    errors.push(
      `js transfer ${metrics.jsTransferBytes}B > ${PERFORMANCE_BUDGETS.jsTransferBytes}B`,
    );
  }
  if (metrics.longTaskMs > PERFORMANCE_BUDGETS.longTaskMs) {
    errors.push(
      `long tasks ${metrics.longTaskMs}ms > ${PERFORMANCE_BUDGETS.longTaskMs}ms`,
    );
  }

  return errors;
}

function isRetryablePerformanceError(error) {
  return (
    error instanceof PerformanceBudgetError &&
    error.errors.every((message) =>
      RETRYABLE_PERFORMANCE_PREFIXES.some((prefix) =>
        message.startsWith(prefix),
      ),
    )
  );
}

async function checkPerformance(page, siteName, route) {
  const metrics = await collectPerformanceMetrics(page);
  const errors = getPerformanceErrors(metrics);

  if (errors.length > 0) {
    throw new PerformanceBudgetError(siteName, route, errors, metrics);
  }

  return metrics;
}

async function clearBrowserCache(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Network.clearBrowserCache");
  } finally {
    await session.detach();
  }
}

async function checkPerformanceWithRetry(page, siteName, route) {
  for (let attempt = 1; attempt <= PERFORMANCE_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await clearBrowserCache(page);
      await page.reload({
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT_MS,
      });
      await waitForAppReady(page);
      await page.waitForLoadState("load", { timeout: DEFAULT_TIMEOUT_MS });
    }

    try {
      const metrics = await checkPerformance(page, siteName, route);
      return { metrics, attempts: attempt };
    } catch (error) {
      if (
        !isRetryablePerformanceError(error) ||
        attempt === PERFORMANCE_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
}

async function checkImages(page, siteName, route) {
  const brokenImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src)
      .slice(0, 20),
  );

  if (brokenImages.length > 0) {
    throw new Error(
      `${siteName} ${route} broken images:\n${summarizeErrors(brokenImages)}`,
    );
  }
}

async function checkInternalLinks(page, site) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => anchor.getAttribute("href"))
      .filter(Boolean)
      .filter((href) => !href.startsWith("#"))
      .filter((href) => !href.startsWith("mailto:"))
      .filter((href) => !href.startsWith("tel:"))
      .filter((href) => !href.startsWith("javascript:"))
      .slice(0, 120),
  );

  const unique = new Map();
  for (const href of links) {
    const url = sameOriginUrl(site.baseUrl, href);
    if (!url) continue;
    url.hash = "";
    unique.set(url.toString(), url.toString());
  }

  const errors = [];
  const checked = [];
  for (const url of unique.values()) {
    const response = await page.request.get(url, {
      timeout: DEFAULT_TIMEOUT_MS,
      failOnStatusCode: false,
    });
    const status = response.status();
    checked.push({ url, status });
    if (status >= 400) {
      errors.push(`${status} ${url}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `${site.name} internal links failed:\n${summarizeErrors(errors)}`,
    );
  }

  return checked.length;
}

async function checkSite(browser, request, site) {
  const failures = [];
  const summaries = [];

  for (const route of site.apiRoutes ?? []) {
    try {
      await checkHttpRoute(request, site, route, [200, 301, 302]);
      summaries.push(`${site.name} ${route} http ok`);
    } catch (error) {
      failures.push(error.message);
    }
  }

  for (const route of site.routes) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        deviceScaleFactor: viewport.isMobile ? 2 : 1,
      });
      const page = await context.newPage();
      const pageErrors = await collectPageErrors(page);
      const url = absoluteUrl(site.baseUrl, route);

      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: DEFAULT_TIMEOUT_MS,
        });
        if (!response || response.status() >= 400) {
          throw new Error(
            `${site.name} ${route} ${viewport.name} returned ${response?.status() ?? "no response"}`,
          );
        }

        await waitForAppReady(page);
        await page.waitForLoadState("load", { timeout: DEFAULT_TIMEOUT_MS });
        await checkResponsiveLayout(page, site.name, route, viewport.name);
        await checkImages(page, site.name, route);

        if (viewport.name === "desktop") {
          const warnings = await checkSeo(page, site, route);
          if (warnings.length > 0) {
            summaries.push(
              `${site.name} ${route} ${viewport.name} SEO warnings: ${warnings.join(
                "; ",
              )}`,
            );
          }
        }

        if (viewport.name === "desktop") {
          const { metrics, attempts } = await checkPerformanceWithRetry(
            page,
            site.name,
            route,
          );
          const linkCount = await checkInternalLinks(page, site);
          const retryLabel =
            attempts > 1 ? ` after ${attempts} performance attempts` : "";
          summaries.push(
            `${site.name} ${route} desktop ok (${metrics.loadMs}ms load, ${linkCount} links${retryLabel})`,
          );
        }

        if (pageErrors.length > 0) {
          throw new Error(
            `${site.name} ${route} ${viewport.name} runtime errors:\n${summarizeErrors(
              pageErrors,
            )}`,
          );
        }
      } catch (error) {
        failures.push(error.message);
      } finally {
        await context.close();
      }
    }
  }

  return { failures, summaries };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const request = await playwrightRequest.newContext();
  const allFailures = [];
  const allSummaries = [];

  try {
    for (const site of SITES) {
      const result = await checkSite(browser, request, site);
      allFailures.push(...result.failures);
      allSummaries.push(...result.summaries);
    }
  } finally {
    await request.dispose();
    await browser.close();
  }

  for (const summary of allSummaries) {
    console.log(`web-e2e: ${summary}`);
  }

  if (allFailures.length > 0) {
    console.error("web-e2e: FAILED");
    console.error(summarizeErrors(allFailures));
    process.exitCode = 1;
    return;
  }

  console.log("web-e2e: docs and IAPKit passed");
}

main().catch((error) => {
  console.error("web-e2e: unexpected failure");
  console.error(error);
  process.exitCode = 1;
});
