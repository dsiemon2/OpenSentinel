"""
OpenSentinel SDK - Python Client

Connect any Python application to OpenSentinel's AI platform.

Usage:
    from opensentinel_sdk import OpenSentinelClient

    client = OpenSentinelClient(
        url="https://app.opensentinel.ai",
        app_name="DocGen-AI",
        app_type="legal-documents",
    )
    await client.register()
    response = await client.chat("Summarize this contract")
"""

import os
import json
import asyncio
from typing import Optional, Dict, Any, List, Literal
from dataclasses import dataclass, field
import urllib.request
import urllib.error
import ssl


@dataclass
class OpenSentinelConfig:
    """Configuration for OpenSentinel SDK client."""
    url: str = "http://localhost:8030"
    app_name: str = "Unknown App"
    app_type: str = "generic"
    api_key: Optional[str] = None
    callback_url: Optional[str] = None
    timeout: int = 30
    fallback: bool = False


@dataclass
class ChatResponse:
    """Response from OpenSentinel chat."""
    content: str
    tools_used: List[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    app: str = ""


class OpenSentinelClient:
    """Client for connecting to OpenSentinel AI platform."""

    def __init__(
        self,
        url: Optional[str] = None,
        app_name: Optional[str] = None,
        app_type: Optional[str] = None,
        api_key: Optional[str] = None,
        callback_url: Optional[str] = None,
        timeout: int = 30,
        fallback: bool = False,
    ):
        self.url = (url or os.environ.get("OPENSENTINEL_URL", "http://localhost:8030")).rstrip("/")
        self.app_name = app_name or os.environ.get("OPENSENTINEL_APP_NAME", "Unknown App")
        self.app_type = app_type or os.environ.get("OPENSENTINEL_APP_TYPE", "generic")
        self.api_key = api_key or os.environ.get("OPENSENTINEL_API_KEY")
        self.callback_url = callback_url
        self.timeout = timeout
        self.fallback = fallback
        self.app_id: Optional[str] = None
        self._base_url = f"{self.url}/api/sdk"

    def register(self) -> Dict[str, str]:
        """Register this app with OpenSentinel and get an API key."""
        result = self._request("POST", "/register", {
            "name": self.app_name,
            "type": self.app_type,
            "callbackUrl": self.callback_url,
        }, skip_auth=True)

        if result:
            self.api_key = result.get("apiKey")
            self.app_id = result.get("id")
        return result or {}

    def chat(
        self,
        message: str,
        context: Optional[str] = None,
        use_tools: bool = True,
        system_prompt: Optional[str] = None,
    ) -> Optional[ChatResponse]:
        """Chat with OpenSentinel AI."""
        result = self._request("POST", "/chat", {
            "message": message,
            "context": context,
            "useTools": use_tools,
            "systemPrompt": system_prompt,
        })

        if result:
            return ChatResponse(
                content=result.get("content", ""),
                tools_used=result.get("toolsUsed", []),
                input_tokens=result.get("usage", {}).get("inputTokens", 0),
                output_tokens=result.get("usage", {}).get("outputTokens", 0),
                app=result.get("app", ""),
            )
        return None

    def notify(
        self,
        channel: Literal["telegram", "discord", "slack", "email", "all"],
        message: str,
        recipient: Optional[str] = None,
        priority: Literal["low", "normal", "high", "urgent"] = "normal",
    ) -> Optional[Dict[str, Any]]:
        """Send notification through OpenSentinel channels."""
        return self._request("POST", "/notify", {
            "channel": channel,
            "message": message,
            "recipient": recipient,
            "priority": priority,
        })

    def store_memory(
        self,
        content: str,
        memory_type: Literal["episodic", "semantic", "procedural"] = "semantic",
        importance: int = 5,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Store a memory in OpenSentinel."""
        return self._request("POST", "/memory", {
            "content": content,
            "type": memory_type,
            "importance": importance,
            "metadata": metadata,
        })

    def search_memory(
        self,
        query: str,
        limit: int = 5,
        cross_app: bool = False,
    ) -> List[Dict[str, Any]]:
        """Search OpenSentinel's memory."""
        result = self._request("POST", "/memory/search", {
            "query": query,
            "limit": limit,
            "crossApp": cross_app,
        })
        return result if isinstance(result, list) else []

    def list_tools(self) -> Dict[str, Any]:
        """List available OpenSentinel tools."""
        return self._request("GET", "/tools") or {"tools": [], "count": 0}

    def execute_tool(self, tool: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Execute a specific OpenSentinel tool."""
        return self._request("POST", "/tools/execute", {
            "tool": tool,
            "input": tool_input,
        })

    def spawn_agent(
        self,
        agent_type: Literal["research", "coding", "writing", "analysis"],
        task: str,
        context: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Spawn a sub-agent for a task."""
        return self._request("POST", "/agent/spawn", {
            "type": agent_type,
            "task": task,
            "context": context,
        })

    def status(self) -> Optional[Dict[str, Any]]:
        """Get OpenSentinel status."""
        return self._request("GET", "/status")

    def is_available(self) -> bool:
        """Check if OpenSentinel is reachable."""
        try:
            req = urllib.request.Request(f"{self.url}/health", method="GET")
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
                return resp.status == 200
        except Exception:
            return False

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        skip_auth: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Make HTTP request to OpenSentinel API."""
        url = self._base_url + path
        headers = {"Content-Type": "application/json"}

        if not skip_auth:
            if not self.api_key:
                raise ValueError("Not registered. Call client.register() first or provide an api_key.")
            headers["Authorization"] = f"Bearer {self.api_key}"

        body = json.dumps(data).encode("utf-8") if data else None

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with urllib.request.urlopen(req, timeout=self.timeout, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            if self.fallback:
                return None
            raise RuntimeError(f"OpenSentinel API error ({e.code}): {error_body}")
        except Exception as e:
            if self.fallback:
                return None
            raise RuntimeError(f"OpenSentinel connection error: {e}")


def create_client(**kwargs) -> OpenSentinelClient:
    """Create a pre-configured OpenSentinel client with fallback support."""
    return OpenSentinelClient(fallback=True, **kwargs)
