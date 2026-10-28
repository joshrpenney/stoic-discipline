import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signOut, updateProfile
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, startAt, endAt, limit,
  serverTimestamp, setDoc, updateDoc, runTransaction
} from "firebase/firestore";
import { Activity, BookOpen, Check, Circle, Dumbbell, Flame, LogOut, Plus, ShieldCheck, Sunrise, Moon, Footprints, Target, Trash2, Trophy, Award, Star, Sparkles, Settings, Pencil, ArrowLeft, Users, UserPlus, UserCheck, Search, RefreshCw } from "lucide-react";
import { auth, db, firebaseConfigured } from "./firebase";

const starterHabits = [
  { title: "Morning routine", category: "Mindset", target: "Start the day deliberately", nonNegotiable: true },
  { title: "Read 10 pages", category: "Reading", target: "10 pages", nonNegotiable: true },
  { title: "Move for at least 20 minutes", category: "Movement", target: "20 minutes", nonNegotiable: false },
  { title: "Evening reflection", category: "Mindset", target: "Review the day", nonNegotiable: true }
];
const WEEKDAYS = [{label:"Mon",value:1},{label:"Tue",value:2},{label:"Wed",value:3},{label:"Thu",value:4},{label:"Fri",value:5},{label:"Sat",value:6},{label:"Sun",value:0}];
const dayKey = (date) => date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
const todayKey = () => {
  const d = new Date();
  return dayKey(d);
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
  const [books, setBooks] = useState([]);
  const [bookInput, setBookInput] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookStarted, setBookStarted] = useState(todayKey());
  const [bookFinished, setBookFinished] = useState("");
  const [bookPage, setBookPage] = useState("1");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Mindset");
  const [newTarget, setNewTarget] = useState("");
  const [newNonNegotiable, setNewNonNegotiable] = useState(true);
  const [newSchedule, setNewSchedule] = useState([0,1,2,3,4,5,6]);
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingCategory, setEditingCategory] = useState("Mindset");
  const [editingTarget, setEditingTarget] = useState("");
  const [editingIsNonNegotiable, setEditingIsNonNegotiable] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState([0,1,2,3,4,5,6]);
  const [notice, setNotice] = useState("");
  const [accountName, setAccountName] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("stoic-theme") || "dark");
  const [settingsSection, setSettingsSection] = useState("menu");
  const [communitySearch, setCommunitySearch] = useState("");
  const [communityResults, setCommunityResults] = useState([]);
  const [followingRecords, setFollowingRecords] = useState([]);
  const [followerRecords, setFollowerRecords] = useState([]);
  const [communityBusy, setCommunityBusy] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("stoic-theme", theme); }, [theme]);
  useEffect(() => { if (user) setAccountName(user.displayName || ""); }, [user]);

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    return onAuthStateChanged(auth, (current) => { setUser(current); setAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!user || !db) { setHabits([]); setChecks({}); setProgression({ totalXp: 0, totalActions: 0 }); setDailyLogs([]); setBooks([]); return; }
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
    const stopBooks = onSnapshot(collection(db, "users", user.uid, "booksRead"), (snapshot) => setBooks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))), (e) => setError(e.message));
    return () => { stopHabits(); stopChecks(); stopProgression(); stopLogs(); stopBooks(); };
  }, [user]);

  const activeHabits = habits.filter((h) => h.active !== false);
  const isDueOn = (habit, date) => { const schedule = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length ? habit.daysOfWeek : [0,1,2,3,4,5,6]; return schedule.includes(date.getDay()); };
  const dueHabits = activeHabits.filter(h => isDueOn(h, new Date()));
  const dueNonNegotiables = dueHabits.filter(h => h.nonNegotiable);
  const doneCount = dueHabits.filter((h) => checks[h.id]).length;
  const percent = dueHabits.length ? Math.round(doneCount / dueHabits.length * 100) : 100;
  const nonNegotiableToday = dueHabits.filter(h => h.nonNegotiable);
  const trainingToday = dueHabits.filter(h => !h.nonNegotiable && ["Training","Running","Walking","Movement"].includes(h.category));
  const otherToday = dueHabits.filter(h => !h.nonNegotiable && !["Training","Running","Walking","Movement"].includes(h.category));
  const monthlyReview = useMemo(() => {
    const cutoff = new Date(); cutoff.setHours(12,0,0,0); cutoff.setDate(cutoff.getDate()-29);
    const cutoffKey = dayKey(cutoff), today = todayKey();
    const recent = dailyLogs.filter(log => (log.date || log.id) >= cutoffKey && (log.date || log.id) <= today);
    let dueTotal = 0, doneTotal = 0;
    const dueByHabit = {}, doneByHabit = {};
    recent.forEach(log => {
      const completed = log.completed || {};
      const dueIds = Array.isArray(log.dueHabitIds) ? log.dueHabitIds : Object.keys(completed);
      dueTotal += dueIds.length;
      dueIds.forEach(id => { dueByHabit[id] = (dueByHabit[id] || 0) + 1; if (completed[id] === true) { doneTotal++; doneByHabit[id] = (doneByHabit[id] || 0) + 1; } });
    });
    const mostMissed = Object.keys(dueByHabit).map(id => ({id,missed:dueByHabit[id]-(doneByHabit[id]||0)})).sort((a,b)=>b.missed-a.missed)[0];
    return { recordedDays:recent.length, completion:dueTotal?Math.round(doneTotal/dueTotal*100):0, completed:doneTotal, due:dueTotal, mostMissed:mostMissed ? habits.find(h=>h.id===mostMissed.id)?.title || "An older commitment" : null };
  }, [dailyLogs, habits]);
  const consistencyDays = useMemo(() => {
    const byDate = new Map(dailyLogs.map(log => [log.date || log.id, log]));
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1, 12);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const days = [];
    for (let blank = 0; blank < mondayOffset; blank++) days.push({key:"blank-"+blank, blank:true});
    for (let number = 1; number <= daysInMonth; number++) {
      const date = new Date(year, month, number, 12);
      const key = dayKey(date), log = byDate.get(key);
      const completed = log?.completed || {};
      const hasDueSnapshot = Array.isArray(log?.dueHabitIds);
      const due = hasDueSnapshot ? log.dueHabitIds : Object.keys(completed);
      const done = due.filter(id => completed[id] === true).length;
      const isComplete = !!log && hasDueSnapshot && (due.length === 0 || done === due.length);
      days.push({key, number, isComplete, isToday:key===todayKey(), future:key>todayKey()});
    }
    return {days, monthLabel:now.toLocaleDateString("en-GB",{month:"long",year:"numeric"})};
  }, [dailyLogs]);  const streak = useMemo(() => {
    const logs = new Map(dailyLogs.map(log => [log.date || log.id, log]));
    const hasShownUp = date => {
      const log = logs.get(dayKey(date));
      return !!log && Object.values(log.completed || {}).some(Boolean);
    };
    const cursor = new Date(); cursor.setHours(12,0,0,0);
    if (!hasShownUp(cursor)) cursor.setDate(cursor.getDate()-1);
    let count = 0;
    while (hasShownUp(cursor)) { count++; cursor.setDate(cursor.getDate()-1); }
    return count;
  }, [dailyLogs]);
  const levelInfo = useMemo(() => {
    const xp = Math.max(0, Number(progression.totalXp) || 0);
    const levels = [{level:1,name:"Initiate",xp:0},{level:2,name:"Disciple",xp:100},{level:3,name:"Practitioner",xp:300},{level:4,name:"Stoic",xp:600},{level:5,name:"Sentinel",xp:1000},{level:6,name:"Guardian",xp:1500},{level:7,name:"Exemplar",xp:2200},{level:8,name:"Virtuoso",xp:3000},{level:9,name:"Philosopher",xp:4000},{level:10,name:"Sage",xp:5200}];
    let current=levels[0], next=null; for (const item of levels) { if (xp>=item.xp) current=item; else {next=item;break;} }
    return {level:current.level,name:current.name,xp,next,progress:next?Math.round((xp-current.xp)/(next.xp-current.xp)*100):100,remaining:next?next.xp-xp:0};
  }, [progression.totalXp]);
  const achievements = useMemo(() => { const n=Number(progression.totalActions)||0; const finishedBooks=books.filter(book=>Boolean(book.finishedAt)).length; const trainingIds=new Set(habits.filter(h=>["Training","Running","Walking","Movement"].includes(h.category)).map(h=>h.id)); const trainingDone=dailyLogs.reduce((total,log)=>total+Object.entries(log.completed||{}).filter(([id,done])=>done&&trainingIds.has(id)).length,0); const items=[{title:"First Promise",detail:"Complete your first commitment",progress:n,goal:1,icon:Star},{title:"Seven in Motion",detail:"Keep showing up for seven days",progress:streak,goal:7,icon:Flame},{title:"A Hundred Deeds",detail:"Complete 100 commitments",progress:n,goal:100,icon:Award},{title:"A Month of Resolve",detail:"Keep showing up for 30 days",progress:streak,goal:30,icon:Trophy},{title:"Reader\u0027s Resolve",detail:"Finish five books",progress:finishedBooks,goal:5,icon:BookOpen},{title:"Strength Through Effort",detail:"Complete 25 training or movement commitments",progress:trainingDone,goal:25,icon:Dumbbell}]; return items.map(item=>({...item,progress:Math.min(item.progress,item.goal),unlocked:item.progress>=item.goal,progressLabel:Math.min(item.progress,item.goal)+"/"+item.goal})); }, [progression.totalActions,streak,books,habits,dailyLogs]);

  async function saveAccountName(e) {
    e.preventDefault(); const cleanName = accountName.trim();
    if (!cleanName) { setError("Please enter a name for your profile."); return; }
    setError(""); setNotice(""); setBusy(true);
    try { await updateProfile(auth.currentUser, { displayName: cleanName });
      if (db) await setDoc(doc(db, "users", user.uid), { displayName: cleanName, updatedAt: serverTimestamp() }, { merge: true });
      setAccountName(cleanName); setNotice("Profile name updated.");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }


  useEffect(() => {
    if (!user || !db) return;
    const publicName = (accountName.trim() || user.displayName || "").trim();
    if (!publicName) return;
    setDoc(doc(db, "publicProfiles", user.uid), { uid: user.uid, displayName: publicName, displayNameLower: publicName.toLowerCase(), updatedAt: serverTimestamp() }, { merge: true }).catch(e => setError(e.message));
  }, [user, accountName]);

  useEffect(() => {
    if (!user || !db) return;
    setDoc(doc(db, "userProgress", user.uid), {
      uid: user.uid, displayName: accountName.trim() || user.displayName || "Stoic member",
      totalXp: Number(progression.totalXp) || 0, totalActions: Number(progression.totalActions) || 0,
      level: levelInfo.level, rank: levelInfo.name, streak,
      todayCompleted: doneCount, todayDue: dueHabits.length, updatedAt: serverTimestamp()
    }, { merge: true }).catch(e => setError(e.message));
  }, [user, accountName, progression.totalXp, progression.totalActions, levelInfo.level, levelInfo.name, streak, doneCount, dueHabits.length]);

  async function refreshCommunity() {
    if (!user || !db) return;
    setCommunityBusy(true);
    try {
      const [followingSnap, followersSnap] = await Promise.all([
        getDocs(query(collection(db, "follows"), where("followerUid", "==", user.uid))),
        getDocs(query(collection(db, "follows"), where("followedUid", "==", user.uid)))
      ]);
      const mutualIds = new Set(followersSnap.docs.map(snap => snap.data().followerUid));
      const followingRows = await Promise.all(followingSnap.docs.map(async snap => {
        const rel = snap.data();
        const [profileSnap, progressSnap] = await Promise.all([
          getDoc(doc(db, "publicProfiles", rel.followedUid)),
          mutualIds.has(rel.followedUid) ? getDoc(doc(db, "userProgress", rel.followedUid)) : Promise.resolve(null)
        ]);
        return { id: snap.id, ...rel, profile: profileSnap.exists() ? profileSnap.data() : { displayName: "Stoic member" }, progress: progressSnap?.exists() ? progressSnap.data() : null };
      }));
      const followerRows = await Promise.all(followersSnap.docs.map(async snap => {
        const rel = snap.data(); const profileSnap = await getDoc(doc(db, "publicProfiles", rel.followerUid));
        return { id: snap.id, ...rel, profile: profileSnap.exists() ? profileSnap.data() : { displayName: "Stoic member" } };
      }));
      setFollowingRecords(followingRows); setFollowerRecords(followerRows);
    } catch (e) { setError("Could not load your community. Check that the Firestore rules have been published. " + e.message); }
    finally { setCommunityBusy(false); }
  }

  async function searchCommunity(e) {
    e?.preventDefault();
    const term = communitySearch.trim().toLowerCase();
    if (term.length < 2) { setError("Enter at least two letters of the account name to search."); return; }
    if (!user || !db) return;
    setError(""); setCommunityBusy(true);
    try {
      const snap = await getDocs(query(collection(db, "publicProfiles"), orderBy("displayNameLower"), startAt(term), endAt(term + "\uf8ff"), limit(15)));
      const followed = new Set(followingRecords.map(r => r.followedUid));
      setCommunityResults(snap.docs.map(d => ({ id: d.id, ...d.data(), isFollowing: followed.has(d.id) })).filter(p => p.uid !== user.uid));
      if (snap.empty) setNotice("No matching profiles found. Ask your friend to sign in and set their account name first.");
    } catch (e) { setError("Could not search profiles. Check that the Firestore rules have been published. " + e.message); }
    finally { setCommunityBusy(false); }
  }

  async function toggleFollow(profile) {
    if (!user || !db || !profile?.uid || profile.uid === user.uid) return;
    const alreadyFollowing = followingRecords.some(r => r.followedUid === profile.uid);
    const relationshipId = user.uid + "_" + profile.uid;
    setError(""); setNotice("");
    try {
      if (alreadyFollowing) { await deleteDoc(doc(db, "follows", relationshipId)); setNotice("You unfollowed " + (profile.displayName || "this member") + "."); }
      else { await setDoc(doc(db, "follows", relationshipId), { followerUid: user.uid, followedUid: profile.uid, createdAt: serverTimestamp() }); setNotice("You are now following " + (profile.displayName || "this member") + "."); }
      await refreshCommunity();
      setCommunityResults(rows => rows.map(row => row.uid === profile.uid ? { ...row, isFollowing: !alreadyFollowing } : row));
    } catch (e) { setError("Could not update your follow. Check that the Firestore rules have been published. " + e.message); }
  }

  useEffect(() => { if (user && (activeTab === "Community" || activeTab === "Profile")) refreshCommunity(); }, [user, activeTab]);

  async function shareInvite() {
    const inviteText = "Join me on Stoic Discipline and let's keep each other accountable. My profile name is " + (accountName.trim() || user?.displayName || "Stoic member") + ".";
    try {
      if (navigator.share) await navigator.share({ title: "Join my accountability circle", text: inviteText, url: window.location.href });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(inviteText + " " + window.location.href); setNotice("Invite message copied. Send it to a friend."); }
      else setNotice(inviteText + " " + window.location.href);
    } catch (e) { if (e.name !== "AbortError") setError("Unable to open sharing on this device. Please copy the app link from your browser."); }
  }

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
    const dueHabitIds=dueHabits.map(h=>h.id);
    const progressionRef=doc(db,"users",user.uid,"progression","summary");
    try { let earned=0, completing=false;
      await runTransaction(db, async (transaction) => {
        const logSnap=await transaction.get(logRef); const pSnap=await transaction.get(progressionRef);
        const log=logSnap.exists()?logSnap.data():{}; const completed={...(log.completed||{})}; const xpAwarded={...(log.xpAwarded||{})};
        completing=!completed[habit.id]; completed[habit.id]=completing;
        const p=pSnap.exists()?pSnap.data():{totalXp:0,totalActions:0}; let totalXp=Number(p.totalXp)||0; let totalActions=Number(p.totalActions)||0;
        if(completing&&!xpAwarded[habit.id]) { earned=10; xpAwarded[habit.id]=true; totalXp+=earned; totalActions++; }
        transaction.set(logRef,{date:todayKey(),completed,xpAwarded,dueHabitIds,updatedAt:serverTimestamp()},{merge:true});
        transaction.set(progressionRef,{totalXp,totalActions,updatedAt:serverTimestamp()},{merge:true});
      });
      setNotice(completing?(earned?`Promise kept. +${earned} XP earned.`:"Promise kept. XP for this commitment was already earned today."):"Record updated. Earned XP is kept.");
    } catch(e) { setError(e.message); }
  }

  async function addBook(e) {
    e.preventDefault();
    if (!user || !db || !bookInput.trim()) return;
    try {
      await addDoc(collection(db, "users", user.uid, "booksRead"), {
        title: bookInput.trim(), author: bookAuthor.trim(), startedAt: bookStarted || "", finishedAt: bookFinished || "", currentPage: Math.max(1, Number(bookPage) || 1), createdAt: serverTimestamp()
      });
      setBookInput(""); setBookAuthor(""); setBookStarted(todayKey()); setBookFinished(""); setBookPage("1"); setNotice(bookFinished ? "Book added to completed books." : "Book added to Currently reading.");
    } catch (e) { setError(e.message); }
  }

  async function updateBook(book, changes) {
    if (!user || !db) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "booksRead", book.id), changes);
      setNotice(changes.finishedAt ? "Book marked as completed." : changes.currentPage !== undefined ? "Reading progress saved." : "Book updated.");
    } catch (e) { setError(e.message); }
  }

  async function removeBook(book) {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "booksRead", book.id));
      setNotice("Book removed from your list.");
    } catch (e) { setError(e.message); }
  }

  async function addHabit(e) {
    e.preventDefault();
    if (!newTitle.trim() || !user || !db) return;
    try {
      await addDoc(collection(db, "users", user.uid, "habits"), {
        title: newTitle.trim(), category: newCategory, target: newTarget.trim(),
        nonNegotiable: newNonNegotiable, daysOfWeek: newSchedule, active: true, createdAt: serverTimestamp()
      });
      setNewTitle(""); setNewTarget(""); setNewCategory("Mindset"); setNewNonNegotiable(true); setNewSchedule([0,1,2,3,4,5,6]); setShowAdd(false);
      setNotice("Commitment added.");
    } catch (e) { setError(e.message); }
  }

  function beginEditHabit(habit) {
    setEditingHabitId(habit.id); setEditingTitle(habit.title || "");
    setEditingCategory(habit.category || "Mindset"); setEditingTarget(habit.target || "");
    setEditingIsNonNegotiable(!!habit.nonNegotiable); setEditingSchedule(Array.isArray(habit.daysOfWeek)&&habit.daysOfWeek.length ? habit.daysOfWeek : [0,1,2,3,4,5,6]);
  }

  async function saveHabitEdit(e) {
    e.preventDefault();
    if (!user || !db || !editingHabitId || !editingTitle.trim()) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "habits", editingHabitId), {
        title: editingTitle.trim(), category: editingCategory, target: editingTarget.trim(),
        nonNegotiable: editingIsNonNegotiable, daysOfWeek: editingSchedule, updatedAt: serverTimestamp()
      });
      setEditingHabitId(null); setNotice("Commitment updated.");
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
      <div className="topbar-actions"><button className="topbar-quiet-button" title="Settings" aria-label="Settings" onClick={()=>{setActiveTab("Settings");setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><Settings size={16}/></button><button className="topbar-quiet-button" title="Sign out" aria-label="Sign out" onClick={() => signOut(auth)}><LogOut size={16}/></button></div>
    </header>
    {activeTab === "Today" && <>
    <section className="welcome">
      <p className="eyebrow">{prettyDate.format(new Date()).toUpperCase()}</p>
      <h1>Do what matters.<br/><span>Leave the rest.</span></h1>
      <p className="muted">Welcome back{user.displayName ? `, ${user.displayName}` : ""}. Focus on the actions within your control.</p>
    </section>
    <section className="progress-card">
      <div className="progress-heading"><div><p className="eyebrow">TODAY'S DISCIPLINE</p><h2>{doneCount} <span>/ {dueHabits.length}</span></h2></div><div className="streak"><Flame size={19}/><div><strong>{streak} day</strong><small>current streak*</small></div></div></div>
      <div className="progress-track"><div style={{width:`${percent}%`}}/></div>
      <div className="progress-foot"><span>{percent}% complete</span><span>{dueHabits.length===0 ? "Rest day — no commitments scheduled." : percent===100 ? "Promises kept for today." : "Small actions. Repeated daily."}</span></div>
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
      <div className="schedule-picker"><span>Scheduled days</span><div className="schedule-days">{WEEKDAYS.map(day => <button type="button" key={day.value} className={"schedule-day "+(newSchedule.includes(day.value)?"selected":"")} onClick={()=>setNewSchedule(prev=>prev.includes(day.value)?prev.filter(d=>d!==day.value):[...prev,day.value].sort((a,b)=>a-b))}>{day.label}</button>)}</div><small>Choose one or more days.</small></div>
      <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary">Save commitment</button></div>
    </form>}
    {error && <div className="error-banner">{error}</div>}
    {notice && <p className="notice">{notice}</p>}
    <div className="commitment-groups">
      {[
        {title:"Non-negotiables",subtitle:"The promises you keep first",items:nonNegotiableToday,icon:ShieldCheck},
        {title:"Training & movement",subtitle:"Build a stronger body",items:trainingToday,icon:Dumbbell},
        {title:"Other commitments",subtitle:"The rest of today's priorities",items:otherToday,icon:Target}
      ].filter(group=>group.items.length>0).map(group=>{const GroupIcon=group.icon;return <section className="commitment-group" key={group.title}>
        <div className="commitment-group-heading"><div className="commitment-group-icon"><GroupIcon size={17}/></div><div><h3>{group.title}</h3><p>{group.subtitle}</p></div><span>{group.items.filter(h=>checks[h.id]).length}/{group.items.length}</span></div>
        <div className="habit-list">{group.items.map(h=>{const Icon=categoryIcon(h.category);return <article className={`habit ${checks[h.id]?"completed":""}`} key={h.id}>
          <button className="habit-check" aria-label={checks[h.id]?"Mark incomplete":"Mark complete"} onClick={()=>toggleHabit(h)}>{checks[h.id]?<Check size={19}/>:<Circle size={21}/>}</button>
          <div className="habit-icon"><Icon size={19}/></div>
          <button className="habit-copy" onClick={()=>toggleHabit(h)}><strong>{h.title}</strong><span>{h.target || h.category}{h.nonNegotiable ? " · NON-NEGOTIABLE" : ""}</span></button>
          <button className="remove-button" aria-label={`Archive ${h.title}`} onClick={()=>removeHabit(h)}><Trash2 size={16}/></button>
        </article>;})}</div>
      </section>})}
      {!dueHabits.length && <div className="empty"><Target size={30}/><h3>A clear day by design</h3><p>No commitments are scheduled for today. Enjoy the rest day or adjust your schedule in Settings.</p></div>}
    </div>
    <section className="achievements-section">
      <div className="section-heading"><div><p className="eyebrow">PROOF OF PRACTICE</p><h2>Achievements</h2></div><span className="achievement-count">{achievements.filter(a=>a.unlocked).length} unlocked</span></div>
      <div className="achievement-grid">{achievements.map((a)=>{const Icon=a.icon;const pct=Math.round(a.progress/a.goal*100);return <article className={`achievement ${a.unlocked?"unlocked":"locked"}`} key={a.title}><div className="achievement-icon"><Icon size={20}/></div><div className="achievement-copy"><strong>{a.title}</strong><span>{a.detail}</span>{!a.unlocked&&<div className="achievement-progress"><i style={{width:pct+"%"}}/></div>}<small className="achievement-progress-label">{a.unlocked?"Unlocked":a.progressLabel+" progress"}</small></div><div className="achievement-status">{a.unlocked?<Check size={16}/>:<span>{a.progressLabel}</span>}</div></article>;})}</div>
    </section>
    <section className="principle-card"><div className="quote-mark">“</div><p>You have power over your mind — not outside events. Realise this, and you will find strength.</p><span>— Marcus Aurelius, <i>Meditations</i> (paraphrased)</span></section>
    </>}
    {activeTab !== "Today" && <section className="tab-page">
      {activeTab === "Reading" && <>
        <p className="eyebrow">TRAIN THE MIND</p><h1 className="tab-title">Reading library</h1>
        <p className="muted">Track your progress as you read, then move finished books into your completed library.</p>
        <form className="book-form" onSubmit={addBook}>
          <label>Book title<input required maxLength="140" value={bookInput} onChange={e=>setBookInput(e.target.value)} placeholder="Title of the book"/></label>
          <label>Author<input maxLength="100" value={bookAuthor} onChange={e=>setBookAuthor(e.target.value)} placeholder="Author's name"/></label>
          <div className="book-date-grid"><label>Started reading<input type="date" required value={bookStarted} onChange={e=>setBookStarted(e.target.value)}/></label><label>Finished reading <span className="optional-label">(optional)</span><input type="date" min={bookStarted || undefined} value={bookFinished} onChange={e=>setBookFinished(e.target.value)}/></label></div>
          {!bookFinished && <label>Current page<input type="number" min="1" max="100000" required value={bookPage} onChange={e=>setBookPage(e.target.value)}/></label>}
          <button className="primary">Add book <Plus size={16}/></button>
        </form>
        <section className="book-section">
          <div className="reading-list-heading"><div><p className="eyebrow">IN PROGRESS</p><h2>Currently reading</h2></div><span className="book-count-finished">{books.filter(b=>!b.finishedAt).length} books</span></div>
          <div className="book-list">{books.filter(b=>!b.finishedAt).map((book,i)=><article className="book-item book-progress-item" key={book.id}><div className="book-cover"><BookOpen size={21}/><span>{String(i+1).padStart(2,"0")}</span></div><div className="book-info"><strong>{book.title}</strong><span>{book.author || "Author not added"}</span><div className="book-dates"><span><small>STARTED</small>{book.startedAt ? new Date(book.startedAt+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "Not recorded"}</span><span><small>CURRENT PAGE</small><label className="page-input-label"><input aria-label={"Current page for "+book.title} type="number" min="1" max="100000" defaultValue={book.currentPage || 1} onBlur={e=>{const n=Math.max(1,Number(e.target.value)||1);if(n!==Number(book.currentPage||1))updateBook(book,{currentPage:n});}}/> <span>page</span></label></span></div><label className="finish-date-label">Finished reading<input aria-label={"Finish date for "+book.title} type="date" min={book.startedAt||undefined} value={book.finishedAt||""} onChange={e=>{if(e.target.value)updateBook(book,{finishedAt:e.target.value});}}/></label></div><button className="remove-button" aria-label={"Remove "+book.title} onClick={()=>removeBook(book)}><Trash2 size={17}/></button></article>)}{!books.some(b=>!b.finishedAt)&&<div className="empty"><BookOpen size={30}/><h3>No books in progress</h3><p>Add a book above and it will appear here until you finish it.</p></div>}</div>
        </section>
        <section className="book-section completed-book-section">
          <div className="reading-list-heading"><div><p className="eyebrow">A LIBRARY OF FINISHED IDEAS</p><h2>Completed books</h2></div><span className="book-count-finished">{books.filter(b=>!!b.finishedAt).length} finished</span></div>
          <div className="book-list">{books.filter(b=>!!b.finishedAt).map((book,i)=><article className="book-item completed-book-item" key={book.id}><div className="book-cover completed-cover"><Check size={21}/><span>{String(i+1).padStart(2,"0")}</span></div><div className="book-info"><strong>{book.title}</strong><span>{book.author || "Author not added"}</span><div className="book-dates"><span><small>STARTED</small>{book.startedAt ? new Date(book.startedAt+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "Not recorded"}</span><span><small>FINISHED</small>{new Date(book.finishedAt+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span></div><button className="reopen-book" onClick={()=>updateBook(book,{finishedAt:""})}>Move back to reading</button></div><button className="remove-button" aria-label={"Remove "+book.title} onClick={()=>removeBook(book)}><Trash2 size={17}/></button></article>)}{!books.some(b=>!!b.finishedAt)&&<div className="empty"><Trophy size={30}/><h3>Your finished books will live here</h3><p>Choose a finish date on a book above and it will move into this section automatically.</p></div>}</div>
        </section>
      </>}
      {activeTab === "Non-negotiables" && <>
        <p className="eyebrow">YOUR PERSONAL STANDARD</p><h1 className="tab-title">Non-negotiables</h1>
        <p className="muted">Your baseline promises. Keep them small enough to repeat, important enough to matter.</p>
        <div className="nonneg-overview">
          <div className="nonneg-overview-top"><div><span className="eyebrow">TODAY'S STANDARD</span><h2>{dueNonNegotiables.filter(h=>checks[h.id]).length}<span> / {dueNonNegotiables.length}</span></h2><p>commitments due today kept</p></div><div className="nonneg-ring" style={{"--completion":`${dueNonNegotiables.length ? dueNonNegotiables.filter(h=>checks[h.id]).length/dueNonNegotiables.length*100 : 0}%`}}><strong>{dueNonNegotiables.length ? Math.round(dueNonNegotiables.filter(h=>checks[h.id]).length/dueNonNegotiables.length*100) : 0}%</strong></div></div>
          <div className="nonneg-progress"><div style={{width:`${dueNonNegotiables.length ? dueNonNegotiables.filter(h=>checks[h.id]).length/dueNonNegotiables.length*100 : 0}%`}}/></div>
          <p className="nonneg-quote">“First say to yourself what you would be; then do what you have to do.”</p>
        </div>
        <div className="nonneg-heading"><div><p className="eyebrow">THE PROMISES YOU KEEP</p><h2>Your commitments</h2></div><button className="add-button" onClick={()=>{setNewNonNegotiable(true);setNewCategory("Mindset");setShowAdd(v=>!v);}}><Plus size={16}/><span>{showAdd?"Close":"Add promise"}</span></button></div>
        {showAdd && <form className="add-form" onSubmit={addHabit}>
          <label>Commitment<input required maxLength="100" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Read 10 pages"/></label>
          <div className="form-row"><label>Category<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target (optional)<input value={newTarget} onChange={e=>setNewTarget(e.target.value)} placeholder="e.g. 10 pages"/></label></div>
          <label className="check-label"><input type="checkbox" checked={newNonNegotiable} onChange={e=>setNewNonNegotiable(e.target.checked)}/> Mark as a non-negotiable</label>
      <div className="schedule-picker"><span>Scheduled days</span><div className="schedule-days">{WEEKDAYS.map(day => <button type="button" key={day.value} className={"schedule-day "+(newSchedule.includes(day.value)?"selected":"")} onClick={()=>setNewSchedule(prev=>prev.includes(day.value)?prev.filter(d=>d!==day.value):[...prev,day.value].sort((a,b)=>a-b))}>{day.label}</button>)}</div><small>Choose one or more days.</small></div>
          <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary">Save commitment</button></div>
        </form>}
        <div className="habit-list nonneg-habit-list">{dueNonNegotiables.map((h,i)=>{const Icon=categoryIcon(h.category);return <article className={`habit nonneg-habit ${checks[h.id]?"completed":""}`} key={h.id}><button className="habit-check" onClick={()=>toggleHabit(h)} aria-label={checks[h.id]?"Mark incomplete":"Mark complete"}>{checks[h.id]?<Check size={19}/>:<Circle size={21}/>}</button><div className="habit-icon"><Icon size={19}/></div><button className="habit-copy" onClick={()=>toggleHabit(h)}><strong>{h.title}</strong><span>{h.target||h.category}</span></button><span className="promise-number">{String(i+1).padStart(2,"0")}</span></article>})}
          {!activeHabits.some(h=>h.nonNegotiable)&&<div className="empty"><ShieldCheck size={30}/><h3>Set your standard</h3><p>Choose a few promises you can keep consistently. Start small and build from there.</p><button className="primary" onClick={()=>{setNewNonNegotiable(true);setShowAdd(true);}}>Create your first promise</button></div>}
        </div>
        <div className="nonneg-reminder"><ShieldCheck size={20}/><div><strong>Consistency over intensity</strong><p>Missing a day is information, not a verdict. Return to your commitments at the next opportunity.</p></div></div>
      </>}
      {activeTab === "Profile" && <>
        <p className="eyebrow">THE WORK YOU'VE PUT IN</p><h1 className="tab-title">{accountName.trim() || user.displayName || "Your profile"}</h1><p className="muted">Measure progress by the promises you keep, not by comparison with anyone else.</p>
        <section className="level-card profile-level"><div className="level-top"><div className="level-emblem"><ShieldCheck size={25}/></div><div className="level-copy"><p className="eyebrow">CURRENT RANK</p><h2>Level {levelInfo.level} · {levelInfo.name}</h2><p>{levelInfo.xp.toLocaleString()} total XP</p></div><div className="xp-total"><Sparkles size={15}/><strong>{levelInfo.xp.toLocaleString()}</strong><span>XP</span></div></div><div className="level-track"><div style={{width:`${levelInfo.progress}%`}}/></div><div className="level-foot"><span>{levelInfo.next?`${levelInfo.remaining} XP to Level ${levelInfo.next.level}`:"Keep practising every day"}</span><span>{levelInfo.progress}%</span></div></section>
        <div className="profile-social-stats"><button onClick={()=>{setActiveTab("Community");setError("");window.scrollTo({top:0,behavior:"smooth"});}}><strong>{followingRecords.length}</strong><span>Following</span></button><button onClick={()=>{setActiveTab("Community");setError("");window.scrollTo({top:0,behavior:"smooth"});}}><strong>{followerRecords.length}</strong><span>Followers</span></button></div>
        <button className="profile-add-friends" onClick={()=>{setActiveTab("Community");setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><Users size={20}/> Add friends</button>
        <div className="profile-stats"><article><Flame size={22}/><strong>{streak}</strong><span>day streak</span></article><article><Target size={22}/><strong>{Number(progression.totalActions||0).toLocaleString()}</strong><span>actions completed</span></article><article><Trophy size={22}/><strong>{achievements.filter(a=>a.unlocked).length}/{achievements.length}</strong><span>achievements</span></article></div>
        <section className="monthly-review-card"><div className="section-heading"><div><p className="eyebrow">THE LAST 30 DAYS</p><h2>Monthly review</h2></div><span className="achievement-count">{monthlyReview.recordedDays} days recorded</span></div><div className="monthly-review-stats"><div><strong>{monthlyReview.completion}%</strong><span>completion rate</span></div><div><strong>{monthlyReview.completed}</strong><span>promises kept</span></div><div><strong>{monthlyReview.due}</strong><span>commitments due</span></div></div><p className="monthly-review-note">{monthlyReview.recordedDays===0?"Your review will take shape as you record your days.":monthlyReview.completion>=85?"Strong consistency. Keep your standards steady and sustainable.":monthlyReview.completion>=60?"You're building a foundation. Choose one small adjustment for the coming month.":"Use this as information, not a verdict. Reduce friction and recommit to the basics."}</p>{monthlyReview.mostMissed&&<p className="monthly-review-missed"><span>Most frequently missed</span><strong>{monthlyReview.mostMissed}</strong></p>}</section>
        <section className="consistency-card"><div className="section-heading"><div><p className="eyebrow">SHOWING UP</p><h2>Consistency calendar</h2></div><span className="achievement-count">{consistencyDays.monthLabel}</span></div><p className="muted">Your current month at a glance. Gold means every scheduled commitment was completed; darker squares are incomplete. The outlined square marks today.</p><div className="consistency-weekdays">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><span key={day}>{day}</span>)}</div><div className="consistency-grid">{consistencyDays.days.map(day=>day.blank?<div className="consistency-day blank" key={day.key} aria-hidden="true"/>:<div key={day.key} title={`${day.key}${day.isToday?" · Today":""}${day.future?" · Upcoming":day.isComplete?" · Complete":" · Incomplete"}`} className={`consistency-day ${day.isComplete?"full":"incomplete"} ${day.isToday?"today":""} ${day.future?"future":""}`} aria-label={`${day.key}${day.isToday?", today":""}: ${day.future?"upcoming":day.isComplete?"complete":"incomplete"}`}><span>{day.number}</span></div>)}</div><div className="consistency-legend"><span><i className="incomplete"/> Incomplete</span><span><i className="full"/> Complete</span><span><i className="today-key"/> Today</span></div></section>
    <section className="achievements-section"><div className="section-heading"><div><p className="eyebrow">PROOF OF PRACTICE</p><h2>Achievements</h2></div><span className="achievement-count">{achievements.filter(a=>a.unlocked).length} unlocked</span></div><div className="achievement-grid">{achievements.map(a=>{const Icon=a.icon;return <article className={`achievement ${a.unlocked?"unlocked":"locked"}`} key={a.title}><div className="achievement-icon"><Icon size={20}/></div><div><strong>{a.title}</strong><span>{a.detail}</span></div><div className="achievement-status">{a.unlocked?<Check size={16}/>:<span>•••</span>}</div></article>})}</div></section>
        
      </>}
      {activeTab === "Community" && <>
        <button className="community-back" onClick={()=>setActiveTab("Profile")}><ArrowLeft size={18}/> Profile</button>
        <p className="eyebrow">ACCOUNTABILITY, TOGETHER</p><h1 className="tab-title">Find your friends</h1>
        <p className="muted">Follow people who help you stay consistent. When you follow each other, you can see each other's progress.</p>
        <div className="community-actions">
          <button className="community-action-card" onClick={()=>document.getElementById("community-search-input")?.focus()}><span className="community-action-icon"><Search size={25}/></span><span><strong>Search by name</strong><small>Find someone on Stoic Discipline</small></span><ArrowLeft className="community-action-arrow" size={17}/></button>
          <button className="community-action-card" onClick={shareInvite}><span className="community-action-icon"><UserPlus size={25}/></span><span><strong>Choose from contacts</strong><small>Invite friends using your phone's share menu</small></span><ArrowLeft className="community-action-arrow" size={17}/></button>
          <button className="community-action-card" onClick={shareInvite}><span className="community-action-icon"><Users size={25}/></span><span><strong>Share follow link</strong><small>Send an invite to join your accountability circle</small></span><ArrowLeft className="community-action-arrow" size={17}/></button>
        </div>
        <section className="community-search-card">
          <form className="community-search-form" onSubmit={searchCommunity}><label>Find a person<input id="community-search-input" value={communitySearch} onChange={e=>setCommunitySearch(e.target.value)} placeholder="Search by account name" maxLength="60"/></label><button className="primary" disabled={communityBusy}><Search size={16}/> Search</button></form>
          <p className="community-hint">Search matches account names beginning with what you type. Ask friends to use a recognisable name in their profile settings.</p>
          {communityResults.length>0 && <div className="community-list">{communityResults.map(profile=><article className="community-person" key={profile.uid}><div className="community-avatar">{(profile.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="community-person-copy"><strong>{profile.displayName||"Stoic member"}</strong><span>Stoic Discipline member</span></div><button className={followingRecords.some(r=>r.followedUid===profile.uid)?"secondary community-follow-button":"primary community-follow-button"} onClick={()=>toggleFollow(profile)}>{followingRecords.some(r=>r.followedUid===profile.uid)?<><UserCheck size={15}/> Following</>:<><UserPlus size={15}/> Follow</>}</button></article>)}</div>}
        </section>
        <section className="community-section"><div className="community-section-heading"><div><p className="eyebrow">YOUR ACCOUNTABILITY CIRCLE</p><h2>Following <span>{followingRecords.length}</span></h2></div><button className="quiet-icon-button" title="Refresh community" onClick={refreshCommunity}><RefreshCw size={16}/></button></div>
          {followingRecords.length===0 ? <div className="empty community-empty"><Users size={28}/><h3>Your circle starts here</h3><p>Search for a friend above and follow them. Their shared progress will appear here.</p></div> : <div className="community-list">{followingRecords.map(row=>{const p=row.progress||{};const due=Number(p.todayDue)||0;const completed=Number(p.todayCompleted)||0;return <article className="community-progress-card" key={row.followedUid}><div className="community-person"><div className="community-avatar">{(row.profile?.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="community-person-copy"><strong>{row.profile?.displayName||"Stoic member"}</strong><span>Level {p.level||1} · {p.rank||"Initiate"}</span></div><button className="quiet-icon-button danger" title={"Unfollow "+(row.profile?.displayName||"member")} onClick={()=>toggleFollow({...row.profile,uid:row.followedUid})}><UserCheck size={16}/></button></div>{row.progress ? <><div className="community-metrics"><div><Trophy size={15}/><strong>{Number(p.totalXp)||0}</strong><span>XP</span></div><div><Target size={15}/><strong>{Number(p.totalActions)||0}</strong><span>actions</span></div><div><Flame size={15}/><strong>{Number(p.streak)||0}</strong><span>day streak</span></div></div><div className="community-daily"><div className="community-daily-label"><span>Today's commitments</span><strong>{completed}/{due}</strong></div><div className="community-daily-track"><span style={{width:(due?Math.min(100,Math.round(completed/due*100)):0)+"%"}}/></div><small>{due===0?"No commitments due today":completed===due?"All due commitments completed":Math.round(completed/due*100)+"% complete so far"}</small></div></> : <p className="community-hint">Follow each other to unlock shared progress. They need to follow you back too.</p>}</article>})}</div>}
        </section>
        <section className="community-section"><div className="community-section-heading"><div><p className="eyebrow">THEY'RE IN YOUR CORNER</p><h2>Following you <span>{followerRecords.length}</span></h2></div><button className="quiet-icon-button" title="Refresh community" onClick={refreshCommunity}><RefreshCw size={16}/></button></div>
          {followerRecords.length===0 ? <div className="empty community-empty"><UserPlus size={28}/><h3>Your first follower</h3><p>When someone follows your account, they'll appear here. Your progress is only visible to people you follow back.</p></div> : <div className="community-list">{followerRecords.map(row=>{const mutual=followingRecords.some(r=>r.followedUid===row.followerUid);return <article className="community-person community-follower" key={row.followerUid}><div className="community-avatar">{(row.profile?.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="community-person-copy"><strong>{row.profile?.displayName||"Stoic member"}</strong><span>{mutual?"You're following each other":"Follows you · follow back to see their progress"}</span></div>{!mutual&&<button className="primary community-follow-button" onClick={()=>toggleFollow({...row.profile,uid:row.followerUid})}><UserPlus size={15}/> Follow back</button>}</article>})}</div>}
        </section>
      </>}
      {activeTab === "Settings" && <>
        <button className="settings-back" onClick={()=>{if(settingsSection!=="menu"){setSettingsSection("menu");}else{setActiveTab("Profile");}setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><ArrowLeft size={16}/> {settingsSection!=="menu"?"All settings":"Back to profile"}</button>
        <p className="eyebrow">PERSONALISE YOUR PRACTICE</p><h1 className="tab-title">Settings</h1>
        <p className="muted">Choose a settings area below to personalise your journal.</p>
        {settingsSection === "menu" && <div className="settings-menu-grid">
          <button className="settings-menu-card" onClick={()=>setSettingsSection("appearance")}><span className="settings-menu-icon">◐</span><strong>Background colour</strong><span>Choose light or dark theme</span></button>
          <button className="settings-menu-card" onClick={()=>setSettingsSection("account")}><span className="settings-menu-icon">♙</span><strong>Account holder name</strong><span>Change the name shown on your profile</span></button>
          {["Reading","Non-negotiables","Today","Profile"].map(page=><button key={page} className="settings-menu-card" onClick={()=>setSettingsSection(page)}><span className="settings-menu-icon">{page==="Reading"?"▤":page==="Non-negotiables"?"⬡":page==="Today"?"◎":"☆"}</span><strong>{page} settings</strong><span>Open settings for your {page.toLowerCase()} page</span></button>)}
        </div>}
        {settingsSection === "appearance" && <div className="settings-panel"><p className="eyebrow">DISPLAY</p><h2>Background colour</h2><p className="settings-description">Choose a theme for the journal. Your choice is saved on this device.</p><div className="theme-options"><button className={"theme-option "+(theme==="dark"?"selected":"")} onClick={()=>setTheme("dark")}><span className="theme-preview theme-preview-dark"/><strong>Dark theme</strong><span>Charcoal, bronze and gold</span></button><button className={"theme-option "+(theme==="light"?"selected":"")} onClick={()=>setTheme("light")}><span className="theme-preview theme-preview-light"/><strong>Light theme</strong><span>Warm ivory and muted gold</span></button></div></div>}
        {settingsSection === "account" && <div className="settings-panel"><p className="eyebrow">ACCOUNT</p><h2>Profile name</h2><p className="settings-description">This name appears as the heading on your Profile page and in your welcome message.</p><form className="settings-edit-form" onSubmit={saveAccountName}><label>Account holder name<input required maxLength="60" value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Enter your name"/></label><div className="form-actions"><button className="primary" disabled={busy}>{busy?"Saving…":"Save name"}</button></div></form></div>}
        {["Reading","Non-negotiables","Today","Profile"].includes(settingsSection) && <div className="settings-panel"><p className="eyebrow">PAGE SETTINGS</p><h2>{settingsSection} settings</h2><p className="settings-description">Manage the commitments and records used on this page. Existing data is preserved.</p>{settingsSection==="Reading"&&<p className="settings-description">Your reading library tracks books in progress and completed books. Add, update or remove books from the Reading page.</p>}{settingsSection==="Non-negotiables"&&<p className="settings-description">Your non-negotiables are controlled by the commitment list below. Edit a commitment and switch its non-negotiable option on or off.</p>}{settingsSection==="Today"&&<p className="settings-description">Today displays your daily checklist, completion progress, level and XP, streak and achievements.</p>}{settingsSection==="Profile"&&<p className="settings-description">Your profile shows your rank, total XP, streak, completed actions and achievements.</p>}<button className="secondary settings-open-page" onClick={()=>{setActiveTab(settingsSection);setSettingsSection("menu");window.scrollTo({top:0,behavior:"smooth"});}}>Open {settingsSection} page <ArrowLeft size={14}/></button></div>}
        {settingsSection === "menu" && <>
        <div className="settings-section-heading"><div><p className="eyebrow">YOUR DAILY STANDARD</p><h2>Manage commitments</h2></div><button className="quiet-account-button" onClick={()=>{setNewTitle("");setNewTarget("");setNewCategory("Mindset");setNewNonNegotiable(true);setShowAdd(v=>!v);setEditingHabitId(null);}}><Plus size={14}/> Add</button></div>
        {showAdd && <form className="add-form settings-add-form" onSubmit={addHabit}>
          <label>Commitment<input required maxLength="100" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Read 10 pages"/></label>
          <div className="form-row"><label>Category<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target (optional)<input value={newTarget} onChange={e=>setNewTarget(e.target.value)} placeholder="e.g. 10 pages"/></label></div>
          <label className="check-label"><input type="checkbox" checked={newNonNegotiable} onChange={e=>setNewNonNegotiable(e.target.checked)}/> Mark as a non-negotiable</label>
      <div className="schedule-picker"><span>Scheduled days</span><div className="schedule-days">{WEEKDAYS.map(day => <button type="button" key={day.value} className={"schedule-day "+(newSchedule.includes(day.value)?"selected":"")} onClick={()=>setNewSchedule(prev=>prev.includes(day.value)?prev.filter(d=>d!==day.value):[...prev,day.value].sort((a,b)=>a-b))}>{day.label}</button>)}</div><small>Choose one or more days.</small></div>
          <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary">Save commitment</button></div>
        </form>}
        <div className="settings-habit-list">{activeHabits.map(h=>{const Icon=categoryIcon(h.category);return <article className="settings-habit" key={h.id}>
          {editingHabitId===h.id ? <form className="settings-edit-form" onSubmit={saveHabitEdit}>
            <label>Commitment name<input required maxLength="100" value={editingTitle} onChange={e=>setEditingTitle(e.target.value)}/></label>
            <div className="form-row"><label>Category<select value={editingCategory} onChange={e=>setEditingCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target<input value={editingTarget} onChange={e=>setEditingTarget(e.target.value)} placeholder="Optional target"/></label></div>
            <label className="check-label"><input type="checkbox" checked={editingIsNonNegotiable} onChange={e=>setEditingIsNonNegotiable(e.target.checked)}/> Non-negotiable commitment</label>
            <div className="schedule-picker"><span>Scheduled days</span><div className="schedule-days">{WEEKDAYS.map(day => <button type="button" key={day.value} className={"schedule-day "+(editingSchedule.includes(day.value)?"selected":"")} onClick={()=>setEditingSchedule(prev=>prev.includes(day.value)?prev.filter(d=>d!==day.value):[...prev,day.value].sort((a,b)=>a-b))}>{day.label}</button>)}</div><small>Choose one or more days.</small></div>
            <div className="form-actions"><button type="button" className="secondary" onClick={()=>setEditingHabitId(null)}>Cancel</button><button className="primary">Save changes</button></div>
          </form> : <><div className="settings-habit-main"><div className="habit-icon"><Icon size={18}/></div><div className="settings-habit-copy"><strong>{h.title}</strong><span>{h.target||h.category}</span><small>{h.nonNegotiable?"NON-NEGOTIABLE":"GENERAL HABIT"}</small></div><button className="quiet-icon-button" aria-label={"Edit "+h.title} onClick={()=>beginEditHabit(h)}><Pencil size={15}/></button><button className="quiet-icon-button danger" aria-label={"Remove "+h.title} onClick={()=>removeHabit(h)}><Trash2 size={15}/></button></div></>}
        </article>})}
        {!activeHabits.length&&<div className="empty"><ShieldCheck size={28}/><h3>No commitments yet</h3><p>Add your first commitment to start building your standard.</p></div>}
        </div>
        <p className="settings-note">Changes here apply to your daily checklist and Non-negotiables page. Past completion records are retained when you archive a commitment.</p>
        </>}
      </>}
    </section>}
    <nav className="bottom-nav">{[["Reading",BookOpen],["Non-negotiables",ShieldCheck],["Today",Target],["Profile",Star]].map(([label,Icon]) => <button type="button" key={label} className={`nav-item ${activeTab===label?"active":""} ${label==="Today"?"nav-today":""}`} onClick={() => {setActiveTab(label);setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><span className="nav-icon-wrap"><Icon size={label==="Today"?23:19}/></span><span>{label==="Non-negotiables"?"Non-neg.":label}</span></button>)}</nav>
    <p className="footnote">XP is awarded once per commitment each day. Unticking a commitment does not remove earned XP. Your progress is saved to your private Firebase account.</p>
  </main>;
}
