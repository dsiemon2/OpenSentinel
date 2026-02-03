import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;
let page: Page | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function getPage(): Promise<Page> {
  const b = await getBrowser();
  if (!page || page.isClosed()) {
    page = await b.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (page) {
    await page.close();
    page = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  screenshot?: string; // Base64 encoded
}

export async function navigateTo(url: string): Promise<BrowseResult> {
  const p = await getPage();

  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const title = await p.title();
  const content = await p.evaluate(() => {
    // Get main text content, removing scripts and styles
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script, style, nav, footer, header").forEach((el) => el.remove());
    return clone.innerText.slice(0, 5000);
  });

  return { url: p.url(), title, content };
}

export async function takeScreenshot(): Promise<string> {
  const p = await getPage();
  const buffer = await p.screenshot({ type: "png" });
  return buffer.toString("base64");
}

export async function clickElement(selector: string): Promise<void> {
  const p = await getPage();
  await p.click(selector, { timeout: 5000 });
}

export async function typeText(selector: string, text: string): Promise<void> {
  const p = await getPage();
  await p.fill(selector, text);
}

export async function extractText(selector: string): Promise<string> {
  const p = await getPage();
  return p.textContent(selector) || "";
}

export async function searchGoogle(query: string): Promise<BrowseResult> {
  const encodedQuery = encodeURIComponent(query);
  return navigateTo(`https://www.google.com/search?q=${encodedQuery}`);
}

export async function extractLinks(): Promise<Array<{ text: string; href: string }>> {
  const p = await getPage();
  return p.evaluate(() => {
    const links: Array<{ text: string; href: string }> = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      const text = a.textContent?.trim();
      if (href && text && href.startsWith("http")) {
        links.push({ text: text.slice(0, 100), href });
      }
    });
    return links.slice(0, 20);
  });
}
