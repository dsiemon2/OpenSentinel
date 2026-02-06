/**
 * OpenSentinel API Client
 * Handles all communication with the OpenSentinel backend
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatResponse {
  message: string;
  conversationId?: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PageData {
  url: string;
  title: string;
  content: string;
  selectedText?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

const DEFAULT_API_URL = 'http://localhost:8030';
const STORAGE_KEY = 'opensentinel_api_url';

/**
 * Get the configured API URL from storage
 */
export async function getApiUrl(): Promise<string> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return result[STORAGE_KEY] || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * Set the API URL in storage
 */
export async function setApiUrl(url: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: url });
}

/**
 * Make an authenticated request to the OpenSentinel API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getApiUrl();
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: 'Unknown error',
      message: response.statusText,
    }));
    throw new Error(errorData.message || errorData.error || 'API request failed');
  }

  return response.json();
}

/**
 * Send a chat message to OpenSentinel
 */
export async function sendMessage(
  message: string,
  context?: {
    pageUrl?: string;
    pageTitle?: string;
    selectedText?: string;
  }
): Promise<ChatResponse> {
  let fullMessage = message;

  if (context?.selectedText) {
    fullMessage = `Context (selected text from ${context.pageTitle || context.pageUrl || 'webpage'}):\n\`\`\`\n${context.selectedText}\n\`\`\`\n\nQuestion: ${message}`;
  } else if (context?.pageUrl) {
    fullMessage = `Context: Currently viewing ${context.pageTitle || context.pageUrl}\n\n${message}`;
  }

  return apiRequest<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: fullMessage }),
  });
}

/**
 * Summarize page content
 */
export async function summarizePage(pageData: PageData): Promise<ChatResponse> {
  const message = `Please summarize this webpage:

URL: ${pageData.url}
Title: ${pageData.title}

Content:
${pageData.content.slice(0, 10000)}${pageData.content.length > 10000 ? '\n\n[Content truncated...]' : ''}`;

  return apiRequest<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/**
 * Extract structured data from page content
 */
export async function extractData(
  pageData: PageData,
  extractionPrompt?: string
): Promise<ChatResponse> {
  const defaultPrompt = 'Extract the key information, facts, and data from this page in a structured format.';

  const message = `${extractionPrompt || defaultPrompt}

URL: ${pageData.url}
Title: ${pageData.title}

Content:
${pageData.content.slice(0, 10000)}${pageData.content.length > 10000 ? '\n\n[Content truncated...]' : ''}`;

  return apiRequest<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/**
 * Ask a question about selected text
 */
export async function askAboutSelection(
  selectedText: string,
  question: string,
  pageContext?: { url: string; title: string }
): Promise<ChatResponse> {
  const message = `I have selected the following text${pageContext ? ` from "${pageContext.title}"` : ''}:

\`\`\`
${selectedText}
\`\`\`

${question}`;

  return apiRequest<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/**
 * Save page to memory (quick capture)
 */
export async function captureToMemory(pageData: PageData): Promise<{ success: boolean; id?: string }> {
  const message = `Please save this page to memory for future reference:

URL: ${pageData.url}
Title: ${pageData.title}
Captured at: ${new Date().toISOString()}

Content:
${pageData.content.slice(0, 15000)}${pageData.content.length > 15000 ? '\n\n[Content truncated...]' : ''}`;

  try {
    await apiRequest<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        metadata: {
          action: 'capture',
          url: pageData.url,
          title: pageData.title,
        }
      }),
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to capture page:', error);
    return { success: false };
  }
}

/**
 * Test the API connection
 */
export async function testConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const baseUrl = await getApiUrl();
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      return { connected: true };
    }

    return { connected: false, error: `Server returned ${response.status}` };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

/**
 * Get conversation history (if supported by API)
 */
export async function getConversationHistory(): Promise<ChatMessage[]> {
  try {
    return await apiRequest<ChatMessage[]>('/api/chat/history', {
      method: 'GET',
    });
  } catch {
    // If history endpoint doesn't exist, return empty array
    return [];
  }
}
