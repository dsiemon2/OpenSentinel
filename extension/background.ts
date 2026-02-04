/**
 * Moltbot Extension Background Service Worker
 * Handles context menus, keyboard shortcuts, and message routing
 */

import {
  summarizePage,
  extractData,
  askAboutSelection,
  captureToMemory,
  type PageData,
} from './utils/api';

// Message types for communication between components
export interface ExtensionMessage {
  type: 'SUMMARIZE_PAGE' | 'EXTRACT_DATA' | 'CAPTURE_PAGE' | 'ASK_SELECTION' | 'GET_PAGE_DATA' | 'SHOW_NOTIFICATION';
  payload?: unknown;
}

export interface PageDataResponse {
  url: string;
  title: string;
  content: string;
  selectedText?: string;
}

// Context menu IDs
const MENU_ASK_ABOUT = 'moltbot-ask-about';
const MENU_SUMMARIZE = 'moltbot-summarize';
const MENU_EXTRACT = 'moltbot-extract';
const MENU_CAPTURE = 'moltbot-capture';

/**
 * Initialize context menus on extension install/update
 */
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Create context menus
    chrome.contextMenus.create({
      id: MENU_ASK_ABOUT,
      title: 'Ask Moltbot about "%s"',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: MENU_SUMMARIZE,
      title: 'Summarize this page',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: MENU_EXTRACT,
      title: 'Extract data from page',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: MENU_CAPTURE,
      title: 'Capture page to memory',
      contexts: ['page'],
    });
  });
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    switch (info.menuItemId) {
      case MENU_ASK_ABOUT: {
        if (!info.selectionText) return;

        // Store selection for popup to use
        await chrome.storage.session.set({
          pendingAction: {
            type: 'ask_selection',
            selectedText: info.selectionText,
            url: info.pageUrl,
            title: tab.title,
          },
        });

        // Open popup (note: this opens the popup programmatically)
        await chrome.action.openPopup().catch(() => {
          // Fallback: show notification if popup can't be opened
          showNotification(
            'Selection saved',
            'Click the Moltbot icon to ask about the selected text'
          );
        });
        break;
      }

      case MENU_SUMMARIZE: {
        const pageData = await getPageData(tab.id);
        if (!pageData) {
          showNotification('Error', 'Could not get page content');
          return;
        }

        showNotification('Summarizing...', 'Please wait while Moltbot summarizes the page');

        const response = await summarizePage(pageData);

        // Store response for popup to display
        await chrome.storage.session.set({
          lastResponse: {
            type: 'summary',
            content: response.message,
            pageTitle: pageData.title,
            timestamp: Date.now(),
          },
        });

        showNotification('Summary ready', 'Click the Moltbot icon to view the summary');
        break;
      }

      case MENU_EXTRACT: {
        const pageData = await getPageData(tab.id);
        if (!pageData) {
          showNotification('Error', 'Could not get page content');
          return;
        }

        showNotification('Extracting...', 'Please wait while Moltbot extracts data');

        const response = await extractData(pageData);

        await chrome.storage.session.set({
          lastResponse: {
            type: 'extraction',
            content: response.message,
            pageTitle: pageData.title,
            timestamp: Date.now(),
          },
        });

        showNotification('Extraction ready', 'Click the Moltbot icon to view the extracted data');
        break;
      }

      case MENU_CAPTURE: {
        const pageData = await getPageData(tab.id);
        if (!pageData) {
          showNotification('Error', 'Could not get page content');
          return;
        }

        showNotification('Capturing...', 'Saving page to memory');

        const result = await captureToMemory(pageData);

        if (result.success) {
          showNotification('Page captured', `"${pageData.title}" has been saved to memory`);
        } else {
          showNotification('Capture failed', 'Could not save page to memory');
        }
        break;
      }
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
    showNotification(
      'Error',
      error instanceof Error ? error.message : 'Action failed'
    );
  }
});

/**
 * Handle keyboard shortcuts
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick_capture') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
      const pageData = await getPageData(tab.id);
      if (!pageData) {
        showNotification('Error', 'Could not get page content');
        return;
      }

      showNotification('Quick capture...', 'Saving page to memory');

      const result = await captureToMemory(pageData);

      if (result.success) {
        showNotification('Page captured', `"${pageData.title}" saved to memory`);
      } else {
        showNotification('Capture failed', 'Could not save page to memory');
      }
    } catch (error) {
      console.error('Quick capture failed:', error);
      showNotification(
        'Error',
        error instanceof Error ? error.message : 'Quick capture failed'
      );
    }
  }
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message }));

  // Return true to indicate async response
  return true;
});

/**
 * Process messages from other extension components
 */
async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  switch (message.type) {
    case 'GET_PAGE_DATA': {
      if (!tab?.id) return null;
      return getPageData(tab.id);
    }

    case 'SUMMARIZE_PAGE': {
      if (!tab?.id) return { error: 'No active tab' };
      const pageData = await getPageData(tab.id);
      if (!pageData) return { error: 'Could not get page content' };
      return summarizePage(pageData);
    }

    case 'EXTRACT_DATA': {
      if (!tab?.id) return { error: 'No active tab' };
      const pageData = await getPageData(tab.id);
      if (!pageData) return { error: 'Could not get page content' };
      const prompt = (message.payload as { prompt?: string })?.prompt;
      return extractData(pageData, prompt);
    }

    case 'CAPTURE_PAGE': {
      if (!tab?.id) return { error: 'No active tab' };
      const pageData = await getPageData(tab.id);
      if (!pageData) return { error: 'Could not get page content' };
      return captureToMemory(pageData);
    }

    case 'ASK_SELECTION': {
      const payload = message.payload as {
        selectedText: string;
        question: string;
        url?: string;
        title?: string;
      };
      return askAboutSelection(
        payload.selectedText,
        payload.question,
        payload.url && payload.title ? { url: payload.url, title: payload.title } : undefined
      );
    }

    case 'SHOW_NOTIFICATION': {
      const payload = message.payload as { title: string; message: string };
      showNotification(payload.title, payload.message);
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

/**
 * Get page data from content script
 */
async function getPageData(tabId: number): Promise<PageData | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Get page content
        const content = document.body?.innerText || '';
        const selectedText = window.getSelection()?.toString() || '';

        return {
          url: window.location.href,
          title: document.title,
          content,
          selectedText,
        };
      },
    });

    return results[0]?.result || null;
  } catch (error) {
    console.error('Failed to get page data:', error);
    return null;
  }
}

/**
 * Show a browser notification
 */
function showNotification(title: string, message: string): void {
  // Use basic notification API (requires notifications permission if you want rich notifications)
  // For now, we'll log to console as a fallback
  console.log(`[Moltbot] ${title}: ${message}`);

  // Try to send message to active tab to show in-page notification
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SHOW_TOAST',
        payload: { title, message },
      }).catch(() => {
        // Content script not available, ignore
      });
    }
  });
}
