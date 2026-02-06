/**
 * OpenSentinel Extension Content Script
 * Handles page interaction, text extraction, and in-page UI elements
 */

// Message types from background script
interface ToastMessage {
  type: 'SHOW_TOAST';
  payload: {
    title: string;
    message: string;
  };
}

interface GetPageDataMessage {
  type: 'GET_PAGE_DATA_FROM_CONTENT';
}

interface GetSelectionMessage {
  type: 'GET_SELECTION';
}

type ContentMessage = ToastMessage | GetPageDataMessage | GetSelectionMessage;

/**
 * Create and show a toast notification on the page
 */
function showToast(title: string, message: string, duration = 4000): void {
  // Remove existing toast if any
  const existingToast = document.getElementById('opensentinel-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast container
  const toast = document.createElement('div');
  toast.id = 'opensentinel-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 350px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    animation: opensentinel-slide-in 0.3s ease-out;
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  // Add title
  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    font-weight: 600;
    font-size: 14px;
    color: #4fc3f7;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  titleEl.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
    ${escapeHtml(title)}
  `;
  toast.appendChild(titleEl);

  // Add message
  const messageEl = document.createElement('div');
  messageEl.style.cssText = `
    font-size: 13px;
    color: #b0bec5;
    line-height: 1.4;
  `;
  messageEl.textContent = message;
  toast.appendChild(messageEl);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #78909c;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s, color 0.2s;
  `;
  closeBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.style.color = '#ffffff';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.background = 'none';
    closeBtn.style.color = '#78909c';
  };
  closeBtn.onclick = () => toast.remove();
  toast.appendChild(closeBtn);

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes opensentinel-slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes opensentinel-slide-out {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  toast.appendChild(style);

  // Add to page
  document.body.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'opensentinel-slide-out 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Extract clean text content from the page
 */
function extractPageContent(): string {
  // Clone the body to avoid modifying the actual DOM
  const bodyClone = document.body.cloneNode(true) as HTMLElement;

  // Remove script, style, and other non-content elements
  const elementsToRemove = bodyClone.querySelectorAll(
    'script, style, noscript, iframe, svg, canvas, video, audio, ' +
    '[hidden], [aria-hidden="true"], .hidden, nav, footer, header, aside'
  );
  elementsToRemove.forEach((el) => el.remove());

  // Get the text content
  let text = bodyClone.innerText || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return text;
}

/**
 * Get structured page data
 */
function getPageData(): {
  url: string;
  title: string;
  content: string;
  selectedText: string;
  metadata: {
    description?: string;
    author?: string;
    publishedDate?: string;
  };
} {
  const selectedText = window.getSelection()?.toString() || '';
  const content = extractPageContent();

  // Extract metadata
  const description = (
    document.querySelector('meta[name="description"]') as HTMLMetaElement
  )?.content || '';
  const author = (
    document.querySelector('meta[name="author"]') as HTMLMetaElement
  )?.content || '';
  const publishedDate = (
    document.querySelector('meta[property="article:published_time"]') as HTMLMetaElement
  )?.content || '';

  return {
    url: window.location.href,
    title: document.title,
    content,
    selectedText,
    metadata: {
      description: description || undefined,
      author: author || undefined,
      publishedDate: publishedDate || undefined,
    },
  };
}

/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'SHOW_TOAST':
        showToast(message.payload.title, message.payload.message);
        sendResponse({ success: true });
        break;

      case 'GET_PAGE_DATA_FROM_CONTENT':
        sendResponse(getPageData());
        break;

      case 'GET_SELECTION':
        sendResponse({
          selectedText: window.getSelection()?.toString() || '',
        });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return true;
  }
);

/**
 * Track text selection for context menu
 */
let lastSelection = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection()?.toString() || '';
  if (selection && selection !== lastSelection) {
    lastSelection = selection;
    // Store selection in session storage for quick access
    chrome.storage.session.set({ currentSelection: selection }).catch(() => {
      // Ignore errors (session storage may not be available)
    });
  }
});

/**
 * Listen for keyboard shortcuts that might need page context
 */
document.addEventListener('keydown', (e) => {
  // Alt+Shift+S to summarize (alternative to context menu)
  if (e.altKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'SUMMARIZE_PAGE' }).catch(() => {
      showToast('Error', 'Could not connect to OpenSentinel extension');
    });
  }

  // Alt+Shift+E to extract data
  if (e.altKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'EXTRACT_DATA' }).catch(() => {
      showToast('Error', 'Could not connect to OpenSentinel extension');
    });
  }
});

// Log that content script is loaded (for debugging)
console.log('[OpenSentinel] Content script loaded');
