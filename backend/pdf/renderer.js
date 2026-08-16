import chromium from "@sparticuz/chromium";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

let browserPromise = null;
let activeBrowser = null;

function isBrowserConnected(browser) {
  if (!browser) return false;

  if (typeof browser.connected === "boolean") {
    return browser.connected;
  }

  if (typeof browser.isConnected === "function") {
    return browser.isConnected();
  }

  return true;
}

function isRecoverableBrowserError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "");

  return (
    name.includes("ConnectionClosed") ||
    message.includes("Connection closed") ||
    message.includes("Target closed") ||
    message.includes("Browser closed") ||
    message.includes("Session closed") ||
    message.includes("Protocol error")
  );
}

async function resetPdfBrowser() {
  const currentBrowserPromise = browserPromise;
  browserPromise = null;
  activeBrowser = null;

  if (!currentBrowserPromise) {
    return;
  }

  try {
    const browser = await currentBrowserPromise;
    if (isBrowserConnected(browser)) {
      await browser.close();
    }
  } catch {
    // The browser is already gone or cannot be reached.
  }
}

function resolveLocalBrowserPath() {
  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const fallbackPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];

  for (const fallbackPath of fallbackPaths) {
    if (existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  return undefined;
}

async function launchPdfBrowser() {
  try {
    const useServerChromium = process.platform === "linux" || process.env.USE_SPARTICUZ_CHROMIUM === "1";
    const executablePath = useServerChromium
      ? await chromium.executablePath()
      : resolveLocalBrowserPath();

    if (!executablePath) {
      throw new Error("Could not find a local Chrome executable");
    }

    const browser = await puppeteer.launch({
      args: useServerChromium
        ? puppeteer.defaultArgs({ args: chromium.args, headless: "shell" })
        : puppeteer.defaultArgs({ headless: "new" }),
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: useServerChromium ? "shell" : "new",
      ignoreHTTPSErrors: true,
    });

    activeBrowser = browser;
    browser.once("disconnected", () => {
      if (activeBrowser === browser) {
        activeBrowser = null;
        browserPromise = null;
      }
    });

    return browser;
  } catch (error) {
    browserPromise = null;
    activeBrowser = null;
    throw new Error(
      `Failed to launch PDF renderer: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function getPdfBrowser() {
  if (!browserPromise || (activeBrowser && !isBrowserConnected(activeBrowser))) {
    browserPromise = launchPdfBrowser();
  }

  const browser = await browserPromise;

  if (!isBrowserConnected(browser)) {
    await resetPdfBrowser();
    browserPromise = launchPdfBrowser();
    return browserPromise;
  }

  return browser;
}

async function renderPdfFromHtmlOnce(html) {
  const browser = await getPdfBrowser();
  let page = null;

  try {
    page = await browser.newPage();

    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await page.emulateMediaType("print");

    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "14mm",
        left: "12mm",
      },
    });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

export async function renderPdfFromHtml(html) {
  try {
    return await renderPdfFromHtmlOnce(html);
  } catch (error) {
    if (!isRecoverableBrowserError(error)) {
      throw error;
    }

    await resetPdfBrowser();
    return renderPdfFromHtmlOnce(html);
  }
}
