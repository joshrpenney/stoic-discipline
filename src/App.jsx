import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signOut, updateProfile
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, runTransaction
} from "firebase/firestore";
import { Activity, BookOpen, Check, Circle, Dumbbell, Flame, LogOut, Plus, ShieldCheck, Sunrise, Moon, Footprints, Target, Trash2, Trophy, Award, Star, Sparkles } from "lucide-react";
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
  const [progression, setProgression] = useState({ totalXp: 0, totalActions: 0 });
  const [dailyLogs, setDailyLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("Today");
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
    if (!user || !db) { setHabits([]); setChecks({}); setProgression({ totalXp: 0, totalActions: 0 }); setDailyLogs([]); return; }
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
    const stopProgression = onSnapshot(doc(db, "users", user.uid, "progression", "summary"), (snapshot) => setProgression(snapshot.exists() ? snapshot.data() : { totalXp: 0, totalActions: 0 }), (e) => setError(e.message));
    const stopLogs = onSnapshot(collection(db, "users", user.uid, "dailyLogs"), (snapshot) => setDailyLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => setError(e.message));
    return () => { stopHabits(); stopChecks(); stopProgression(); stopLogs(); };
  }, [user]);

  const activeHabits = habits.filter((h) => h.active !== false);
  const doneCount = activeHabits.filter((h) => checks[h.id]).length;
  const percent = activeHabits.length ? Math.round(doneCount / activeHabits.length * 100) : 0;
  const streak = useMemo(() => {
    const days = new Set(dailyLogs.filter(log => Object.values(log.completed || {}).some(Boolean)).map(log => log.date || log.id));
    let count = 0; const d = new Date();
    while (true) { const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; if (!days.has(key)) break; count++; d.setDate(d.getDate()-1); }
    return count;
  }, [dailyLogs]);
  const levelInfo = useMemo(() => {
    const xp = Math.max(0, Number(progression.totalXp) || 0);
    const levels = [{level:1,name:"Initiate",xp:0},{level:2,name:"Disciple",xp:100},{level:3,name:"Practitioner",xp:300},{level:4,name:"Stoic",xp:600},{level:5,name:"Sentinel",xp:1000},{level:6,name:"Guardian",xp:1500},{level:7,name:"Exemplar",xp:2200},{level:8,name:"Virtuoso",xp:3000},{level:9,name:"Philosopher",xp:4000},{level:10,name:"Sage",xp:5200}];
    let current=levels[0], next=null; for (const item of levels) { if (xp>=item.xp) current=item; else {next=item;break;} }
    return {level:current.level,name:current.name,xp,next,progress:next?Math.round((xp-current.xp)/(next.xp-current.xp)*100):100,remaining:next?next.xp-xp:0};
  }, [progression.totalXp]);
  const achievements = useMemo(() => { const n=Number(progression.totalActions)||0; return [{title:"First Promise",detail:"Complete your first commitment",unlocked:n>=1,icon:Star},{title:"Seven in Motion",detail:"Reach a 7-day streak",unlocked:streak>=7,icon:Flame},{title:"A Hundred Deeds",detail:"Complete 100 commitments",unlocked:n>=100,icon:Award},{title:"A Month of Resolve",detail:"Reach a 30-day streak",unlocked:streak>=30,icon:Trophy}]; }, [progression.totalActions,streak]);

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
    const logRef=doc(db,"users",user.uid,"dailyLogs",todayKey());
    const progressionRef=doc(db,"users",user.uid,"progression","summary");
    try { let earned=0, completing=false;
      await runTransaction(db, async (transaction) => {
        const logSnap=await transaction.get(logRef); const pSnap=await transaction.get(progressionRef);
        const log=logSnap.exists()?logSnap.data():{}; const completed={...(log.completed||{})}; const xpAwarded={...(log.xpAwarded||{})};
        completing=!completed[habit.id]; completed[habit.id]=completing;
        const p=pSnap.exists()?pSnap.data():{totalXp:0,totalActions:0}; let totalXp=Number(p.totalXp)||0; let totalActions=Number(p.totalActions)||0;
        if(completing&&!xpAwarded[habit.id]) { earned=10; xpAwarded[habit.id]=true; totalXp+=earned; totalActions++; }
        transaction.set(logRef,{date:todayKey(),completed,xpAwarded,updatedAt:serverTimestamp()},{merge:true});
        transaction.set(progressionRef,{totalXp,totalActions,updatedAt:serverTimestamp()},{merge:true});
      });
      setNotice(completing?(earned?`Promise kept. +${earned} XP earned.`:"Promise kept. XP for this commitment was already earned today."):"Record updated. Earned XP is kept.");
    } catch(e) { setError(e.message); }
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
    {activeTab === "Today" && <>
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
    <section className="level-card">
      <div className="level-top"><div className="level-emblem"><ShieldCheck size={24}/></div><div className="level-copy"><p className="eyebrow">YOUR PATH</p><h2>Level {levelInfo.level} · {levelInfo.name}</h2><p>{levelInfo.xp.toLocaleString()} XP earned</p></div><div className="xp-total"><Sparkles size={15}/><strong>{levelInfo.xp.toLocaleString()}</strong><span>XP</span></div></div>
      <div className="level-track"><div style={{width:`${levelInfo.progress}%`}}/></div>
      <div className="level-foot"><span>{levelInfo.next?`${levelInfo.remaining} XP to Level ${levelInfo.next.level}`:"Keep practising to honour the work."}</span><span>{levelInfo.progress}%</span></div>
      <div className="stats-row"><div><Flame size={16}/><strong>{streak}</strong><span>day streak</span></div><div><Target size={16}/><strong>{Number(progression.totalActions||0).toLocaleString()}</strong><span>actions</span></div><div><Trophy size={16}/><strong>{achievements.filter(a=>a.unlocked).length}/{achievements.length}</strong><span>badges</span></div></div>
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
    <section className="achievements-section">
      <div className="section-heading"><div><p className="eyebrow">PROOF OF PRACTICE</p><h2>Achievements</h2></div><span className="achievement-count">{achievements.filter(a=>a.unlocked).length} unlocked</span></div>
      <div className="achievement-grid">{achievements.map((a)=>{const Icon=a.icon;return <article className={`achievement ${a.unlocked?"unlocked":"locked"}`} key={a.title}><div className="achievement-icon"><Icon size={20}/></div><div><strong>{a.title}</strong><span>{a.detail}</span></div><div className="achievement-status">{a.unlocked?<Check size={16}/>:<span>•••</span>}</div></article>;})}</div>
    </section>
    <section className="principle-card"><div className="quote-mark">“</div><p>You have power over your mind — not outside events. Realise this, and you will find strength.</p><span>— Marcus Aurelius, <i>Meditations</i> (paraphrased)</span></section>
    </>}
    {activeTab !== "Today" && <section className="tab-page">
      <p className="eyebrow">{activeTab === "Training" ? "BUILD CAPACITY" : activeTab === "Reading" ? "TRAIN THE MIND" : "EXAMINE THE DAY"}</p>
      <h1 className="tab-title">{activeTab === "Training" ? "Training" : activeTab === "Reading" ? "Reading" : "Reflect"}</h1>
      <p className="muted">{activeTab === "Training" ? "Keep your training commitments visible and record each session by completing the relevant habit below." : activeTab === "Reading" ? "Make deliberate time for books. Complete your reading habits and add a reading commitment if you need one." : "Review the day honestly, without judgement. Complete your reflection habits and keep your promises to yourself."}</p>
      <div className="tab-summary"><div><strong>{activeTab === "Training" ? "Training focus" : activeTab === "Reading" ? "Reading focus" : "Mindset focus"}</strong><span>Completed commitments still earn XP and count toward your progress.</span></div><button className="add-button" onClick={() => {setShowAdd(true);setNewCategory(activeTab === "Training" ? "Training" : activeTab === "Reading" ? "Reading" : "Mindset");setActiveTab("Today");}}>+ Add habit</button></div>
      <div className="habit-list">{activeHabits.filter(h => activeTab === "Training" ? ["Training","Running","Walking","Movement"].includes(h.category) : activeTab === "Reading" ? h.category === "Reading" : ["Mindset","Morning","Evening"].includes(h.category)).map(h => {const Icon=categoryIcon(h.category);return <article className={`habit ${checks[h.id]?"completed":""}`} key={h.id}><button className="habit-check" onClick={() => toggleHabit(h)} aria-label={checks[h.id]?"Mark incomplete":"Mark complete"}>{checks[h.id]?<Check size={19}/>:<Circle size={21}/>}</button><div className="habit-icon"><Icon size={19}/></div><button className="habit-copy" onClick={() => toggleHabit(h)}><strong>{h.title}</strong><span>{h.target || h.category}{h.nonNegotiable?" · NON-NEGOTIABLE":""}</span></button><button className="remove-button" onClick={() => removeHabit(h)} aria-label={"Archive "+h.title}><Trash2 size={16}/></button></article>;})}
      {!activeHabits.some(h => activeTab === "Training" ? ["Training","Running","Walking","Movement"].includes(h.category) : activeTab === "Reading" ? h.category === "Reading" : ["Mindset","Morning","Evening"].includes(h.category)) && <div className="empty"><Target size={30}/><h3>No {activeTab.toLowerCase()} habits yet</h3><p>Add a commitment for this area to track it here.</p><button className="primary" onClick={() => {setShowAdd(true);setNewCategory(activeTab === "Training" ? "Training" : activeTab === "Reading" ? "Reading" : "Mindset");setActiveTab("Today");}}>Add a habit</button></div>}
      </div>
      <section className="principle-card"><div className="quote-mark">“</div><p>{activeTab === "Training" ? "The body is strengthened by effort; the mind by deliberate practice." : activeTab === "Reading" ? "Do not merely say you have read books. Show that through the principles you live by." : "Ask yourself: what did I do well, and what can I do better tomorrow?"}</p><span>STOIC PRACTICE</span></section>
    </section>}
    <nav className="bottom-nav">{[["Today",Target],["Training",Dumbbell],["Reading",BookOpen],["Reflect",Moon]].map(([label,Icon]) => <button type="button" key={label} className={`nav-item ${activeTab===label?"active":""}`} onClick={() => {setActiveTab(label);setError("");setNotice("");}}><Icon size={19}/><span>{label}</span></button>)}</nav>
    <p className="footnote">XP is awarded once per commitment each day. Unticking a commitment does not remove earned XP. Your progress is saved to your private Firebase account.</p>
  </main>;
}
