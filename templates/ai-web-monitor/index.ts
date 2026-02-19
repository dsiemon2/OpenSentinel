/**
 * AI Web Monitor Agent
 *
 * Monitors web pages for changes and sends alerts via your preferred channel.
 * Uses OpenSentinel's tool system to fetch pages, diff content, and notify.
 */

import { configure, ready, chatWithTools, type Message } from "opensentinel";

// Configure with your API key
configure({
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "",
});
await ready();

// Pages to monitor
const WATCH_LIST = [
  {
    url: "https://example.com/pricing",
    name: "Competitor Pricing",
    interval: 60 * 60 * 1000, // 1 hour
  },
  {
    url: "https://news.ycombinator.com",
    name: "Hacker News Front Page",
    interval: 15 * 60 * 1000, // 15 minutes
  },
  {
    url: "https://example.com/changelog",
    name: "Product Changelog",
    interval: 6 * 60 * 60 * 1000, // 6 hours
  },
];

// Store previous snapshots
const snapshots = new Map<string, string>();

async function checkPage(page: (typeof WATCH_LIST)[0]) {
  const messages: Message[] = [
    {
      role: "user",
      content: `Fetch the web page at ${page.url} and return only the main text content, stripped of HTML tags and navigation. If you notice this is a pricing page, changelog, or news page, extract the key items as a structured list.`,
    },
  ];

  const response = await chatWithTools(messages, "web-monitor");
  const currentContent = response.content;

  const previousContent = snapshots.get(page.url);
  snapshots.set(page.url, currentContent);

  if (!previousContent) {
    console.log(`[${page.name}] Initial snapshot captured`);
    return;
  }

  // Ask the AI to diff the content
  const diffMessages: Message[] = [
    {
      role: "user",
      content: `Compare these two versions of "${page.name}" and describe what changed. If nothing meaningful changed, respond with exactly "NO_CHANGES".

PREVIOUS:
${previousContent.slice(0, 3000)}

CURRENT:
${currentContent.slice(0, 3000)}`,
    },
  ];

  const diffResponse = await chatWithTools(diffMessages, "web-monitor");

  if (!diffResponse.content.includes("NO_CHANGES")) {
    console.log(`\n========== CHANGE DETECTED: ${page.name} ==========`);
    console.log(diffResponse.content);
    console.log("=".repeat(50) + "\n");

    // You could extend this to send Slack/Discord/Telegram/email alerts:
    // const sentinel = new OpenSentinel({ claudeApiKey: "...", slack: true });
  }
}

async function main() {
  console.log("OpenSentinel Web Monitor starting...");
  console.log(`Watching ${WATCH_LIST.length} pages\n`);

  // Initial check of all pages
  for (const page of WATCH_LIST) {
    try {
      await checkPage(page);
    } catch (err: any) {
      console.error(`[${page.name}] Error: ${err.message}`);
    }
  }

  // Set up recurring checks
  for (const page of WATCH_LIST) {
    setInterval(async () => {
      try {
        await checkPage(page);
      } catch (err: any) {
        console.error(`[${page.name}] Error: ${err.message}`);
      }
    }, page.interval);

    console.log(
      `[${page.name}] Checking every ${page.interval / 60000} minutes`
    );
  }
}

main().catch(console.error);
