import { useState } from "react";
import { setStoredToken } from "../lib/api";

interface GatewayAuthProps {
  onAuthenticated: () => void;
}

export default function GatewayAuth({ onAuthenticated }: GatewayAuthProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setChecking(true);
    setError("");

    try {
      // Validate the token by making a test request
      const res = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });

      if (res.status === 401) {
        setError("Invalid token. Please check and try again.");
        setChecking(false);
        return;
      }

      // Token is valid — store and proceed
      setStoredToken(token.trim());
      onAuthenticated();
    } catch {
      setError("Cannot reach the server. Is OpenSentinel running?");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="gateway-auth">
      <div className="gateway-auth-card">
        <svg width="48" height="48" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="12" stroke="url(#logo-grad-auth)" strokeWidth="2.5"/>
          <circle cx="14" cy="14" r="5" fill="url(#logo-grad-auth)"/>
          <defs>
            <linearGradient id="logo-grad-auth" x1="0" y1="0" x2="28" y2="28">
              <stop offset="0%" stopColor="#10b981"/>
              <stop offset="100%" stopColor="#06b6d4"/>
            </linearGradient>
          </defs>
        </svg>
        <h2>OpenSentinel</h2>
        <p>Enter your gateway token to continue.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Gateway token"
            autoFocus
            disabled={checking}
          />
          {error && <div className="gateway-error">{error}</div>}
          <button type="submit" disabled={checking || !token.trim()}>
            {checking ? "Verifying..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
