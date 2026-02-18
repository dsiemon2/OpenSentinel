import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";

// ---------- Types ----------

interface SerializedEmail {
  id: string;
  uid: number;
  messageId: string;
  subject: string;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  date: string;
  text: string;
  html: string;
  snippet: string;
  attachments: {
    filename: string;
    contentType: string;
    size: number;
    hasContent: boolean;
    contentId?: string;
  }[];
  flags: string[];
}

interface FolderInfo {
  name: string;
  path: string;
  specialUse?: string;
  messages: { total: number; unread: number };
}

// ---------- Helpers ----------

function formatDate(ds: string): string {
  const d = new Date(ds);
  if (isNaN(d.getTime())) return ds;
  const now = new Date();
  const today = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (today) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtSender(from: { name: string; address: string }[]): string {
  return from?.[0]?.name || from?.[0]?.address || "Unknown";
}

function fmtAddr(a: { name: string; address: string }): string {
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(",")[1] || s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// ---------- Component ----------

export default function Email() {
  const [subView, setSubView] = useState<"list" | "detail" | "compose">("list");
  const [connected, setConnected] = useState(false);
  const [emails, setEmails] = useState<SerializedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SerializedEmail | null>(null);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [currentFolder, setCurrentFolder] = useState("INBOX");
  const [emailAddress, setEmailAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [configError, setConfigError] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<SerializedEmail | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enc = encodeURIComponent;

  const clearFields = () => {
    setComposeTo(""); setComposeCc(""); setComposeBcc(""); setComposeSubject("");
    setComposeBody(""); setComposeAttachments([]); setReplyTo(null);
  };

  // ------ API Functions ------

  const fetchFolders = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/email/folders?email_address=${enc(emailAddress)}`);
      if (res.status === 503) { setConfigError(true); return; }
      if (!res.ok) throw new Error("Failed to fetch folders");
      const d = await res.json();
      setFolders(d.folders || d);
    } catch (e) { console.error("fetchFolders:", e); }
  }, [emailAddress]);

  const fetchEmails = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(
        `/api/email/inbox?email_address=${enc(emailAddress)}&folder=${enc(currentFolder)}&limit=25`
      );
      if (res.status === 503) { setConfigError(true); return; }
      if (!res.ok) throw new Error("Failed to fetch emails");
      const d = await res.json();
      setEmails(d.emails || d);
    } catch (e) {
      console.error("fetchEmails:", e);
      setError("Failed to load emails. Please try again.");
    } finally { setLoading(false); }
  }, [emailAddress, currentFolder]);

  const fetchDetail = useCallback(async (uid: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/email/message/${uid}?email_address=${enc(emailAddress)}&folder=${enc(currentFolder)}`
      );
      if (!res.ok) throw new Error("Failed to fetch email detail");
      setSelectedEmail(await res.json());
      setSubView("detail");
    } catch (e) {
      console.error("fetchDetail:", e);
      setError("Failed to load email. Please try again.");
    } finally { setLoading(false); }
  }, [emailAddress, currentFolder]);

  const sendEmail = useCallback(async () => {
    setSending(true);
    try {
      const atts = await Promise.all(composeAttachments.map(async (f) => ({
        filename: f.name,
        contentType: f.type || "application/octet-stream",
        content: await readFileAsBase64(f),
      })));
      const payload: Record<string, unknown> = {
        from: emailAddress, to: composeTo, subject: composeSubject, text: composeBody,
      };
      if (composeCc) payload.cc = composeCc;
      if (composeBcc) payload.bcc = composeBcc;
      if (atts.length) payload.attachments = atts;
      const res = await apiFetch("/api/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to send email");
      clearFields(); setSubView("list"); fetchEmails();
    } catch (e) {
      console.error("sendEmail:", e);
      setError("Failed to send email. Please try again.");
    } finally { setSending(false); }
  }, [emailAddress, composeTo, composeCc, composeBcc, composeSubject, composeBody, composeAttachments, fetchEmails]);

  const replyToEmail = useCallback(async (all: boolean) => {
    if (!replyTo) return;
    setSending(true);
    try {
      const res = await apiFetch("/api/email/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: emailAddress, email_uid: replyTo.uid,
          folder: currentFolder, body: composeBody, reply_all: all,
        }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      clearFields(); setSubView("list"); fetchEmails();
    } catch (e) {
      console.error("replyToEmail:", e);
      setError("Failed to send reply. Please try again.");
    } finally { setSending(false); }
  }, [emailAddress, currentFolder, replyTo, composeBody, fetchEmails]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { fetchEmails(); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch("/api/email/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: emailAddress, subject: searchQuery,
          from: searchQuery, folder: currentFolder, limit: 25,
        }),
      });
      if (!res.ok) throw new Error("Search failed");
      const d = await res.json();
      setEmails(d.emails || d);
    } catch (e) {
      console.error("handleSearch:", e);
      setError("Search failed. Please try again.");
    } finally { setLoading(false); }
  }, [emailAddress, searchQuery, currentFolder, fetchEmails]);

  const dlAttachment = useCallback((uid: number, idx: number) => {
    window.open(`/api/email/attachment/${uid}/${idx}?email_address=${enc(emailAddress)}&folder=${enc(currentFolder)}`);
  }, [emailAddress, currentFolder]);

  const flagEmail = useCallback(async (uid: number, action: string) => {
    try {
      await apiFetch("/api/email/flag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_address: emailAddress, uid, folder: currentFolder, action }),
      });
      setSubView("list"); fetchEmails();
    } catch (e) { console.error("flagEmail:", e); }
  }, [emailAddress, currentFolder, fetchEmails]);

  // ------ Effects ------

  useEffect(() => {
    if (connected && emailAddress) { fetchFolders(); fetchEmails(); }
  }, [connected, currentFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------ Handlers ------

  const handleConnect = () => {
    if (!emailAddress.trim()) return;
    setConnected(true); setConfigError(false); setError(null);
    fetchFolders(); fetchEmails();
  };

  const openCompose = (reply?: SerializedEmail) => {
    if (reply) {
      setReplyTo(reply);
      setComposeTo(reply.from[0]?.address || "");
      setComposeSubject(reply.subject.startsWith("Re:") ? reply.subject : `Re: ${reply.subject}`);
      setComposeBody("");
    } else {
      setReplyTo(null); setComposeTo(""); setComposeSubject(""); setComposeBody("");
    }
    setComposeCc(""); setComposeBcc(""); setComposeAttachments([]);
    setSubView("compose");
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setComposeAttachments(p => [...p, ...Array.from(e.dataTransfer.files)]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setComposeAttachments(p => [...p, ...Array.from(e.target.files!)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAtt = (i: number) => setComposeAttachments(p => p.filter((_, x) => x !== i));
  const goList = () => { setSubView("list"); setReplyTo(null); };

  // ------ Render: Config Error ------

  if (configError) {
    return (
      <div style={S.wrapper}>
        <div style={{ ...S.connectCard, gap: "1rem" }}>
          <h2 style={{ color: "var(--text-primary)", margin: 0 }}>Email Not Configured</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", margin: 0 }}>
            Set EMAIL_MASTER_USER or EMAIL_USER in your .env file to enable email.
          </p>
        </div>
      </div>
    );
  }

  // ------ Render: Connect Screen ------

  if (!connected) {
    return (
      <div style={S.wrapper}>
        <div style={S.connectCard}>
          <h2 style={{ color: "var(--text-primary)", margin: 0 }}>Email</h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>
            Enter your email address to connect
          </p>
          <input type="email" placeholder="you@example.com" value={emailAddress}
            onChange={e => setEmailAddress(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleConnect()}
            style={{ ...S.input, maxWidth: 360 }} />
          <button onClick={handleConnect} style={{ ...S.btn, ...S.btnPrimary }}
            disabled={!emailAddress.trim()}>Connect</button>
        </div>
      </div>
    );
  }

  // ------ Render: Detail View ------

  if (subView === "detail" && selectedEmail) {
    const unread = !selectedEmail.flags?.includes("\\Seen");
    return (
      <div style={S.wrapper}>
        <button onClick={() => { setSubView("list"); setSelectedEmail(null); }}
          style={{ ...S.btn, ...S.btnSecondary, alignSelf: "flex-start", marginBottom: "0.5rem" }}>
          &larr; Back to inbox
        </button>

        <div style={S.detailWrapper}>
          <div style={S.detailHeader}>
            <h2 style={{ color: "var(--text-primary)", margin: "0 0 1rem 0", fontSize: "1.25rem" }}>
              {selectedEmail.subject || "(No Subject)"}
            </h2>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.8 }}>
              <div><strong style={{ color: "var(--text-primary)" }}>From:</strong>{" "}
                {selectedEmail.from?.map(fmtAddr).join(", ") || "Unknown"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>To:</strong>{" "}
                {selectedEmail.to?.map(fmtAddr).join(", ")}</div>
              {selectedEmail.cc?.length > 0 && (
                <div><strong style={{ color: "var(--text-primary)" }}>CC:</strong>{" "}
                  {selectedEmail.cc.map(fmtAddr).join(", ")}</div>
              )}
              <div><strong style={{ color: "var(--text-primary)" }}>Date:</strong>{" "}
                {formatDate(selectedEmail.date)}</div>
            </div>
          </div>

          {selectedEmail.attachments?.length > 0 && (
            <div style={S.attachmentBar}>
              {selectedEmail.attachments.map((att, i) => (
                <div key={i} style={S.attachmentChip}
                  onClick={() => dlAttachment(selectedEmail.uid, i)}
                  title={`Download ${att.filename}`}>
                  <span>{att.filename}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                    ({formatSize(att.size)})
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
            {selectedEmail.html ? (
              <iframe srcDoc={selectedEmail.html} sandbox="allow-same-origin" title="Email body"
                style={{ ...S.bodyFrame, background: "white" }} />
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", margin: 0,
                fontFamily: "inherit", fontSize: "0.9rem", lineHeight: 1.6 }}>
                {selectedEmail.text || "(No content)"}
              </pre>
            )}
          </div>

          <div style={S.actionBar}>
            <button onClick={() => openCompose(selectedEmail)} style={{ ...S.btn, ...S.btnSecondary }}>Reply</button>
            <button onClick={() => openCompose(selectedEmail)} style={{ ...S.btn, ...S.btnSecondary }}>Reply All</button>
            <button onClick={() => flagEmail(selectedEmail.uid, unread ? "read" : "unread")}
              style={{ ...S.btn, ...S.btnSecondary }}>{unread ? "Mark Read" : "Mark Unread"}</button>
            <button onClick={() => flagEmail(selectedEmail.uid, "delete")}
              style={{ ...S.btn, ...S.btnDanger }}>Delete</button>
          </div>
        </div>
      </div>
    );
  }

  // ------ Render: Compose View ------

  if (subView === "compose") {
    const isReply = replyTo !== null;
    const canSend = !sending && composeTo.trim().length > 0;
    return (
      <div style={S.wrapper}>
        <button onClick={goList}
          style={{ ...S.btn, ...S.btnSecondary, alignSelf: "flex-start", marginBottom: "0.5rem" }}>
          &larr; Discard
        </button>
        <h2 style={{ color: "var(--text-primary)", margin: "0 0 0.75rem 0" }}>
          {isReply ? `Reply to: ${replyTo.subject}` : "New Email"}
        </h2>

        <div style={S.composeWrapper} onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}>
          <input type="text" placeholder="To" value={composeTo}
            onChange={e => setComposeTo(e.target.value)} style={S.input} />
          <input type="text" placeholder="CC" value={composeCc}
            onChange={e => setComposeCc(e.target.value)} style={S.input} />
          <input type="text" placeholder="BCC" value={composeBcc}
            onChange={e => setComposeBcc(e.target.value)} style={S.input} />
          <input type="text" placeholder="Subject" value={composeSubject}
            onChange={e => setComposeSubject(e.target.value)} style={S.input} />
          <textarea placeholder="Write your message..." value={composeBody}
            onChange={e => setComposeBody(e.target.value)} style={S.textarea} />

          <div>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect}
              style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ ...S.btn, ...S.btnSecondary, marginBottom: "0.5rem" }}>Attach Files</button>
            {composeAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {composeAttachments.map((f, i) => (
                  <div key={i} style={S.attachmentChip}>
                    <span>{f.name}</span>
                    <span onClick={() => removeAtt(i)}
                      style={{ cursor: "pointer", color: "var(--text-secondary)", marginLeft: 4, fontWeight: 700 }}
                      title="Remove attachment">x</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", margin: "0.5rem 0 0 0" }}>
              Drag and drop files here to attach
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={() => isReply ? replyToEmail(false) : sendEmail()} disabled={!canSend}
              style={{ ...S.btn, ...S.btnPrimary, opacity: canSend ? 1 : 0.5,
                cursor: canSend ? "pointer" : "not-allowed" }}>
              {sending ? "Sending..." : "Send"}
            </button>
            {isReply && (
              <button onClick={() => replyToEmail(true)} disabled={sending}
                style={{ ...S.btn, ...S.btnSecondary, opacity: sending ? 0.5 : 1 }}>
                {sending ? "Sending..." : "Send to All"}
              </button>
            )}
            <button onClick={goList} style={{ ...S.btn, ...S.btnSecondary }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ------ Render: List View ------

  return (
    <div style={S.wrapper}>
      {error && (
        <div style={{ padding: "0.65rem 1rem", borderRadius: 8, fontSize: "0.85rem",
          backgroundColor: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#ef4444" }}>
          {error}
        </div>
      )}

      <div style={S.layout}>
        {/* Folder Sidebar */}
        <div style={S.folderSidebar}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase",
            fontWeight: 600, letterSpacing: "0.05em", marginBottom: "0.5rem", padding: "0 0.75rem" }}>
            Folders
          </div>
          {folders.map(f => {
            const active = f.path === currentFolder;
            return (
              <div key={f.path}
                onClick={() => { setCurrentFolder(f.path); setSubView("list"); }}
                style={{ ...S.folderItem, ...(active ? S.folderItemActive : {}),
                  color: active ? "white" : "var(--text-primary)" }}>
                <span>{f.name}</span>
                {f.messages.unread > 0 && (
                  <span style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : "var(--accent)",
                    color: "white", borderRadius: 10, padding: "1px 7px", fontSize: "0.75rem",
                    fontWeight: 600, minWidth: 20, textAlign: "center" }}>
                    {f.messages.unread}
                  </span>
                )}
              </div>
            );
          })}
          {folders.length === 0 && !loading && (
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", padding: "0.5rem 0.75rem" }}>
              No folders loaded
            </div>
          )}
        </div>

        {/* Email List */}
        <div style={S.emailListContainer}>
          <div style={S.toolbar}>
            <input type="text" placeholder="Search emails..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              style={{ ...S.input, flex: 1 }} />
            <button onClick={handleSearch} style={{ ...S.btn, ...S.btnSecondary }}>Search</button>
            <button onClick={() => openCompose()} style={{ ...S.btn, ...S.btnPrimary }}>Compose</button>
            <button onClick={() => { fetchFolders(); fetchEmails(); }}
              style={{ ...S.btn, ...S.btnSecondary }} title="Refresh">Refresh</button>
          </div>

          <div style={S.emailList}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "3rem", gap: "0.75rem" }}>
                <div style={S.spinner} />
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading emails...</span>
              </div>
            ) : emails.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                padding: "3rem", color: "var(--text-secondary)" }}>
                No emails found
              </div>
            ) : (
              emails.map(email => {
                const unread = !email.flags?.includes("\\Seen");
                return (
                  <div key={email.id || email.uid} onClick={() => fetchDetail(email.uid)}
                    style={S.emailRow}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-tertiary)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
                    <div style={unread ? S.unreadDot : S.readDot} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ color: "var(--text-primary)", fontSize: "0.9rem",
                          fontWeight: unread ? 600 : 400, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fmtSender(email.from)}
                        </span>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem",
                          flexShrink: 0, marginLeft: "1rem" }}>
                          {formatDate(email.date)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ color: unread ? "var(--text-primary)" : "var(--text-secondary)",
                          fontSize: "0.85rem", fontWeight: unread ? 600 : 400, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {email.subject || "(No Subject)"}
                        </span>
                        {email.attachments?.length > 0 && (
                          <span title="Has attachments" style={{ flexShrink: 0 }}>📎</span>
                        )}
                      </div>
                      {email.snippet && (
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginTop: 2 }}>
                          {email.snippet}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const S: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex", flexDirection: "column", height: "100%",
    padding: "1.5rem", gap: "1rem",
  },
  connectCard: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "1rem", height: "100%",
    maxWidth: 400, margin: "0 auto",
  },
  layout: {
    display: "flex", flex: 1, gap: "1rem", overflow: "hidden",
  },
  folderSidebar: {
    width: 200, flexShrink: 0, backgroundColor: "var(--bg-secondary)",
    borderRadius: 12, padding: "0.75rem", overflowY: "auto" as const,
  },
  folderItem: {
    padding: "0.5rem 0.75rem", borderRadius: 8, cursor: "pointer",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontSize: "0.9rem", transition: "background 0.15s",
  },
  folderItemActive: { backgroundColor: "var(--accent)", color: "white" },
  emailListContainer: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  toolbar: { display: "flex", gap: "0.5rem", marginBottom: "0.75rem" },
  emailList: {
    flex: 1, overflowY: "auto" as const,
    backgroundColor: "var(--bg-secondary)", borderRadius: 12,
  },
  emailRow: {
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)",
    cursor: "pointer", transition: "background 0.15s",
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: "50%",
    backgroundColor: "#3b82f6", flexShrink: 0,
  },
  readDot: {
    width: 8, height: 8, borderRadius: "50%",
    backgroundColor: "transparent", flexShrink: 0,
  },
  detailWrapper: { flex: 1, overflowY: "auto" as const },
  detailHeader: {
    backgroundColor: "var(--bg-secondary)", borderRadius: 12,
    padding: "1.5rem", marginBottom: "1rem",
  },
  attachmentBar: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" },
  attachmentChip: {
    display: "inline-flex", alignItems: "center", gap: "0.5rem",
    padding: "0.5rem 0.75rem", backgroundColor: "var(--bg-tertiary)",
    borderRadius: 8, fontSize: "0.85rem", cursor: "pointer",
    border: "1px solid var(--border)", color: "var(--text-primary)",
  },
  bodyFrame: { width: "100%", minHeight: 400, border: "none", borderRadius: 8 },
  actionBar: {
    display: "flex", gap: "0.5rem", marginTop: "1rem",
    paddingTop: "1rem", borderTop: "1px solid var(--border)",
  },
  composeWrapper: { display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 },
  input: {
    width: "100%", padding: "0.65rem 0.75rem",
    backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem",
    outline: "none", boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%", minHeight: 250, padding: "0.75rem",
    backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem",
    resize: "vertical" as const, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box" as const,
  },
  btn: {
    padding: "0.5rem 1rem", borderRadius: 8, border: "none",
    cursor: "pointer", fontSize: "0.9rem", fontWeight: 500,
  },
  btnPrimary: { backgroundColor: "var(--accent)", color: "white" },
  btnSecondary: {
    backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)",
    border: "1px solid var(--border)",
  },
  btnDanger: { backgroundColor: "#ef4444", color: "white" },
  spinner: {
    width: 28, height: 28, border: "3px solid var(--border)",
    borderTopColor: "var(--accent)", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
