import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signOut, updateProfile
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc
} from "firebase/firestore";
import { Activity, BookOpen, Check, Circle, Dumbbell, Flame, LogOut, Plus, ShieldCheck, Sunrise, Moon, Footprints, Target, Trash2 } from "lucide-react";
import { auth, db, firebaseConfigured } from "./firebase";

const starterHabits = [
  { title: "Morning routine", category: "Mindset", target: "Start the day deliberately", nonNegotiable: true },
  { title: "Read 10 pages", category: "Reading", target: "10 pages", nonNegotiable: true },
  { title: "Move for at least 20 minutes", category: "Movement", target: "20 minutes", nonNegotiable: false },
  { title: "Evening reflection", category: "Mindset", target: "Review the day", nonNegotiable: true }
];
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const prettyDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const categoryIcon = (category) => {
  if (category === "Training") return Dumbbell;
  if (category === "Running") return Activity;
  if (category === "Walking" || category === "Movement") return Footprints;
  if (category === "Reading") return BookOpen;
  if (category === "Evening") return Moon;
  if (category === "Morning") return Sunrise;
  return Target;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [habits, setHabits] = useState([]);
  const [checks, setChecks] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Mindset");
  const [newTarget, setNewTarget] = useState("");
  const [newNonNegotiable, setNewNonNegotiable] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    return onAuthStateChanged(auth, (current) => { setUser(current); setAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!user || !db) { setHabits([]); setChecks({}); return; }
    const habitQuery = query(collection(db, "users", user.uid, "habits"), orderBy("createdAt", "asc"));
    const stopHabits = onSnapshot(habitQuery, async (snapshot) => {
      if (snapshot.empty) {
        // Seed starter habits only for a brand-new account with no saved habits.
        for (const h of starterHabits) {
          await addDoc(collection(db, "users", user.uid, "habits"), {
            ...h, active: true, createdAt: serverTimestamp()
          });
        }
        return;
      }
      setHabits(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => setError(e.message));
    const checkRef = doc(db, "users", user.uid, "dailyLogs", todayKey());
    const stopChecks = onSnapshot(checkRef, (snapshot) => setChecks(snapshot.exists() ? (snapshot.data().completed || {}) : {}), (e) => setError(e.message));
    return () => { stopHabits(); stopChecks(); };
  }, [user]);

  const activeHabits = habits.filter((h) => h.active !== false);
  const doneCount = activeHabits.filter((h) => checks[h.id]).length;
  const percent = activeHabits.length ? Math.round(doneCount / activeHabits.length * 100) : 0;
  const streak = useMemo(() => {
    // Count consecutive calendar days on which every currently active habit was completed.
    // This is calculated from saved daily logs; detailed historical streaks are added next.
    return doneCount === activeHabits.length && activeHabits.length > 0 ? 1 : 0;
  }, [doneCount, activeHabits.length]);

  async function handleAuth(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (!firebaseConfigured) throw new Error("Firebase is not configured yet. Follow SETUP.md and add your .env.local values.");
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: displayName.trim(), email: email.trim(), createdAt: serverTimestamp()
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) { setError(e.message.replace("Firebase: ", "")); }
    finally { setBusy(false); }
  }

  async function toggleHabit(habit) {
    if (!user || !db) return;
    setError(""); setNotice("");
    const next = { ...checks, [habit.id]: !checks[habit.id] };
    try {
      await setDoc(doc(db, "users", user.uid, "dailyLogs", todayKey()), {
        date: todayKey(), completed: next, updatedAt: serverTimestamp()
      }, { merge: true });
      setNotice(next[habit.id] ? "Promise kept. One deliberate action at a time." : "Updated today's record.");
    } catch (e) { setError(e.message); }
  }

  async function addHabit(e) {
    e.preventDefault();
    if (!newTitle.trim() || !user || !db) return;
    try {
      await addDoc(collection(db, "users", user.uid, "habits"), {
        title: newTitle.trim(), category: newCategory, target: newTarget.trim(),
        nonNegotiable: newNonNegotiable, active: true, createdAt: serverTimestamp()
      });
      setNewTitle(""); setNewTarget(""); setNewCategory("Mindset"); setNewNonNegotiable(true); setShowAdd(false);
      setNotice("Commitment added.");
    } catch (e) { setError(e.message); }
  }

  async function removeHabit(habit) {
    if (!user || !db || !confirm(`Remove "${habit.title}"? Previous daily records are retained.`)) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "habits", habit.id), { active: false });
      setNotice("Commitment archived. Previous records are retained.");
    } catch (e) { setError(e.message); }
  }

  if (!authReady) return <div className="screen-center"><div className="loader" /><p>Preparing your journal…</p></div>;

  if (!user) return <main className="auth-shell">
    <div className="auth-card">
      <div className="brand-mark">S</div>
      <p className="eyebrow">DISCIPLINE JOURNAL</p>
      <h1>Become harder<br/><span>to break.</span></h1>
      <p className="muted intro">Keep the promises you make to yourself. Build strength, one deliberate day at a time.</p>
      {!firebaseConfigured && <div className="setup-warning"><ShieldCheck size={18}/><span>Setup needed: connect a new Firebase project using the included SETUP.md guide.</span></div>}
      <div className="auth-tabs">
        <button className={mode === "login" ? "selected" : ""} onClick={() => {setMode("login"); setError("");}}>Log in</button>
        <button className={mode === "register" ? "selected" : ""} onClick={() => {setMode("register"); setError("");}}>Create account</button>
      </div>
      <form onSubmit={handleAuth} className="auth-form">
        {mode === "register" && <label>Your name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="What should we call you?" autoComplete="name" /></label>}
        <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
        <label>Password<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode==="register"?"new-password":"current-password"} /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create my account" : "Enter your journal"} <span>→</span></button>
      </form>
      <p className="fine-print">Your journal is private to your account. Never reuse a password from another service.</p>
    </div>
  </main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-small">S</div><div><strong>STOIC</strong><span>DISCIPLINE JOURNAL</span></div></div>
      <button className="icon-button" title="Sign out" onClick={() => signOut(auth)}><LogOut size={18}/></button>
    </header>
    <section className="welcome">
      <p className="eyebrow">{prettyDate.format(new Date()).toUpperCase()}</p>
      <h1>Do what matters.<br/><span>Leave the rest.</span></h1>
      <p className="muted">Welcome back{user.displayName ? `, ${user.displayName}` : ""}. Focus on the actions within your control.</p>
    </section>
    <section className="progress-card">
      <div className="progress-heading"><div><p className="eyebrow">TODAY'S DISCIPLINE</p><h2>{doneCount} <span>/ {activeHabits.length}</span></h2></div><div className="streak"><Flame size={19}/><div><strong>{streak} day</strong><small>current streak*</small></div></div></div>
      <div className="progress-track"><div style={{width:`${percent}%`}}/></div>
      <div className="progress-foot"><span>{percent}% complete</span><span>{percent===100 && activeHabits.length ? "Promises kept for today." : "Small actions. Repeated daily."}</span></div>
    </section>
    <section className="section-heading"><div><p className="eyebrow">YOUR COMMITMENTS</p><h2>Today's checklist</h2></div><button className="add-button" onClick={()=>setShowAdd(v=>!v)}><Plus size={17}/><span>Add</span></button></section>
    {showAdd && <form className="add-form" onSubmit={addHabit}>
      <label>Commitment<input autoFocus required maxLength="80" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Walk for 20 minutes"/></label>
      <div className="form-row"><label>Category<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target (optional)<input value={newTarget} onChange={e=>setNewTarget(e.target.value)} placeholder="e.g. 10 pages"/></label></div>
      <label className="check-label"><input type="checkbox" checked={newNonNegotiable} onChange={e=>setNewNonNegotiable(e.target.checked)}/> Mark as a non-negotiable</label>
      <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary">Save commitment</button></div>
    </form>}
    {error && <div className="error-banner">{error}</div>}
    {notice && <p className="notice">{notice}</p>}
    <div className="habit-list">
      {activeHabits.map(h => {const Icon=categoryIcon(h.category); return <article className={`habit ${checks[h.id]?"completed":""}`} key={h.id}>
        <button className="habit-check" aria-label={checks[h.id]?"Mark incomplete":"Mark complete"} onClick={()=>toggleHabit(h)}>{checks[h.id]?<Check size={19}/>:<Circle size={21}/>}</button>
        <div className="habit-icon"><Icon size={19}/></div>
        <button className="habit-copy" onClick={()=>toggleHabit(h)}><strong>{h.title}</strong><span>{h.target || h.category}{h.nonNegotiable ? " · NON-NEGOTIABLE" : ""}</span></button>
        <button className="remove-button" aria-label={`Archive ${h.title}`} onClick={()=>removeHabit(h)}><Trash2 size={16}/></button>
      </article>;})}
      {!activeHabits.length && <div className="empty"><Target size={30}/><h3>Choose your commitments</h3><p>Add a few small actions you can realistically repeat.</p></div>}
    </div>
    <section className="principle-card"><div className="quote-mark">“</div><p>You have power over your mind — not outside events. Realise this, and you will find strength.</p><span>— Marcus Aurelius, <i>Meditations</i> (paraphrased)</span></section>
    <nav className="bottom-nav"><div className="nav-item active"><Target size={19}/><span>Today</span></div><div className="nav-item muted-nav"><Dumbbell size={19}/><span>Training</span></div><div className="nav-item muted-nav"><BookOpen size={19}/><span>Reading</span></div><div className="nav-item muted-nav"><Moon size={19}/><span>Reflect</span></div></nav>
    <p className="footnote">*The streak counter is a foundation preview and currently reflects today's completion only. Historical streak calculation will be added with the next iteration.</p>
  </main>;
}
