import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

const dmKey = (a, b) => [a, b].sort().join("__");

const fonts = {
  display: "'Fraunces', Georgia, serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

const colors = {
  ink: "#141B24",
  panel: "#1C2530",
  panelRaised: "#232E3B",
  brass: "#C9A24B",
  brassDim: "#8A7238",
  parchment: "#EDE6D6",
  slate: "#8B97A6",
  sage: "#6FA287",
  amber: "#D9A441",
  rust: "#C1533E",
  hairline: "#324153",
};

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Seal({ status }) {
  const map = {
    approved: { c: colors.sage, label: "Approved" },
    pending: { c: colors.amber, label: "Pending" },
    owner: { c: colors.brass, label: "Founder" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: s.c }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [members, setMembers] = useState([]);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", passcode: "", displayName: "" });
  const [authError, setAuthError] = useState("");
  const [pendingNotice, setPendingNotice] = useState("");
  const [activeThread, setActiveThread] = useState("group");
  const [groupMsgs, setGroupMsgs] = useState([]);
  const [dmMsgs, setDmMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase.from("members").select("*").order("created_at", { ascending: true });
    if (!error) setMembers(data || []);
  }, []);

  const loadGroup = useCallback(async () => {
    const { data, error } = await supabase.from("group_messages").select("*").order("created_at", { ascending: true }).limit(200);
    if (!error) setGroupMsgs((data || []).map((m) => ({ from: m.from_username, text: m.body, ts: m.created_at })));
  }, []);

  const loadDm = useCallback(async (peer, me) => {
    const { data, error } = await supabase
      .from("dm_messages")
      .select("*")
      .eq("pair_key", dmKey(me, peer))
      .order("created_at", { ascending: true })
      .limit(200);
    if (!error) setDmMsgs((data || []).map((m) => ({ from: m.from_username, text: m.body, ts: m.created_at })));
  }, []);

  useEffect(() => {
    loadMembers().then(() => setReady(true));
  }, [loadMembers]);

  useEffect(() => {
    const iv = setInterval(() => {
      loadMembers();
      if (activeThread === "group") loadGroup();
      else if (session) loadDm(activeThread, session);
    }, 3000);
    return () => clearInterval(iv);
  }, [activeThread, session, loadMembers, loadGroup, loadDm]);

  useEffect(() => {
    if (activeThread === "group") loadGroup();
    else if (session) loadDm(activeThread, session);
  }, [activeThread, session, loadGroup, loadDm]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [groupMsgs, dmMsgs]);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    setPendingNotice("");
    const uname = form.username.trim().toLowerCase();
    if (!uname || !form.passcode) {
      setAuthError("Enter a username and passcode.");
      return;
    }

    const { data: current } = await supabase.from("members").select("*");

    if (mode === "signup") {
      if ((current || []).some((m) => m.username === uname)) {
        setAuthError("That username is taken.");
        return;
      }
      const isFirst = (current || []).length === 0;
      const { error } = await supabase.from("members").insert({
        username: uname,
        passcode: form.passcode,
        display_name: form.displayName.trim() || uname,
        status: isFirst ? "owner" : "pending",
      });
      if (error) {
        setAuthError("Couldn't reach the database. Try again.");
        return;
      }
      await loadMembers();
      if (isFirst) {
        setSession(uname);
      } else {
        setPendingNotice("Request sent. You'll be able to log in once the founder approves you.");
        setMode("login");
      }
      setForm({ username: "", passcode: "", displayName: "" });
      return;
    }

    const match = (current || []).find((m) => m.username === uname && m.passcode === form.passcode);
    if (!match) {
      setAuthError("No matching account. Check your username and passcode.");
      return;
    }
    if (match.status === "pending") {
      setPendingNotice("Your request is still awaiting approval.");
      return;
    }
    setSession(uname);
    setForm({ username: "", passcode: "", displayName: "" });
  }

  async function setStatus(username, status) {
    await supabase.from("members").update({ status }).eq("username", username);
    loadMembers();
  }

  async function removeMember(username) {
    await supabase.from("members").delete().eq("username", username);
    loadMembers();
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !session) return;
    setDraft("");
    if (activeThread === "group") {
      await supabase.from("group_messages").insert({ from_username: session, body: text });
      loadGroup();
    } else {
      await supabase.from("dm_messages").insert({ pair_key: dmKey(session, activeThread), from_username: session, body: text });
      loadDm(activeThread, session);
    }
  }

  const me = members.find((m) => m.username === session);
  const isOwner = me && me.status === "owner";
  const pending = members.filter((m) => m.status === "pending");
  const roster = members.filter((m) => m.status !== "pending" && m.username !== session);

  const pageStyle = { minHeight: "100vh", background: colors.ink, color: colors.parchment, fontFamily: fonts.body, display: "flex", flexDirection: "column" };

  if (!ready) {
    return (
      <div style={{ ...pageStyle, alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.slate }}>Opening the ledger…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ ...pageStyle, alignItems: "center", justifyContent: "center", padding: "48px 20px" }}>
        <div style={{ width: "100%", maxWidth: 380, background: colors.panel, border: `1px solid ${colors.hairline}`, borderRadius: 14, padding: "36px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, margin: "0 auto 14px", borderRadius: "50%", border: `1px solid ${colors.brass}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fonts.display, fontSize: 18, color: colors.brass }}>C</div>
            <h1 style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 24, margin: 0 }}>The Clubhouse</h1>
            <p style={{ color: colors.slate, fontSize: 13, marginTop: 6 }}>Members only. Request to join, then wait for the nod.</p>
          </div>

          <div style={{ display: "flex", marginBottom: 22, border: `1px solid ${colors.hairline}`, borderRadius: 8, overflow: "hidden" }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setAuthError(""); setPendingNotice(""); }} style={{ flex: 1, padding: "9px 0", fontFamily: fonts.mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", background: mode === m ? colors.panelRaised : "transparent", color: mode === m ? colors.brass : colors.slate, border: "none", cursor: "pointer" }}>
                {m === "login" ? "Sign in" : "Request access"}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 12, color: colors.slate }}>
              Username
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoCapitalize="off" style={inputStyle} />
            </label>
            {mode === "signup" && (
              <label style={{ fontSize: 12, color: colors.slate }}>
                Display name
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={inputStyle} />
              </label>
            )}
            <label style={{ fontSize: 12, color: colors.slate }}>
              Passcode
              <input type="password" value={form.passcode} onChange={(e) => setForm({ ...form, passcode: e.target.value })} style={inputStyle} />
            </label>

            {authError && <div style={{ color: colors.rust, fontSize: 12 }}>{authError}</div>}
            {pendingNotice && <div style={{ color: colors.amber, fontSize: 12 }}>{pendingNotice}</div>}

            <button type="submit" style={primaryBtn}>
              {mode === "login" ? "Enter the clubhouse" : "Send request"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const thread = activeThread === "group" ? groupMsgs : dmMsgs;
  const threadLabel = activeThread === "group" ? "Group room" : members.find((m) => m.username === activeThread)?.display_name || activeThread;

  return (
    <div style={{ ...pageStyle, flexDirection: "row" }}>
      <div style={{ width: 230, borderRight: `1px solid ${colors.hairline}`, background: colors.panel, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ fontFamily: fonts.display, fontSize: 17, color: colors.brass }}>The Clubhouse</div>
          <div style={{ fontSize: 11, color: colors.slate, marginTop: 2 }}>
            Signed in as {me?.display_name || session} <Seal status={me?.status} />
          </div>
        </div>

        <button onClick={() => setActiveThread("group")} style={navItem(activeThread === "group")}>Group room</button>

        <div>
          <div style={sectionLabel}>Members ({roster.length + 1})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {roster.map((m) => (
              <button key={m.username} onClick={() => setActiveThread(m.username)} style={navItem(activeThread === m.username)}>
                <span>{m.display_name}</span>
                <Seal status={m.status} />
              </button>
            ))}
          </div>
        </div>

        {isOwner && pending.length > 0 && (
          <div>
            <div style={sectionLabel}>Requests ({pending.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {pending.map((m) => (
                <div key={m.username} style={{ background: colors.panelRaised, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 12.5, marginBottom: 6 }}>{m.display_name}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setStatus(m.username, "approved")} style={smallBtn(colors.sage)}>Approve</button>
                    <button onClick={() => removeMember(m.username)} style={smallBtn(colors.rust)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setSession(null)} style={{ ...navItem(false), marginTop: "auto", color: colors.slate }}>Sign out</button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.hairline}`, fontFamily: fonts.display, fontSize: 16 }}>{threadLabel}</div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {thread.length === 0 && <div style={{ color: colors.slate, fontSize: 13, fontStyle: "italic" }}>No messages yet. Say hello.</div>}
          {thread.map((m, i) => (
            <div key={i} style={{ maxWidth: "70%", alignSelf: m.from === session ? "flex-end" : "flex-start" }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.slate, marginBottom: 3 }}>
                {m.from === session ? "You" : members.find((x) => x.username === m.from)?.display_name || m.from} · {timeStr(m.ts)}
              </div>
              <div style={{ background: m.from === session ? colors.brassDim : colors.panelRaised, color: colors.parchment, borderRadius: 10, padding: "9px 13px", fontSize: 14, lineHeight: 1.45 }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${colors.hairline}`, display: "flex", gap: 10 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Write something…" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          <button onClick={sendMessage} style={{ ...primaryBtn, width: 90 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", marginTop: 5, background: colors.ink, border: `1px solid ${colors.hairline}`, borderRadius: 7, padding: "9px 11px", color: colors.parchment, fontSize: 14, outline: "none", boxSizing: "border-box" };
const primaryBtn = { marginTop: 4, background: colors.brass, color: colors.ink, border: "none", borderRadius: 7, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" };
function smallBtn(c) { return { flex: 1, background: "transparent", border: `1px solid ${c}`, color: c, borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer" }; }
function navItem(active) { return { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", background: active ? colors.panelRaised : "transparent", border: "none", color: active ? colors.parchment : colors.slate, padding: "8px 10px", borderRadius: 7, fontSize: 13, cursor: "pointer" }; }
const sectionLabel = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.slate };
