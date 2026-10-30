import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, startAt, endAt, limit,
  serverTimestamp, setDoc, updateDoc, runTransaction
} from "firebase/firestore";
import { Activity, BookOpen, Check, Circle, Dumbbell, Flame, LogOut, Plus, ShieldCheck, Sunrise, Moon, Footprints, Target, Trash2, Trophy, Award, Star, Sparkles, Settings, Pencil, ArrowLeft, ChevronRight, ChevronDown, Users, UserPlus, UserCheck, Search, RefreshCw, Bell, X, Shield, Swords, Flame as FlameRank, Mountain, Eye, Compass, Crown, Sun, Gem, Infinity as InfinityIcon, Landmark } from "lucide-react";
import { auth, db, firebaseConfigured } from "./firebase";

const starterHabits = [
  { title: "Morning routine", category: "Mindset", target: "Start the day deliberately", nonNegotiable: true },
  { title: "Read 10 pages", category: "Reading", target: "10 pages", nonNegotiable: true },
  { title: "Move for at least 20 minutes", category: "Movement", target: "20 minutes", nonNegotiable: false },
  { title: "Evening reflection", category: "Mindset", target: "Review the day", nonNegotiable: true }
];
const WEEKDAYS = [{label:"Mon",value:1},{label:"Tue",value:2},{label:"Wed",value:3},{label:"Thu",value:4},{label:"Fri",value:5},{label:"Sat",value:6},{label:"Sun",value:0}];
const formatReadingTime = (pages, wordsPerPage, wpm) => {
  const minutes = Math.max(0, Math.ceil((Math.max(0, Number(pages)||0) * (Number(wordsPerPage)||233)) / Math.max(1, Number(wpm)||163)));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
};
const dayKey = (date) => date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
const todayKey = () => {
  const d = new Date();
  return dayKey(d);
};
const prettyDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const RANKS = [
  {level:1,name:"Initiate",xp:0},
  {level:2,name:"Aspirant",xp:750},
  {level:3,name:"Student",xp:2000},
  {level:4,name:"Disciple",xp:4000},
  {level:5,name:"Practitioner",xp:7000},
  {level:6,name:"Stoic",xp:11000},
  {level:7,name:"Scholar",xp:16000},
  {level:8,name:"Thinker",xp:23000},
  {level:9,name:"Philosopher",xp:32000},
  {level:10,name:"Teacher",xp:44000},
  {level:11,name:"Mentor",xp:60000},
  {level:12,name:"Exemplar",xp:85000}
];
const RANK_ICONS = [ShieldCheck, Shield, Swords, FlameRank, Mountain, Eye, Compass, Crown, Sun, Gem, InfinityIcon, Landmark];
function RankStoneEmblem({ level }) {
  const spriteColumn = (level - 1) % 6;
  const spriteRow = Math.floor((level - 1) / 6);
  return <div className={`rank-list-emblem rank-emblem-${level} rank-stone-emblem rank-stone-medallion rank-tier-image`} aria-label={`Rank ${level} emblem`}>
    <span className="rank-emblem-image" style={{
      backgroundImage: `url(${import.meta.env.BASE_URL}stoic-emblems.webp)`,
      backgroundSize: "600% 200%",
      backgroundPosition: `${spriteColumn * 20}% ${spriteRow * 100}%`
    }}/>
    <span className="rank-emblem-number">{String(level).padStart(2,"0")}</span>
  </div>;
}

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
  const tabHistoryRef = useRef([]);
  useEffect(() => {
    // Keep several same-document history sentinels ahead of the page that
    // originally opened the app. A web page cannot override Android's force-close,
    // but this prevents ordinary browser Back from immediately leaving the app.
    const addBackSentinels = () => {
      for (let i = 0; i < 3; i++) {
        window.history.pushState({ stoicDiscipline: true, sentinel: true }, "", window.location.href);
      }
    };
    const handleAppBack = () => {
      const previousTab = tabHistoryRef.current.pop();
      if (previousTab) {
        setActiveTab(previousTab);
        setError("");
        setNotice("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      // Replenish sentinels synchronously before the browser can continue back.
      addBackSentinels();
    };
    addBackSentinels();
    window.addEventListener("popstate", handleAppBack);
    return () => window.removeEventListener("popstate", handleAppBack);
  }, []);
  const [books, setBooks] = useState([]);
  const [bookInput, setBookInput] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookStarted, setBookStarted] = useState(todayKey());
  const [bookFinished, setBookFinished] = useState("");
  const [bookPage, setBookPage] = useState("1");
  const [bookPageCount, setBookPageCount] = useState("");
  const [bookCover, setBookCover] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchBusy, setBookSearchBusy] = useState(false);
  const [bookSearchError, setBookSearchError] = useState("");
  const [bookSearchOpen, setBookSearchOpen] = useState(false);
  const [readingWpm, setReadingWpm] = useState(() => Number(localStorage.getItem("stoic-reading-wpm")) || 163);
  const [wordsPerPage, setWordsPerPage] = useState(() => { const saved = Number(localStorage.getItem("stoic-words-per-page")); return !saved || saved === 300 ? 233 : saved; });
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
  const [xpToast, setXpToast] = useState(null);
  const [unlockCelebration, setUnlockCelebration] = useState(null);
  const [progressionReady, setProgressionReady] = useState(false);
  const previousUnlockState = useRef(null);
  const [accountName, setAccountName] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("stoic-theme") || "dark");
  const [settingsSection, setSettingsSection] = useState("menu");
  const [communitySearch, setCommunitySearch] = useState("");
  const [communityResults, setCommunityResults] = useState([]);
  const [followingRecords, setFollowingRecords] = useState([]);
  const [followerRecords, setFollowerRecords] = useState([]);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [shareProgress, setShareProgress] = useState(true);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [showMemberLibrary, setShowMemberLibrary] = useState(false);
  const [socialListView, setSocialListView] = useState("");
  const [showProfileCalendar, setShowProfileCalendar] = useState(false);
  const [showProfileAchievements, setShowProfileAchievements] = useState(false);
  const [showRanksPage, setShowRanksPage] = useState(false);
  const [newFollowerNotifications, setNewFollowerNotifications] = useState([]);
  const [notificationItems, setNotificationItems] = useState([]);
  const [shareReadingActivity, setShareReadingActivity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("stoic-theme", theme); }, [theme]);
  useEffect(() => { if (user) setAccountName(user.displayName || ""); }, [user]);
  useEffect(() => {
    if (!user || !db) { setNewFollowerNotifications([]); return; }
    let cancelled = false;
    async function checkNewFollowers() {
      try {
        const settingsRef = doc(db, "users", user.uid, "settings", "communityNotifications");
        const [settingsSnap, followersSnap] = await Promise.all([
          getDoc(settingsRef),
          getDocs(query(collection(db, "follows"), where("followedUid", "==", user.uid)))
        ]);
        if (cancelled) return;
        const events = followersSnap.docs.map(snap => {
          const data = snap.data();
          const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : "";
          return { id: snap.id, followerUid: data.followerUid, eventKey: snap.id + "_" + createdAt };
        });
        const known = settingsSnap.exists() && Array.isArray(settingsSnap.data().knownFollowerEvents)
          ? settingsSnap.data().knownFollowerEvents : null;
        if (!known) {
          await setDoc(settingsRef, { knownFollowerEvents: events.map(event => event.eventKey).slice(-500), updatedAt: serverTimestamp() }, { merge: true });
          return;
        }
        const knownSet = new Set(known);
        const fresh = events.filter(event => !knownSet.has(event.eventKey));
        await setDoc(settingsRef, { knownFollowerEvents: [...new Set([...known, ...events.map(event => event.eventKey)])].slice(-500), updatedAt: serverTimestamp() }, { merge: true });
        if (!fresh.length) return;
        const notifications = await Promise.all(fresh.map(async event => {
          try {
            const profileSnap = await getDoc(doc(db, "publicProfiles", event.followerUid));
            return { ...event, displayName: profileSnap.exists() ? profileSnap.data().displayName || "Someone" : "Someone" };
          } catch { return { ...event, displayName: "Someone" }; }
        }));
        if (!cancelled) { setNewFollowerNotifications(notifications); setShowNotifications(true); }
      } catch (e) {
        if (!cancelled) setError("Could not check new followers: " + e.message);
      }
    }
    checkNewFollowers();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !db) { setShareProgress(true); return; }
    getDoc(doc(db, "users", user.uid, "settings", "privacy")).then(snapshot => {
      setShareProgress(snapshot.exists() ? snapshot.data().shareProgress !== false : true);
      setShareReadingActivity(snapshot.exists() ? snapshot.data().shareReadingActivity === true : false);
    }).catch(e => setError("Could not load privacy settings: " + e.message));
  }, [user]);
  useEffect(() => { localStorage.setItem("stoic-reading-wpm", String(readingWpm)); }, [readingWpm]);
  useEffect(() => { localStorage.setItem("stoic-words-per-page", String(wordsPerPage)); }, [wordsPerPage]);
  useEffect(() => {
    const term = bookInput.trim();
    if (term.length < 3 || !bookSearchOpen) { setBookSearchResults([]); setBookSearchBusy(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBookSearchBusy(true); setBookSearchError("");
      try {
        let results = [];
        // Try Google Books first, then Open Library if Google is blocked or has no useful matches.
        try {
          const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&maxResults=8&printType=books`, { signal: controller.signal });
          if (response.ok) {
            const data = await response.json();
            results = (data.items || []).map(item => {
              const v = item.volumeInfo || {};
              return { id:"google-"+item.id, title:v.title || "", author:Array.isArray(v.authors)?v.authors.join(", "):"", pageCount:Number(v.pageCount)||0, cover:v.imageLinks?.thumbnail?.replace("http://","https://") || "", published:v.publishedDate || "", publisher:v.publisher || "" };
            }).filter(item => item.title);
          }
        } catch (err) { if (err.name === "AbortError") throw err; }
        // Also consult Open Library when Google has matches but omits page counts or covers.
        // This gives the reading-time estimate a better chance of working automatically.
        if (!results.length || results.some(item => !item.pageCount || !item.cover)) {
          try {
            const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=12`, { signal: controller.signal });
            if (response.ok) {
              const data = await response.json();
              const libraryResults = (data.docs || []).map(item => ({
                id:"openlibrary-"+(item.key || item.title+"-"+(item.author_name?.[0]||"")),
                title:item.title || "",
                author:Array.isArray(item.author_name)?item.author_name.slice(0,3).join(", "):"",
                pageCount:Number(item.number_of_pages_median)||0,
                cover:item.cover_i?`https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`:"",
                published:item.first_publish_year?String(item.first_publish_year):"",
                publisher:Array.isArray(item.publisher)?item.publisher[0]||"":""
              })).filter(item => item.title);
              if (!results.length) results = libraryResults;
              else results = results.map(item => {
                const normalise = value => (value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
                const match = libraryResults.find(candidate => normalise(candidate.title)===normalise(item.title) &&
                  (!item.author || !candidate.author || normalise(candidate.author).includes(normalise(item.author.split(",")[0])) || normalise(item.author).includes(normalise(candidate.author.split(",")[0]))));
                return match ? {...item, pageCount:item.pageCount||match.pageCount, cover:item.cover||match.cover, published:item.published||match.published, publisher:item.publisher||match.publisher} : item;
              });
            }
          } catch (err) { if (err.name === "AbortError") throw err; }
        }
        if (!controller.signal.aborted) { setBookSearchResults(results); setBookSearchError(results.length ? "" : "No matches found. You can enter the details manually."); }
      } catch (err) {
        if (err.name !== "AbortError") { setBookSearchResults([]); setBookSearchError("Book search services are unavailable right now. You can still enter the details manually."); }
      } finally { if (!controller.signal.aborted) setBookSearchBusy(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [bookInput, bookSearchOpen]);


  const [formPageLookupStatus, setFormPageLookupStatus] = useState("idle");
  useEffect(() => {
    const title=bookInput.trim();
    const author=bookAuthor.trim();
    if(title.length<3 || Number(bookPageCount)>0) { setFormPageLookupStatus("idle"); return; }
    let cancelled=false;
    const normalise=value=>(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const matchesTitle=candidate=>{
      const a=normalise(candidate), b=normalise(title);
      return !!a && !!b && (a===b || (Math.min(a.length,b.length)>=7 && (a.startsWith(b)||b.startsWith(a)||a.includes(b)||b.includes(a))));
    };
    const matchesAuthor=authors=>!author || !authors?.length || authors.some(name=>normalise(name).includes(normalise(author))||normalise(author).includes(normalise(name)));
    setFormPageLookupStatus("searching");
    const timer=setTimeout(async()=>{
      try {
        let pageCount=0, cover="";
        try {
          const q=`intitle:${title}${author ? " inauthor:"+author : ""}`;
          const response=await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&printType=books`);
          if(response.ok){
            const data=await response.json();
            const items=(data.items||[]).map(item=>{const v=item.volumeInfo||{};return {title:v.title||"",authors:Array.isArray(v.authors)?v.authors:[],pageCount:Number(v.pageCount)||0,cover:v.imageLinks?.thumbnail?.replace("http://","https://")||""};});
            const match=items.find(item=>matchesTitle(item.title)&&matchesAuthor(item.authors)&&item.pageCount>0);
            if(match){pageCount=match.pageCount;cover=match.cover;}
          }
        } catch(e) { /* Try Open Library next. */ }
        if(!pageCount){
          try {
            const q=[title,author].filter(Boolean).join(" ");
            const response=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=30&fields=title,author_name,number_of_pages_median,cover_i`);
            if(response.ok){
              const data=await response.json();
              const items=(data.docs||[]).filter(item=>matchesTitle(item.title)&&matchesAuthor(item.author_name));
              const match=items.find(item=>Number(item.number_of_pages_median)>0);
              if(match){pageCount=Number(match.number_of_pages_median)||0;cover=cover||(match.cover_i?`https://covers.openlibrary.org/b/id/${match.cover_i}-M.jpg`:"");}
            }
          } catch(e) { /* Keep manual entry available. */ }
        }
        if(cancelled)return;
        if(pageCount>0){
          setBookPageCount(String(pageCount));
          if(cover&&!bookCover)setBookCover(cover);
          setFormPageLookupStatus("found");
        } else setFormPageLookupStatus("not-found");
      } catch(e) { if(!cancelled)setFormPageLookupStatus("not-found"); }
    },700);
    return ()=>{cancelled=true;clearTimeout(timer);};
  }, [bookInput, bookAuthor, bookPageCount]);

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
    const stopProgression = onSnapshot(doc(db, "users", user.uid, "progression", "summary"), async (snapshot) => {
      const progressionRef = doc(db, "users", user.uid, "progression", "summary");
      try {
        const migrated = await runTransaction(db, async (transaction) => {
          const currentSnap = await transaction.get(progressionRef);
          const current = currentSnap.exists() ? currentSnap.data() : { totalXp: 0, totalActions: 0 };
          if (current.xpSystemVersion !== 2) {
            const scaledXp = Math.max(0, Number(current.totalXp) || 0) * 5;
            const next = { ...current, totalXp: scaledXp, xpSystemVersion: 2, updatedAt: serverTimestamp() };
            transaction.set(progressionRef, next, { merge: true });
            return next;
          }
          return current;
        });
        setProgression(migrated);
        setProgressionReady(true);
      } catch (e) { setError("Could not update your XP progression: " + e.message); }
    }, (e) => setError(e.message));
    const stopLogs = onSnapshot(collection(db, "users", user.uid, "dailyLogs"), (snapshot) => setDailyLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => setError(e.message));
    const stopBooks = onSnapshot(collection(db, "users", user.uid, "booksRead"), (snapshot) => setBooks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))), (e) => setError(e.message));
    return () => { stopHabits(); stopChecks(); stopProgression(); stopLogs(); stopBooks(); };
  }, [user]);

  const activeHabits = habits.filter((h) => h.active !== false);
  const nonNegotiableHabits = activeHabits.filter(h => h.nonNegotiable);
  const flexibleHabits = activeHabits.filter(h => !h.nonNegotiable);
  const MAX_NON_NEGOTIABLES = 5;
  const MAX_FLEXIBLE_COMMITMENTS = 5;
  const isDueOn = (habit, date) => { if (habit.nonNegotiable) return true; const schedule = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length ? habit.daysOfWeek : [0,1,2,3,4,5,6]; return schedule.includes(date.getDay()); };
  const dueHabits = activeHabits.filter(h => isDueOn(h, new Date()));
  const dueNonNegotiables = dueHabits.filter(h => h.nonNegotiable);
  const doneNonNegotiables = dueNonNegotiables.filter(h => checks[h.id]).length;
  const nonNegotiablePercent = dueNonNegotiables.length ? Math.round(doneNonNegotiables / dueNonNegotiables.length * 100) : 100;
  const allNonNegotiablesKept = dueNonNegotiables.length > 0 && doneNonNegotiables === dueNonNegotiables.length;
  const doneCount = dueHabits.filter((h) => checks[h.id]).length;
  const percent = dueHabits.length ? Math.round(doneCount / dueHabits.length * 100) : 100;
  const nonNegotiableToday = dueHabits.filter(h => h.nonNegotiable);
  const trainingToday = dueHabits.filter(h => !h.nonNegotiable && ["Training","Running","Walking","Movement"].includes(h.category));
  const otherToday = dueHabits.filter(h => !h.nonNegotiable && !["Training","Running","Walking","Movement"].includes(h.category));
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
    const scheduledNonNegotiables = date => habits
      .filter(h => h.active !== false && h.nonNegotiable)
      .map(h => h.id);
    const dayStatus = date => {
      const key = dayKey(date), log = logs.get(key);
      const dueIds = Array.isArray(log?.dueNonNegotiableIds) ? log.dueNonNegotiableIds : scheduledNonNegotiables(date);
      if (!dueIds.length) return "skip";
      if (!log) return "missed";
      const completed = log.completed || {};
      return dueIds.every(id => completed[id] === true) ? "kept" : "missed";
    };
    const cursor = new Date(); cursor.setHours(12,0,0,0);
    // Today's unfinished promises are still recoverable until the day ends.
    if (dayStatus(cursor) !== "kept") cursor.setDate(cursor.getDate()-1);
    let count = 0;
    // Bound the scan so an account with no non-negotiables cannot loop forever.
    for (let scanned = 0; scanned < 1200; scanned++) {
      const status = dayStatus(cursor);
      if (status === "skip") { cursor.setDate(cursor.getDate()-1); continue; }
      if (status !== "kept") break;
      count++;
      cursor.setDate(cursor.getDate()-1);
    }
    return count;
  }, [dailyLogs, habits]);
  const levelInfo = useMemo(() => {
    const xp = Math.max(0, Number(progression.totalXp) || 0);
    const levels = RANKS;
    let current=levels[0], next=null; for (const item of levels) { if (xp>=item.xp) current=item; else {next=item;break;} }
    return {level:current.level,name:current.name,xp,next,progress:next?Math.round((xp-current.xp)/(next.xp-current.xp)*100):100,remaining:next?next.xp-xp:0};
  }, [progression.totalXp]);
  const achievements = useMemo(() => {
    const actions = Math.max(0, Number(progression.totalActions) || 0);
    const xp = Math.max(0, Number(progression.totalXp) || 0);
    const finishedBooks = books.filter(book => Boolean(book.finishedAt)).length;
    const startedBooks = books.length;
    const trainingIds = new Set(habits.filter(h => ["Training", "Running", "Walking", "Movement"].includes(h.category)).map(h => h.id));
    const trainingDone = dailyLogs.reduce((total, log) => total + Object.entries(log.completed || {}).filter(([id, done]) => done && trainingIds.has(id)).length, 0);
    const perfectDays = dailyLogs.filter(log => {
      const due = Array.isArray(log.dueHabitIds) ? log.dueHabitIds : Array.isArray(log.dueNonNegotiableIds) ? log.dueNonNegotiableIds : null;
      if (!due) return false;
      const completed = log.completed || {};
      return due.length > 0 && due.every(id => completed[id] === true);
    }).length;
    const items = [
      {title:"First Promise",detail:"Complete your first commitment",progress:actions,goal:1,icon:Star,group:"Discipline"},
      {title:"Fifty Victories",detail:"Complete 50 commitments",progress:actions,goal:50,icon:Award,group:"Discipline"},
      {title:"A Hundred Deeds",detail:"Complete 100 commitments",progress:actions,goal:100,icon:Award,group:"Discipline"},
      {title:"Five Hundred Deeds",detail:"Complete 500 commitments",progress:actions,goal:500,icon:Trophy,group:"Discipline"},
      {title:"The Standard",detail:"Complete every scheduled commitment on 10 recorded days",progress:perfectDays,goal:10,icon:ShieldCheck,group:"Discipline"},
      {title:"Seven in Motion",detail:"Keep a 7-day streak",progress:streak,goal:7,icon:Flame,group:"Streaks"},
      {title:"Fortnight of Resolve",detail:"Keep a 14-day streak",progress:streak,goal:14,icon:Flame,group:"Streaks"},
      {title:"A Month of Resolve",detail:"Keep a 30-day streak",progress:streak,goal:30,icon:Flame,group:"Streaks"},
      {title:"Century of Commitment",detail:"Keep a 100-day streak",progress:streak,goal:100,icon:Flame,group:"Streaks"},
      {title:"Five Hundred Days",detail:"Keep a 500-day streak",progress:streak,goal:500,icon:Flame,group:"Streaks"},
      {title:"A Thousand Days",detail:"Keep a 1,000-day streak",progress:streak,goal:1000,icon:Flame,group:"Streaks"},
      {title:"Quartermaster",detail:"Keep a 90-day streak",progress:streak,goal:90,icon:ShieldCheck,group:"Streaks"},
      {title:"The Long Game",detail:"Keep a 365-day streak",progress:streak,goal:365,icon:Trophy,group:"Streaks"},
      {title:"First Chapter",detail:"Add your first book to the library",progress:startedBooks,goal:1,icon:BookOpen,group:"Reading"},
      {title:"Reader's Resolve",detail:"Finish five books",progress:finishedBooks,goal:5,icon:BookOpen,group:"Reading"},
      {title:"Well Read",detail:"Finish 10 books",progress:finishedBooks,goal:10,icon:BookOpen,group:"Reading"},
      {title:"Library Builder",detail:"Finish 25 books",progress:finishedBooks,goal:25,icon:BookOpen,group:"Reading"},
      {title:"Lifelong Student",detail:"Finish 50 books",progress:finishedBooks,goal:50,icon:BookOpen,group:"Reading"},
      {title:"Strength Through Effort",detail:"Complete 25 training or movement commitments",progress:trainingDone,goal:25,icon:Dumbbell,group:"Movement"},
      {title:"Built by Practice",detail:"Complete 100 training or movement commitments",progress:trainingDone,goal:100,icon:Dumbbell,group:"Movement"},
      {title:"First XP",detail:"Earn your first experience point",progress:xp,goal:1,icon:Sparkles,group:"Progression"},
      {title:"Rising",detail:"Earn 2,500 XP",progress:xp,goal:2500,icon:Star,group:"Progression"},
      {title:"Dedicated",detail:"Earn 12,500 XP",progress:xp,goal:12500,icon:Award,group:"Progression"},
      {title:"Elite",detail:"Earn 50,000 XP",progress:xp,goal:50000,icon:ShieldCheck,group:"Progression"},
      {title:"Living Legend",detail:"Earn 125,000 XP",progress:xp,goal:125000,icon:Trophy,group:"Progression"}
    ];
    return items.map(item => ({...item, progress:Math.min(item.progress,item.goal), unlocked:item.progress>=item.goal, progressLabel:Math.min(item.progress,item.goal)+"/"+item.goal}));
  }, [progression.totalActions, progression.totalXp, streak, books, habits, dailyLogs]);

  useEffect(() => {
    if (!user || !progressionReady) { previousUnlockState.current = null; return; }
    const current = { level: levelInfo.level, achievements: achievements.filter(item => item.unlocked).map(item => item.title), xp: Number(progression.totalXp) || 0, actions: Number(progression.totalActions) || 0 };
    const previous = previousUnlockState.current;
    previousUnlockState.current = current;
    if (!previous) return;
    if (current.level > previous.level) {
      setUnlockCelebration({ type: "rank", title: "Rank achieved", name: levelInfo.name, level: levelInfo.level, detail: "You've earned your next rank.", id: "rank-" + levelInfo.level + "-" + current.xp });
      return;
    }
    const newlyUnlocked = current.achievements.find(name => !previous.achievements.includes(name));
    if (newlyUnlocked) { const item = achievements.find(entry => entry.title === newlyUnlocked); if (item) setUnlockCelebration({ type: "achievement", title: "Achievement unlocked", name: item.title, detail: item.detail, icon: item.icon, id: "achievement-" + item.title + "-" + current.actions }); }
  }, [user, progressionReady, progression.totalXp, progression.totalActions, levelInfo.level, levelInfo.name, achievements]);

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
    const library = shareReadingActivity ? books.filter(book => Boolean(book.finishedAt)).map(book => ({
      id: book.id, title: book.title || "Untitled book", author: book.author || "", cover: book.cover || "",
      startedAt: book.startedAt || "", finishedAt: book.finishedAt || ""
    })) : [];
    const currentReading = shareReadingActivity ? books.filter(book => !book.finishedAt).map(book => ({
      id: book.id, title: book.title || "Untitled book", author: book.author || "", cover: book.cover || "",
      startedAt: book.startedAt || "", currentPage: Number(book.currentPage) || 1, pageCount: Number(book.pageCount) || 0
    })) : [];
    const publicName = (accountName.trim() || user.displayName || "Stoic member").trim();
    setDoc(doc(db, "publicProfiles", user.uid), {
      uid: user.uid, displayName: publicName, displayNameLower: publicName.toLowerCase(),
      isFounder: user.email?.toLowerCase() === "joshrpenney@hotmail.co.uk",
      library, currentReading, libraryShared: shareReadingActivity, updatedAt: serverTimestamp()
    }, { merge: true })
      .catch(e => setError("Could not update your shared library: " + e.message));
  }, [user, books, shareReadingActivity]);

  useEffect(() => {
    if (!user || !db) return;
    const publicName = (accountName.trim() || user.displayName || "").trim();
    if (!publicName) return;
    setDoc(doc(db, "publicProfiles", user.uid), { uid: user.uid, displayName: publicName, displayNameLower: publicName.toLowerCase(), isFounder: user.email?.toLowerCase() === "joshrpenney@hotmail.co.uk", updatedAt: serverTimestamp() }, { merge: true }).catch(e => setError(e.message));
  }, [user, accountName]);

  useEffect(() => {
    if (!user || !db) return;
    setDoc(doc(db, "userProgress", user.uid), {
      uid: user.uid, displayName: accountName.trim() || user.displayName || "Stoic member",
      totalXp: Number(progression.totalXp) || 0, totalActions: Number(progression.totalActions) || 0,
      level: levelInfo.level, rank: levelInfo.name, streak,
      todayCompleted: doneCount, todayDue: dueHabits.length, shareProgress, updatedAt: serverTimestamp()
    }, { merge: true }).catch(e => setError(e.message));
  }, [user, accountName, progression.totalXp, progression.totalActions, levelInfo.level, levelInfo.name, streak, doneCount, dueHabits.length, shareProgress]);

  async function notifyMutualFriends(type, details = {}) {
    if (!user || !db) return;
    const privacySnap = await getDoc(doc(db, "users", user.uid, "settings", "privacy"));
    const privacy = privacySnap.exists() ? privacySnap.data() : {};
    const isReading = type === "book_started" || type === "book_finished";
    if (isReading ? privacy.shareReadingActivity !== true : privacy.shareProgress === false) return;
    const followersSnap = await getDocs(query(collection(db, "follows"), where("followedUid", "==", user.uid)));
    const profileSnap = await getDoc(doc(db, "publicProfiles", user.uid));
    const actorName = profileSnap.exists() ? profileSnap.data().displayName || "A friend" : user.displayName || "A friend";
    const eventKey = [user.uid,type,details.eventKey||todayKey()].join("_").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,180);
    await Promise.all(followersSnap.docs.map(async followerDoc => {
      const recipientUid=followerDoc.data().followerUid;
      if(!recipientUid||recipientUid===user.uid)return;
      if(!(await getDoc(doc(db,"follows",user.uid+"_"+recipientUid))).exists())return;
      const ref=doc(db,"users",recipientUid,"notifications",eventKey);
      if((await getDoc(ref)).exists())return;
      await setDoc(ref,{type,actorUid:user.uid,actorName,eventKey,read:false,createdAt:serverTimestamp(),
        ...(details.bookTitle?{bookTitle:details.bookTitle.slice(0,180)}:{}),
        ...(details.bookAuthor?{bookAuthor:details.bookAuthor.slice(0,120)}:{}),
        ...(details.message?{message:details.message.slice(0,220)}:{})});
    }));
  }
  async function refreshNotifications() {
    if(!user||!db){setNotificationItems([]);return;}
    try {const snap=await getDocs(query(collection(db,"users",user.uid,"notifications"),orderBy("createdAt","desc"),limit(100)));setNotificationItems(snap.docs.map(d=>({id:d.id,...d.data()})));}
    catch(e){setError("Could not load notifications: "+e.message);}
  }
  async function markAllNotificationsRead() {
    if(!user||!db)return;
    try {await Promise.all(notificationItems.filter(n=>!n.read).map(n=>updateDoc(doc(db,"users",user.uid,"notifications",n.id),{read:true})));setNotificationItems(items=>items.map(n=>({...n,read:true})));setNewFollowerNotifications([]);}
    catch(e){setError("Could not mark notifications as read: "+e.message);}
  }

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
      const followingIds = new Set(followingSnap.docs.map(snap => snap.data().followedUid));
      const followerRows = await Promise.all(followersSnap.docs.map(async snap => {
        const rel = snap.data();
        const [profileSnap, progressSnap] = await Promise.all([
          getDoc(doc(db, "publicProfiles", rel.followerUid)),
          followingIds.has(rel.followerUid) ? getDoc(doc(db, "userProgress", rel.followerUid)) : Promise.resolve(null)
        ]);
        return { id: snap.id, ...rel, profile: profileSnap.exists() ? profileSnap.data() : { displayName: "Stoic member" }, progress: progressSnap?.exists() ? progressSnap.data() : null };
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

  async function openMemberProfile(profile) {
    if (!profile?.uid || !db) { setSelectedMemberProfile(profile); return; }
    setError("");
    try {
      // Refresh the public profile and the member's rank summary when opening their profile.
      const [latest, progressSnap] = await Promise.all([
        getDoc(doc(db, "publicProfiles", profile.uid)),
        getDoc(doc(db, "userProgress", profile.uid))
      ]);
      const latestProfile = latest.exists() ? { ...profile, ...latest.data() } : profile;
      const progress = progressSnap.exists() ? progressSnap.data() : null;
      setSelectedMemberProfile({ ...latestProfile, progress });
    } catch (e) {
      setSelectedMemberProfile(profile);
      setError("Could not refresh this member's profile details: " + e.message);
    }
  }

  async function toggleFollow(profile) {
    if (!user || !db || !profile?.uid || profile.uid === user.uid) return;
    const alreadyFollowing = followingRecords.some(r => r.followedUid === profile.uid);
    const relationshipId = user.uid + "_" + profile.uid;
    setError(""); setNotice("");
    try {
      if (alreadyFollowing) { await deleteDoc(doc(db, "follows", relationshipId)); setNotice("You unfollowed " + (profile.displayName || "this member") + "."); }
      else {
        await setDoc(doc(db, "follows", relationshipId), { followerUid: user.uid, followedUid: profile.uid, createdAt: serverTimestamp() });
        setNotice("You are now following " + (profile.displayName || "this member") + ".");
        const becameMutual = followerRecords.some(row => row.followerUid === profile.uid);
        if (becameMutual) {
          const eventKey = ("mutual_follow_" + user.uid + "_" + profile.uid + "_" + Date.now()).slice(0, 180);
          await setDoc(doc(db, "users", profile.uid, "notifications", eventKey), {
            type: "mutual_follow", actorUid: user.uid, actorName: accountName || user.displayName || "A friend",
            eventKey, read: false, createdAt: serverTimestamp(),
            message: "You are now mutual accountability partners."
          }).catch(() => {});
        }
      }
      await refreshCommunity();
      setCommunityResults(rows => rows.map(row => row.uid === profile.uid ? { ...row, isFollowing: !alreadyFollowing } : row));
    } catch (e) { setError("Could not update your follow. Check that the Firestore rules have been published. " + e.message); }
  }

  useEffect(() => { if (user && (activeTab === "Community" || activeTab === "Profile")) refreshCommunity(); }, [user, activeTab]);
  useEffect(()=>{if(user)refreshNotifications();else setNotificationItems([]);},[user]);
  const previousLevelRef = useRef(null);
  const previousStreakRef = useRef(null);
  const previousAchievementsRef = useRef(null);
  useEffect(() => {
    if (!user || !db) { previousLevelRef.current=null; return; }
    const current=Number(levelInfo.level)||1;
    if(previousLevelRef.current===null){previousLevelRef.current=current;return;}
    const previous=previousLevelRef.current; previousLevelRef.current=current;
    if(current>previous) notifyMutualFriends("level_up",{eventKey:"level_"+current,message:"Reached Level "+current+"."}).catch(()=>{});
  },[user,levelInfo.level]);
  useEffect(() => {
    if (!user || !db) { previousStreakRef.current=null; return; }
    const current=Number(streak)||0;
    if(previousStreakRef.current===null){previousStreakRef.current=current;return;}
    const previous=previousStreakRef.current; previousStreakRef.current=current;
    const milestones=[3,7,14,30,60,100];
    if(current>previous && milestones.includes(current)) notifyMutualFriends("streak_milestone",{eventKey:"streak_"+current,message:"Reached a "+current+"-day streak."}).catch(()=>{});
  },[user,streak]);
  useEffect(() => {
    if (!user || !db) { previousAchievementsRef.current=null; return; }
    const unlocked=achievements.filter(a=>a.unlocked).map(a=>a.title);
    if(previousAchievementsRef.current===null){previousAchievementsRef.current=unlocked;return;}
    const previous=new Set(previousAchievementsRef.current);
    const fresh=unlocked.filter(title=>!previous.has(title));
    previousAchievementsRef.current=unlocked;
    fresh.forEach(title=>notifyMutualFriends("achievement",{eventKey:"achievement_"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-"),message:"Unlocked the "+title+" achievement."}).catch(()=>{}));
  },[user,achievements]);


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
        const cleanDisplayName = displayName.trim().replace(/\\s+/g, " ");
        if (cleanDisplayName.length < 2) throw new Error("Choose a profile name with at least 2 characters.");
        if (cleanDisplayName.length > 60) throw new Error("Your profile name must be 60 characters or fewer.");
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: cleanDisplayName });
        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: cleanDisplayName, email: email.trim(), createdAt: serverTimestamp()
        }, { merge: true });
        await setDoc(doc(db, "publicProfiles", credential.user.uid), {
          uid: credential.user.uid,
          displayName: cleanDisplayName,
          displayNameLower: cleanDisplayName.toLowerCase(),
          updatedAt: serverTimestamp()
        });
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
    const dueNonNegotiableIds=dueNonNegotiables.map(h=>h.id);
    const progressionRef=doc(db,"users",user.uid,"progression","summary");
    try { let earned=0, completing=false, perfectDayBonus=false;
      await runTransaction(db, async (transaction) => {
        const logSnap=await transaction.get(logRef); const pSnap=await transaction.get(progressionRef);
        const log=logSnap.exists()?logSnap.data():{}; const completed={...(log.completed||{})}; const xpAwarded={...(log.xpAwarded||{})};
        completing=!completed[habit.id]; completed[habit.id]=completing;
        const p=pSnap.exists()?pSnap.data():{totalXp:0,totalActions:0}; let totalXp=Number(p.totalXp)||0; let totalActions=Number(p.totalActions)||0;
        if(p.xpSystemVersion!==2) totalXp*=5;
        if(completing&&!xpAwarded[habit.id]) { const individualXp=habit.nonNegotiable?20:10; earned+=individualXp; xpAwarded[habit.id]=true; totalXp+=individualXp; totalActions++; }
        const dayDueIds=Array.isArray(log.dueHabitIds)&&log.dueHabitIds.length?log.dueHabitIds:dueHabitIds;
        if(completing&&!log.perfectDayXpAwarded&&dayDueIds.length>0&&dayDueIds.every(id=>completed[id]===true)) {
          perfectDayBonus=true; earned+=50; totalXp+=50;
        }
        transaction.set(logRef,{date:todayKey(),completed,xpAwarded,dueHabitIds:dayDueIds,dueNonNegotiableIds,perfectDayXpAwarded:!!log.perfectDayXpAwarded||perfectDayBonus,updatedAt:serverTimestamp()},{merge:true});
        transaction.set(progressionRef,{totalXp,totalActions,xpSystemVersion:2,updatedAt:serverTimestamp()},{merge:true});
      });
      if (!(completing && earned > 0)) setNotice(completing?"XP for this commitment was already earned today.":"Record updated. Earned XP is kept.");
      if (completing && earned > 0) setXpToast({ amount: earned, reason: perfectDayBonus ? (habit.nonNegotiable?"non-negotiable completed · perfect day bonus":"scheduled commitment completed · perfect day bonus") : (habit.nonNegotiable?"non-negotiable completed":"scheduled commitment completed"), id: Date.now() });
      if(completing&&habit.nonNegotiable&&dueNonNegotiableIds.length>0){const latest=await getDoc(logRef);const done=latest.exists()?latest.data().completed||{}:{};if(dueNonNegotiableIds.every(id=>done[id]))await notifyMutualFriends("all_non_negotiables",{eventKey:"all_non_negotiables_"+todayKey(),message:"Completed all non-negotiables for today."});}
    } catch(e) { setError(e.message); }
  }

  async function addBook(e) {
    e.preventDefault();
    if (!user || !db || !bookInput.trim()) return;
    try {
      const pageCount = Math.max(0, Number(bookPageCount) || 0);
      await addDoc(collection(db, "users", user.uid, "booksRead"), {
        title: bookInput.trim(), author: bookAuthor.trim(), startedAt: bookStarted || "", finishedAt: "", currentPage: 1, pageCount, cover: bookCover || "", createdAt: serverTimestamp()
      });
      await notifyMutualFriends("book_started", {bookTitle:bookInput.trim(),bookAuthor:bookAuthor.trim(),eventKey:"started_"+todayKey()+"_"+bookInput.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-")});
      setBookInput(""); setBookAuthor(""); setBookStarted(todayKey()); setBookFinished(""); setBookPage("1"); setBookPageCount(""); setBookCover(""); setBookSearchResults([]); setBookSearchOpen(false); setNotice("Book added to Currently reading.");
    } catch (e) { setError(e.message); }
  }

  async function updateBook(book, changes) {
    if (!user || !db) return;
    try {
      const bookRef = doc(db, "users", user.uid, "booksRead", book.id);
      const progressionRef = doc(db, "users", user.uid, "progression", "summary");
      let bookXpEarned = 0;
      await runTransaction(db, async (transaction) => {
        const bookSnap = await transaction.get(bookRef);
        const progressionSnap = await transaction.get(progressionRef);
        if (!bookSnap.exists()) throw new Error("This book could not be found.");
        const savedBook = bookSnap.data();
        const shouldAwardBookXp = Boolean(changes.finishedAt) && !savedBook.finishedAt && !savedBook.completionXpAwarded;
        transaction.set(bookRef, { ...changes, ...(shouldAwardBookXp ? { completionXpAwarded: true } : {}) }, { merge: true });
        if (shouldAwardBookXp) {
          const p = progressionSnap.exists() ? progressionSnap.data() : { totalXp: 0, totalActions: 0 };
          let totalXp = Math.max(0, Number(p.totalXp) || 0);
          if (p.xpSystemVersion !== 2) totalXp *= 5;
          totalXp += 250;
          transaction.set(progressionRef, { totalXp, totalActions: Number(p.totalActions) || 0, xpSystemVersion: 2, updatedAt: serverTimestamp() }, { merge: true });
          bookXpEarned = 250;
        }
      });
      if (bookXpEarned) setXpToast({ amount: bookXpEarned, reason: "book completed", id: Date.now() });
      if(changes.finishedAt&&!book.finishedAt) await notifyMutualFriends("book_finished",{bookTitle:book.title||"A book",bookAuthor:book.author||"",eventKey:"finished_"+book.id});
      setNotice(changes.finishedAt ? (bookXpEarned ? "Book completed. You earned 250 XP." : "Book marked as completed.") : changes.currentPage !== undefined ? "Reading progress saved." : "Book updated.");
    } catch (e) { setError(e.message); }
  }

  async function removeBook(book) {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "booksRead", book.id));
      setNotice("Book removed from your list.");
    } catch (e) { setError(e.message); }
  }

  const attemptedBookLookup = useRef(new Set());
  const [bookLookupStatus, setBookLookupStatus] = useState({});
  useEffect(() => {
    if (!user || !db) return;
    const normalise = value => (value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const titleMatches = (candidate, title) => {
      const a=normalise(candidate), b=normalise(title);
      return !!a && !!b && (a===b || (Math.min(a.length,b.length)>=7 && (a.startsWith(b) || b.startsWith(a) || a.includes(b) || b.includes(a))));
    };
    const missing = books.filter(book => !book.finishedAt && !(Number(book.pageCount)>0) && book.title && !attemptedBookLookup.current.has(user.uid+":"+book.id));
    missing.forEach(book => {
      const lookupKey=user.uid+":"+book.id;
      attemptedBookLookup.current.add(lookupKey);
      setBookLookupStatus(prev=>({...prev,[book.id]:"searching"}));
      (async () => {
        try {
          const authorTerm=(book.author||"").split(",")[0].trim();
          let pageCount=0, cover="";
          const authorMatches = authors => !authorTerm || !authors?.length || authors.some(author => normalise(author).includes(normalise(authorTerm)) || normalise(authorTerm).includes(normalise(author)));
          // Query Google Books using both title and author where available.
          try {
            const queryText = `intitle:${book.title}${authorTerm ? " inauthor:"+authorTerm : ""}`;
            const response=await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryText)}&maxResults=20&printType=books`);
            if(response.ok) {
              const data=await response.json();
              const candidates=(data.items||[]).map(item=>{const v=item.volumeInfo||{};return {title:v.title||"",authors:Array.isArray(v.authors)?v.authors:[],pageCount:Number(v.pageCount)||0,cover:v.imageLinks?.thumbnail?.replace("http://","https://")||""};});
              const match=candidates.find(item=>titleMatches(item.title,book.title)&&authorMatches(item.authors)&&item.pageCount>0);
              if(match){pageCount=match.pageCount;cover=match.cover;}
            }
          } catch(e) { /* Continue with Open Library. */ }
          // Open Library fallback; allow subtitle/edition title differences.
          if(!pageCount || (!book.cover&&!cover)) {
            try {
              const queryText=[book.title,authorTerm].filter(Boolean).join(" ");
              const response=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(queryText)}&limit=30&fields=title,author_name,number_of_pages_median,cover_i,first_publish_year`);
              if(response.ok) {
                const data=await response.json();
                const candidates=(data.docs||[]).filter(item=>titleMatches(item.title,book.title)&&authorMatches(item.author_name));
                const candidate=candidates.find(item=>Number(item.number_of_pages_median)>0);
                if(candidate){pageCount=pageCount||Number(candidate.number_of_pages_median)||0;cover=cover||(candidate.cover_i?`https://covers.openlibrary.org/b/id/${candidate.cover_i}-M.jpg`:"");}
              }
            } catch(e) { /* Report the lookup as unsuccessful below. */ }
          }
          const changes={};
          if(pageCount>0) changes.pageCount=pageCount;
          if(!book.cover&&cover) changes.cover=cover;
          if(Object.keys(changes).length) await updateDoc(doc(db,"users",user.uid,"booksRead",book.id),changes);
          setBookLookupStatus(prev=>({...prev,[book.id]:pageCount>0?"found":"not-found"}));
        } catch(e) {
          setBookLookupStatus(prev=>({...prev,[book.id]:"not-found"}));
        }
      })();
    });
  }, [books, user, db]);

  async function addHabit(e) {
    e.preventDefault();
    if (!newTitle.trim() || !user || !db) return;
    const currentCount = newNonNegotiable ? nonNegotiableHabits.length : flexibleHabits.length;
    const limit = newNonNegotiable ? MAX_NON_NEGOTIABLES : MAX_FLEXIBLE_COMMITMENTS;
    if (currentCount >= limit) { setError(`You can have up to ${limit} ${newNonNegotiable ? "daily non-negotiables" : "scheduled commitments"}. Edit or archive one before adding another.`); return; }
    if (!newNonNegotiable && newSchedule.length === 0) { setError("Choose at least one day for this commitment."); return; }
    try {
      await addDoc(collection(db, "users", user.uid, "habits"), {
        title: newTitle.trim(), category: newCategory, target: newTarget.trim(),
        nonNegotiable: newNonNegotiable, daysOfWeek: newNonNegotiable ? [0,1,2,3,4,5,6] : newSchedule, active: true, createdAt: serverTimestamp()
      });
      setNewTitle(""); setNewTarget(""); setNewCategory("Mindset"); setNewNonNegotiable(true); setNewSchedule([0,1,2,3,4,5,6]); setShowAdd(false); setError("");
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
    const countInSelectedGroup = (editingIsNonNegotiable ? nonNegotiableHabits : flexibleHabits).filter(h => h.id !== editingHabitId).length;
    const limit = editingIsNonNegotiable ? MAX_NON_NEGOTIABLES : MAX_FLEXIBLE_COMMITMENTS;
    if (habits.find(h => h.id === editingHabitId)?.nonNegotiable && !editingIsNonNegotiable) { setError("Your five daily standards can only be replaced by editing their details in Settings, not by switching them off."); return; }
    if (countInSelectedGroup >= limit) { setError(`You can have up to ${limit} ${editingIsNonNegotiable ? "daily non-negotiables" : "scheduled commitments"}. Change or archive one before moving this commitment.`); return; }
    if (!editingIsNonNegotiable && editingSchedule.length === 0) { setError("Choose at least one day for this commitment."); return; }
    try {
      await updateDoc(doc(db, "users", user.uid, "habits", editingHabitId), {
        title: editingTitle.trim(), category: editingCategory, target: editingTarget.trim(),
        nonNegotiable: editingIsNonNegotiable, daysOfWeek: editingIsNonNegotiable ? [0,1,2,3,4,5,6] : editingSchedule, updatedAt: serverTimestamp()
      });
      setEditingHabitId(null); setError(""); setNotice("Commitment updated.");
    } catch (e) { setError(e.message); }
  }

  async function removeHabit(habit) {
    if (habit.nonNegotiable && activeTab !== "Settings") { setError("Daily standards can only be changed in Settings."); return; }
    if (!user || !db || !confirm(`Remove "${habit.title}"? Previous daily records and earned XP are retained.`)) return;
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
        {mode === "register" && <label>Profile name<input required minLength="2" maxLength="60" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="What should we call you?" autoComplete="name" /><small className="auth-field-hint">This name helps friends find you. Your email address is never shown on your public profile.</small></label>}
        <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
        <label>Password<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode==="register"?"new-password":"current-password"} /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create my account" : "Enter your journal"} <span>→</span></button>
        {mode === "login" && <button type="button" className="auth-text-button" disabled={busy || !email.trim()} onClick={async()=>{setError("");setNotice("");setBusy(true);try{await sendPasswordResetEmail(auth,email.trim());setNotice("Password reset email sent. Check your inbox.");}catch(e){setError(e.message.replace("Firebase: ",""));}finally{setBusy(false);}}}>Forgot your password?</button>}
        {notice && !user && <p className="notice">{notice}</p>}
      </form>
      <p className="fine-print">Your journal is private to your account. Never reuse a password from another service.</p>
    </div>
  </main>;

  if (selectedMemberProfile) {
    const member = selectedMemberProfile;
    const followsThem = followingRecords.some(r => r.followedUid === member.uid);
    const theyFollow = followerRecords.some(r => r.followerUid === member.uid);
    const mutual = followsThem && theyFollow;
    const sharedProgress = member.progress || followingRecords.find(r => r.followedUid === member.uid)?.progress;
    const visibleRank = sharedProgress && (sharedProgress.shareProgress || mutual) ? {
      level: Math.max(1, Number(sharedProgress.level) || 1),
      name: sharedProgress.rank || "Initiate"
    } : null;
    return <main className="app-shell">
      
    <header className="topbar">
        <button className="topbar-quiet-button" title="Back to community" aria-label="Back to community" onClick={() => setSelectedMemberProfile(null)}><ArrowLeft size={18}/></button>
        <div className="brand"><div className="brand-small">S</div><div><strong>STOIC</strong><span>MEMBER PROFILE</span></div></div>
        <button className="topbar-quiet-button" title="Close profile" aria-label="Close profile" onClick={() => setSelectedMemberProfile(null)}><ArrowLeft size={16}/></button>
      </header>
      <section className="member-profile-page">
        <p className="eyebrow">ACCOUNTABILITY CIRCLE</p>
        <div className="member-profile-hero">
          <div className="member-profile-avatar">{(member.displayName || "S").trim().charAt(0).toUpperCase()}</div>
          <div className="member-profile-name-row">
            <h1>{member.displayName || "Stoic member"}</h1>
          </div>
          <p className={member.isFounder ? "founder-subtitle" : "muted"}>{member.isFounder ? "Stoic Discipline Founder" : "Stoic Discipline member"}</p>
          <div className="member-profile-actions">
            <button className={followsThem ? "secondary" : "primary"} onClick={() => toggleFollow(member)}>{followsThem ? <><UserCheck size={15}/> Following</> : <><UserPlus size={15}/> Follow</>}</button>
            <span className="member-connection-status">{mutual ? "Mutual friends" : followsThem ? "You follow them" : theyFollow ? "Follows you" : "Not connected yet"}</span>
          </div>
        </div>
        <section className="community-section member-shared-section">
          <div className="member-shared-heading">
            <p className="eyebrow">SHARED PROGRESS</p>
            {visibleRank && <div className="member-profile-rank-badge"><RankStoneEmblem level={visibleRank.level}/><span><strong>{visibleRank.name}</strong><small>Level {visibleRank.level}</small></span></div>}
          </div>
          {mutual && sharedProgress ? <>
            <div className="profile-stats member-profile-stats">
              <article><Trophy size={20}/><strong>{Number(sharedProgress.totalXp)||0}</strong><span>total XP</span></article>
              <article><Target size={20}/><strong>{Number(sharedProgress.totalActions)||0}</strong><span>actions completed</span></article>
              <article><Flame size={20}/><strong>{Number(sharedProgress.streak)||0}</strong><span>day streak</span></article>
            </div>
            <div className="community-daily member-daily"><div className="community-daily-label"><span>Today's commitments</span><strong>{Number(sharedProgress.todayCompleted)||0}/{Number(sharedProgress.todayDue)||0}</strong></div><div className="community-daily-track"><span style={{width:((Number(sharedProgress.todayDue)||0)?Math.min(100,Math.round((Number(sharedProgress.todayCompleted)||0)/(Number(sharedProgress.todayDue)||0)*100)):0)+"%"}}/></div></div>
          </> : <div className="empty community-empty"><Users size={26}/><h3>{mutual ? "Progress not shared" : "Shared progress is locked"}</h3><p>{mutual ? "This member has chosen not to share their progress, or their summary is not available yet." : "You can see shared progress when you follow each other and this member has sharing enabled."}</p></div>}
        </section>
        <section className="community-section member-library-section">
          <div className="member-library-toggle member-reading-heading">
            <span><BookOpen size={20}/><strong>Currently reading</strong><small>{Array.isArray(member.currentReading) ? member.currentReading.length+" books in progress" : "Books in progress"}</small></span>
          </div>
          {Array.isArray(member.currentReading) && member.currentReading.length ? <div className="member-library-content member-current-reading-list">{member.currentReading.map((book,index)=><article className="member-library-book member-current-book" key={book.id||book.title+"-"+index}>{book.cover ? <img src={book.cover} alt="" loading="lazy"/> : <div className="member-library-book-placeholder"><BookOpen size={19}/></div>}<div><strong>{book.title}</strong><span>{book.author||"Author unknown"}</span><small>Started {book.startedAt ? new Date(book.startedAt+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "date not provided"}</small>{book.pageCount>0&&<small>Page {book.currentPage||1} of {book.pageCount}</small>}</div></article>)}</div> : <p className="settings-description member-reading-empty">{member.libraryShared === false ? "This member hasn’t shared their reading activity." : "No books currently being read have been shared."}</p>}
        </section>
        <section className="community-section member-library-section">
          <button type="button" className="member-library-toggle" aria-expanded={showMemberLibrary} onClick={()=>setShowMemberLibrary(v=>!v)}>
            <span><BookOpen size={20}/><strong>Library</strong><small>{Array.isArray(member.library) ? member.library.length+" books completed" : "Books completed"}</small></span>
            <ChevronDown className={showMemberLibrary?"is-open":""} size={20}/>
          </button>
          {showMemberLibrary && <div className="member-library-content">
            {Array.isArray(member.library) && member.library.length ? <div className="member-library-list">{member.library.map((book,index)=><article className="member-library-book" key={book.id||book.title+"-"+index}>{book.cover ? <img src={book.cover} alt="" loading="lazy"/> : <div className="member-library-book-placeholder"><BookOpen size={19}/></div>}<div><strong>{book.title}</strong><span>{book.author||"Author unknown"}</span></div></article>)}</div> : <p className="settings-description">{member.library === undefined ? "This member hasn’t shared a library yet." : "No completed books to show yet."}</p>}
          </div>}
        </section>
        <p className="member-profile-privacy">Private journal entries and habits are not shown on this profile. Shared reading activity shows books in progress and their start dates; the Library shows completed books.</p>
      </section>
      <nav className="bottom-nav member-profile-bottom-nav">{[["Reading",BookOpen],["Non-negotiables",ShieldCheck],["Today",Target],["Profile",Star]].map(([label,Icon]) => <button type="button" key={label} className="nav-item" onClick={()=>{setSelectedMemberProfile(null);setActiveTab(label);setShowRanksPage(false);setSocialListView("");setShowMemberLibrary(false);setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><span className="nav-icon-wrap"><Icon size={21}/></span><span>{label==="Non-negotiables"?"Non-neg.":label}</span></button>)}</nav>
    </main>;
  }

  return <main className="app-shell">
    {unlockCelebration && <div className="unlock-celebration-backdrop" role="dialog" aria-modal="true" aria-labelledby="unlock-celebration-title">
      <div className="unlock-celebration-panel">
        <div className="unlock-celebration-overline">{unlockCelebration.type === "rank" ? "THE PATH OF DISCIPLINE" : "PROOF OF PRACTICE"}</div>
        <div className={"unlock-celebration-emblem " + (unlockCelebration.type === "rank" ? "rank-emblem" : "achievement-emblem")} aria-hidden="true">{unlockCelebration.type === "rank" ? <RankStoneEmblem level={unlockCelebration.level} Icon={[ShieldCheck, Shield, Swords, FlameRank, Mountain, Eye, Compass, Crown, Sun, Gem, InfinityIcon, Landmark][unlockCelebration.level - 1] || ShieldCheck}/> : <div className="achievement-icon unlocked unlock-celebration-achievement-stone"><span className="achievement-medal-ring"/>{unlockCelebration.icon ? (()=>{const AchievementIcon=unlockCelebration.icon;return <AchievementIcon size={38}/>})() : <Award size={38}/>}<span className="achievement-medal-number">✓</span></div>}<span>✦</span></div>
        <div className="unlock-celebration-kicker">{unlockCelebration.title}</div>
        <h2 id="unlock-celebration-title">{unlockCelebration.name}</h2>
        {unlockCelebration.type === "rank" && <p className="unlock-celebration-level">Level {unlockCelebration.level}</p>}
        <p>{unlockCelebration.detail}</p>
        <button type="button" className="unlock-celebration-continue" onClick={()=>setUnlockCelebration(null)}>Continue</button>
      </div>
    </div>}
    {xpToast && <div className="xp-toast" role="status" aria-live="polite" key={xpToast.id}><div className="xp-toast-icon"><Sparkles size={22}/></div><div className="xp-toast-copy"><strong>+{xpToast.amount} XP</strong><span>Earned for {xpToast.reason}</span></div><button type="button" aria-label="Dismiss XP notification" onClick={()=>setXpToast(null)}><X size={17}/></button></div>}
    {showNotifications && <div className="follower-notification-backdrop" role="presentation">
      <section className="follower-notification-dialog" role="dialog" aria-modal="true" aria-labelledby="follower-notification-title">
        <button className="follower-notification-close" aria-label="Dismiss notifications" onClick={() => setShowNotifications(false)}><X size={18}/></button>
        <div className="follower-notification-icon"><Bell size={24}/></div>
        <p className="eyebrow">YOUR ACCOUNTABILITY CIRCLE</p>
        <h2 id="follower-notification-title">{newFollowerNotifications.length === 1 ? "Someone followed you" : newFollowerNotifications.length > 1 ? "New followers" : "Notifications"}</h2>
        <p className="muted">{newFollowerNotifications.length || notificationItems.some(n=>!n.read) ? "Updates from the people in your corner." : "You’re all caught up. New activity will appear here when it happens."}</p>
        <div className="follower-notification-list">{newFollowerNotifications.map(item => <button key={item.eventKey} className="follower-notification-person" onClick={() => { setActiveTab("Community"); setSelectedMemberProfile({uid:item.followerUid,displayName:item.displayName}); setNewFollowerNotifications([]); setShowNotifications(false); }}><span className="community-avatar">{(item.displayName||"S").trim().charAt(0).toUpperCase()}</span><span><strong>{item.displayName}</strong><small>Started following you · View profile</small></span><ArrowLeft className="follower-notification-arrow" size={16}/></button>)}{notificationItems.map(item=><button key={item.id} className="follower-notification-person" onClick={()=>{markAllNotificationsRead();setActiveTab("Community");setSelectedMemberProfile({uid:item.actorUid,displayName:item.actorName||"Stoic member"});setShowNotifications(false);}}><span className="community-avatar">{(item.actorName||"S").trim().charAt(0).toUpperCase()}</span><span><strong>{item.actorName||"A friend"} {item.type==="book_started"?"started reading":item.type==="book_finished"?"finished reading":item.type==="all_non_negotiables"?"completed all non-negotiables":item.type==="streak_milestone"?"reached a streak milestone":item.type==="level_up"?"levelled up":item.type==="achievement"?"unlocked an achievement":item.type==="mutual_follow"?"is now your accountability partner":"shared an update"}</strong><small>{item.bookTitle?(item.bookTitle+(item.bookAuthor?" — "+item.bookAuthor:"")):(item.message||"View profile")}</small></span><ArrowLeft className="follower-notification-arrow" size={16}/></button>)}</div>
        <button className="primary follower-notification-done" onClick={() => { markAllNotificationsRead(); setShowNotifications(false); }}>Mark all as read</button>
      </section>
    </div>}
    <header className="topbar">
      <div className="brand"><div className="brand-small">S</div><div><strong>STOIC</strong><span>DISCIPLINE JOURNAL</span></div></div>
      <div className="topbar-actions"><button className="topbar-quiet-button add-friend-icon-button" title="Add friends" aria-label="Add friends" onClick={()=>{if(activeTab!=="Community"){setActiveTab("Community");setSelectedMemberProfile(null);setSocialListView("");}else if(selectedMemberProfile){setSelectedMemberProfile(null);}else{setCommunitySearch("");setCommunityResults([]);}setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><UserPlus size={16}/></button><button className="topbar-quiet-button notification-bell-button" title="Notifications" aria-label="Notifications" onClick={()=>{const opening=!showNotifications;setShowNotifications(opening);if(opening)refreshNotifications();}}><Bell size={16}/>{(newFollowerNotifications.length+notificationItems.filter(n=>!n.read).length)>0&&<span className="notification-count">{newFollowerNotifications.length+notificationItems.filter(n=>!n.read).length>9?"9+":newFollowerNotifications.length+notificationItems.filter(n=>!n.read).length}</span>}</button><button className="topbar-quiet-button" title="Settings" aria-label="Settings" onClick={()=>{if(activeTab!=="Settings"){setActiveTab("Settings");setSettingsSection("menu");}else if(settingsSection!=="menu"){setSettingsSection("menu");}setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><Settings size={16}/></button><button className="topbar-quiet-button" title="Sign out" aria-label="Sign out" onClick={() => signOut(auth)}><LogOut size={16}/></button></div>
    </header>
    {activeTab === "Today" && <div className="today-page">
    <section className="welcome">
      <p className="eyebrow">{prettyDate.format(new Date()).toUpperCase()}</p>
      <h1>Do what matters.<br/><span>Leave the rest.</span></h1>
      <p className="muted">Welcome back{user.displayName ? `, ${user.displayName}` : ""}. Focus on the actions within your control.</p>
    </section>
    <section className="today-summary-card">
      <div className="today-summary-top">
        <div><p className="eyebrow">TODAY AT A GLANCE</p><h2>{doneCount}<span> / {dueHabits.length}</span></h2><p>{dueHabits.length===0?"Nothing scheduled today":percent===100?"Every commitment complete":"commitments completed"}</p></div>
        <div className="today-summary-ring" style={{"--completion":`${percent}%`}}><strong>{percent}%</strong></div>
      </div>
      <div className="today-summary-track"><div style={{width:`${percent}%`}}/></div>
      <div className="today-summary-bottom">
        <div className="today-summary-streak"><Flame className={`streak-flame streak-material-${streak>=100?"diamond":streak>=60?"gold":streak>=30?"bronze":streak>=14?"copper":streak>=7?"iron":"stone"}`} size={19}/><strong>{streak}-day streak</strong></div>
        <span>{dueNonNegotiables.length===0?"No daily standards due":allNonNegotiablesKept?"Daily standard upheld":`${dueNonNegotiables.length-doneNonNegotiables} standards left`}</span>
      </div>
      <div className="today-rank-strip">
        <RankStoneEmblem level={levelInfo.level} Icon={RANK_ICONS[levelInfo.level - 1]}/>
        <div><span className="eyebrow">CURRENT RANK</span><strong>{levelInfo.name} · Level {levelInfo.level}</strong><small>{levelInfo.next?`${levelInfo.remaining.toLocaleString()} XP to Level ${levelInfo.next.level}`:"Highest rank reached"}</small></div>
        <b>{levelInfo.xp.toLocaleString()} XP</b>
      </div>
    </section>    <section className="section-heading"><div><p className="eyebrow">YOUR COMMITMENTS</p><h2>Today's checklist</h2><p className="muted commitment-limit-summary">{nonNegotiableHabits.length}/5 daily non-negotiables · {flexibleHabits.length}/5 scheduled commitments</p></div></section>
    {error && <div className="error-banner">{error}</div>}
    {notice && <p className="notice">{notice}</p>}
    <div className="commitment-groups">
      {[
        {title:"Non-negotiables",subtitle:"The promises you keep first",items:nonNegotiableToday,icon:ShieldCheck},
        {title:"Training & movement",subtitle:"Build a stronger body",items:trainingToday,icon:Dumbbell},
        {title:"Other commitments",subtitle:"The rest of today's priorities",items:otherToday,icon:Target}
      ].filter(group=>group.items.length>0).map(group=>{const GroupIcon=group.icon;return <section className={`commitment-group ${group.title === "Non-negotiables" ? "non-negotiable-group" : "other-commitment-group"}`} key={group.title}>
        <div className="commitment-group-heading"><div className="commitment-group-icon"><GroupIcon size={17}/></div><div><h3>{group.title}</h3><p>{group.subtitle}</p></div><span>{group.items.filter(h=>checks[h.id]).length}/{group.items.length}</span></div>
        <div className="habit-list">{group.items.map(h=>{const Icon=categoryIcon(h.category);return <article className={`habit ${checks[h.id]?"completed":""}`} key={h.id}>
          <button className="habit-check" aria-label={checks[h.id]?"Mark incomplete":"Mark complete"} onClick={()=>toggleHabit(h)}>{checks[h.id]?<Check size={19}/>:<Circle size={21}/>}</button>
          <div className="habit-icon"><Icon size={19}/></div>
          <button className="habit-copy" onClick={()=>toggleHabit(h)}><strong>{h.title}</strong><span>{h.target || h.category}{h.nonNegotiable ? " · NON-NEGOTIABLE" : ""}</span></button>
          
        </article>;})}</div>
      </section>})}
      {!dueHabits.length && <div className="empty"><Target size={30}/><h3>A clear day by design</h3><p>No commitments are scheduled for today. Enjoy the rest day or adjust your schedule in Settings.</p></div>}
    </div>
    <section className="principle-card"><div className="quote-mark">“</div><p>You have power over your mind — not outside events. Realise this, and you will find strength.</p><span>— Marcus Aurelius, <i>Meditations</i> (paraphrased)</span></section>
    </div>}
    {activeTab !== "Today" && <section className="tab-page">
      {activeTab === "Reading" && <>
        <p className="eyebrow">TRAIN THE MIND</p><h1 className="tab-title">Reading library</h1>
        <p className="muted">Track your progress as you read, then move finished books into your completed library.</p>
        <form className="book-form" onSubmit={addBook}>
          <div className="book-search-wrap"><label>Find a book<input required maxLength="140" value={bookInput} onFocus={()=>setBookSearchOpen(true)} onChange={e=>{setBookInput(e.target.value);setBookSearchOpen(true);setBookCover("");}} placeholder="Start typing a title or author…"/></label>
            {bookSearchOpen && bookInput.trim().length >= 3 && <div className="book-search-results">
              {bookSearchBusy && <p className="book-search-message">Searching books…</p>}
              {!bookSearchBusy && bookSearchResults.map(result=><button type="button" className="book-search-result" key={result.id} onClick={()=>{setBookInput(result.title);setBookAuthor(result.author);setBookPageCount(result.pageCount?String(result.pageCount):"");setBookCover(result.cover);setBookSearchResults([]);setBookSearchOpen(false);setBookPage("1");}}>
                {result.cover ? <img src={result.cover} alt="" /> : <span className="book-search-placeholder"><BookOpen size={18}/></span>}
                <span className="book-search-result-copy"><strong>{result.title}</strong><small>{result.author || "Author unknown"}{result.published ? " · "+result.published.slice(0,4) : ""}</small>{result.pageCount>0&&<small>{result.pageCount} pages</small>}</span>
              </button>)}
              {!bookSearchBusy && !bookSearchResults.length && !bookSearchError && <p className="book-search-message">No matches found. You can enter the details manually.</p>}
              {bookSearchError && <p className="book-search-message">{bookSearchError}</p>}
              <button type="button" className="book-search-close" onClick={()=>setBookSearchOpen(false)}>Close results</button>
            </div>}
            <small className="book-form-hint">Search the book database, or type the details yourself.</small>
          </div>
          <label>Author<input maxLength="160" value={bookAuthor} onChange={e=>setBookAuthor(e.target.value)} placeholder="Author's name"/></label>
          <div className="book-date-grid"><label>Started reading<input type="date" required value={bookStarted} onChange={e=>setBookStarted(e.target.value)}/></label><label>Total pages<input type="number" min="1" max="100000" value={bookPageCount} onChange={e=>setBookPageCount(e.target.value)} placeholder="From book details"/></label></div>
          {!bookFinished && bookInput.trim() && <div className="reading-estimate-preview"><span><BookOpen size={16}/> {bookPageCount ? "Estimated total reading time" : "Reading time estimate"}</span>{bookPageCount ? <><strong>{formatReadingTime(Number(bookPageCount), wordsPerPage, readingWpm)}</strong><small>Based on {Number(bookPageCount)} pages at {readingWpm} words/min. Estimated time remaining from page {Math.max(1,Number(bookPage)||1)}: {formatReadingTime(Math.max(0, Number(bookPageCount)-Math.max(1,Number(bookPage)||1)+1), wordsPerPage, readingWpm)}.</small></> : <small>{formPageLookupStatus==="searching" ? "Searching Google Books and Open Library for this title and author…" : formPageLookupStatus==="not-found" ? "No matching page count found yet. Try selecting a search result or enter the total pages manually." : "A book-specific estimate will appear once its page count is found. Searching the book databases automatically."}</small>}</div>}
          <button className="primary">Add book <Plus size={16}/></button>
        </form>
        <section className="book-section">
          <div className="reading-list-heading"><div><p className="eyebrow">IN PROGRESS</p><h2>Currently reading</h2></div><span className="book-count-finished">{books.filter(b=>!b.finishedAt).length} books</span></div>
          <div className="book-list">{books.filter(b=>!b.finishedAt).map((book,i)=><article className="book-item book-progress-item" key={book.id}><div className="book-cover">{book.cover ? <img src={book.cover} alt="" /> : <BookOpen size={21}/>}<span>{String(i+1).padStart(2,"0")}</span></div><div className="book-info"><strong>{book.title}</strong><span>{book.author || "Author not added"}</span><div className="book-time-estimate">{Number(book.pageCount)>0 ? <><span>{book.pageCount} pages</span><span>~{formatReadingTime(book.pageCount,wordsPerPage,readingWpm)} total</span><span>~{formatReadingTime(Math.max(0,book.pageCount-Math.max(1,Number(book.currentPage)||1)+1),wordsPerPage,readingWpm)} left</span></> : <span className="book-estimate-note">{bookLookupStatus[book.id]==="not-found" ? "Page count not found. Enter the total pages to calculate reading time." : "Searching Google Books and Open Library for page count…"}</span>}</div><div className="book-dates"><span><small>STARTED</small>{book.startedAt ? new Date(book.startedAt+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "Not recorded"}</span><span><small>TOTAL PAGES</small><label className="page-input-label"><input aria-label={"Total pages for "+book.title} type="number" min="1" max="100000" defaultValue={book.pageCount||""} placeholder="Enter total" onBlur={e=>{const raw=e.target.value.trim();const n=raw?Math.max(1,Number(raw)||1):0;if(n!==Number(book.pageCount||0))updateBook(book,{pageCount:n||null});}}/> <span>pages</span></label></span><span><small>CURRENT PAGE</small><label className="page-input-label"><input aria-label={"Current page for "+book.title} type="number" min="1" max="100000" defaultValue={book.currentPage || 1} onBlur={e=>{const n=Math.max(1,Number(e.target.value)||1);if(n!==Number(book.currentPage||1))updateBook(book,{currentPage:n});}}/> <span>page</span></label></span></div><label className="finish-date-label">Finished reading<input aria-label={"Finish date for "+book.title} type="date" min={book.startedAt||undefined} value={book.finishedAt||""} onChange={e=>{if(e.target.value)updateBook(book,{finishedAt:e.target.value});}}/></label></div><button className="remove-button" aria-label={"Remove "+book.title} onClick={()=>removeBook(book)}><Trash2 size={17}/></button></article>)}{!books.some(b=>!b.finishedAt)&&<div className="empty"><BookOpen size={30}/><h3>No books in progress</h3><p>Add a book above and it will appear here until you finish it.</p></div>}</div>
        </section>
        <section className="book-section completed-book-section">
          <div className="reading-list-heading"><div><p className="eyebrow">A LIBRARY OF FINISHED IDEAS</p><h2>Completed books</h2></div><span className="book-count-finished">{books.filter(b=>!!b.finishedAt).length} finished</span></div>
          <div className="book-list">{books.filter(b=>!!b.finishedAt).map((book,i)=><article className="book-item completed-book-item" key={book.id}><div className={"book-cover completed-cover"+(book.cover?" has-book-cover":"")}>{book.cover ? <img src={book.cover} alt={book.title+" book cover"} loading="lazy"/> : <><Check size={21}/><span>{String(i+1).padStart(2,"0")}</span></>}</div><div className="book-info"><strong>{book.title}</strong><span>{book.author || "Author not added"}</span><div className="book-dates"><span><small>STARTED</small>{book.startedAt ? new Date(book.startedAt+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "Not recorded"}</span><span><small>FINISHED</small>{new Date(book.finishedAt+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span></div><button className="reopen-book" onClick={()=>updateBook(book,{finishedAt:""})}>Move back to reading</button></div><button className="remove-button" aria-label={"Remove "+book.title} onClick={()=>removeBook(book)}><Trash2 size={17}/></button></article>)}{!books.some(b=>!!b.finishedAt)&&<div className="empty"><Trophy size={30}/><h3>Your finished books will live here</h3><p>Choose a finish date on a book above and it will move into this section automatically.</p></div>}</div>
        </section>
      </>}
      {activeTab === "Non-negotiables" && <div className="standard-page">
        <div className="standard-intro">
          <p className="eyebrow">THE DISCIPLINE YOU CHOOSE</p>
          <h1 className="tab-title">The Standard.</h1>
          <p className="muted">Five promises. One standard. Kept through action.</p>
        </div>
        <section className="standard-code-section">
          <div className="standard-section-heading"><div><p className="eyebrow">YOUR PERSONAL CODE</p><h2>Five non-negotiables</h2></div><button className="secondary" onClick={()=>{setActiveTab("Settings");setSettingsSection("menu");window.scrollTo({top:0,behavior:"smooth"});}}>Edit <Settings size={15}/></button></div>
          {nonNegotiableHabits.length !== 5 && <div className="settings-panel"><strong>Complete your personal code</strong><p className="settings-description">Your standard is built around exactly five non-negotiables. You currently have {nonNegotiableHabits.length}. Set them up in Settings.</p><button className="primary" onClick={()=>{setActiveTab("Settings");setSettingsSection("menu");window.scrollTo({top:0,behavior:"smooth"});}}>Manage your standards</button></div>}
          <div className="standard-code-list">
            {nonNegotiableHabits.map((habit,index)=>{const Icon=categoryIcon(habit.category);return <article className="standard-code-item" key={habit.id}><span className="standard-code-number">{String(index+1).padStart(2,"0")}</span><span className="standard-code-icon"><Icon size={19}/></span><div className="standard-code-copy"><h3>{habit.title}</h3><p>{habit.target || habit.category}</p></div><span className="standard-code-mark"><ShieldCheck size={17}/></span></article>})}
            {!nonNegotiableHabits.length && <div className="empty"><ShieldCheck size={30}/><h3>Your code starts here</h3><p>Choose the five promises that define the standard you intend to live by.</p></div>}
          </div>
        </section>
        <section className="standard-principle">
          <div className="standard-principle-heading"><span className="standard-principle-mark"><ShieldCheck size={19}/></span><p className="eyebrow">THE PRINCIPLE</p></div>
          <h2>Character is built in the keeping.</h2>
          <p>Do not measure yourself by what you intend to do. Let the promises you keep speak for you.</p>
          <small>CONSISTENCY OVER INTENSITY</small>
        </section>
      </div>}
      {activeTab === "Profile" && (showRanksPage ? <section className="ranks-page"><button className="community-back" onClick={()=>{setShowRanksPage(false);window.scrollTo({top:0,behavior:"smooth"});}}><ArrowLeft size={18}/> Back to profile</button><p className="eyebrow">THE PATH OF DISCIPLINE</p><h1 className="tab-title">Ranks & achievements</h1><p className="muted">Earn XP by keeping your promises. Locked badges remain hidden until you earn them.</p><section className="rank-list-section"><div className="reading-list-heading"><div><p className="eyebrow">YOUR PROGRESSION</p><h2>Ranks</h2></div><span className="book-count-finished">{levelInfo.xp.toLocaleString()} XP</span></div><div className="rank-list">{RANKS.map(rank=>{const reached=levelInfo.xp>=rank.xp;return <article key={rank.level} className={"rank-list-item "+(reached?"rank-reached":"rank-locked")}><RankStoneEmblem level={rank.level} Icon={RANK_ICONS[rank.level - 1]}/><div className="rank-list-copy"><strong>{reached?rank.name:"????"}</strong><span>Level {rank.level}</span></div><div className="rank-list-xp"><strong>{rank.xp.toLocaleString()} XP</strong><span>{reached?"Unlocked":(rank.xp-levelInfo.xp).toLocaleString()+" XP to go"}</span></div></article>})}</div></section><section className="rank-list-section"><div className="reading-list-heading"><div><p className="eyebrow">PROOF OF PRACTICE</p><h2>Achievements</h2></div><span className="book-count-finished">{achievements.filter(a=>a.unlocked).length}/{achievements.length}</span></div><div className="achievement-grid">{achievements.map((a,index)=>{const Icon=a.icon;const pct=Math.round((a.progress/a.goal)*100);return <article className={"achievement "+(a.unlocked?"unlocked":"locked")+" achievement-group-"+a.group.toLowerCase()} key={a.title} style={{"--achievement-index":index}}><div className="achievement-icon" aria-hidden="true"><span className="achievement-medal-ring"/><Icon size={20}/><span className="achievement-medal-number">{String(index+1).padStart(2,"0")}</span></div><div className="achievement-copy"><strong>{a.title}</strong><span>{a.detail}</span><div className="achievement-progress-track" role="progressbar" aria-label={a.title+" progress"} aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={a.progress}><span style={{width:pct+"%"}}/></div><small className="achievement-progress-label">{a.progress.toLocaleString()} / {a.goal.toLocaleString()} {a.unlocked?"· Earned": "· "+pct+"%"}</small></div><div className="achievement-status">{a.unlocked?<Check size={16}/>:<span>LOCKED</span>}</div></article>})}</div></section></section> : socialListView ? <section className="social-directory-page">
        <header className="social-directory-header"><button type="button" className="topbar-quiet-button" aria-label="Back to profile" onClick={()=>setSocialListView("")}><ArrowLeft size={18}/></button><div><h1>{socialListView === "following" ? "Following" : "Followers"}</h1><p>{socialListView === "following" ? followingRecords.length : followerRecords.length} {socialListView === "following" ? "people you follow" : "people following you"}</p></div><button type="button" className="quiet-icon-button" title="Refresh lists" onClick={refreshCommunity}><RefreshCw size={16}/></button></header>
        <div className="social-directory-list">{(socialListView === "following" ? followingRecords : followerRecords).length === 0 ? <div className="empty community-empty"><Users size={28}/><h3>{socialListView === "following" ? "You're not following anyone yet" : "No followers yet"}</h3><p>Your accountability circle will appear here.</p></div> : (socialListView === "following" ? followingRecords : followerRecords).map(row=>{const isFollowing=socialListView==="following";const uid=isFollowing?row.followedUid:row.followerUid;const profile=row.profile||{};const p=row.progress||{};const mutual=!!row.progress;return <article className="social-directory-card" key={uid}><button type="button" className="social-directory-person" onClick={()=>{setSelectedMemberProfile({...profile,uid});setSocialListView("");}} aria-label={"View "+(profile.displayName||"member")+" profile"}><div className="community-avatar social-directory-avatar">{(profile.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="social-directory-person-copy"><strong>{profile.displayName||"Stoic member"}</strong><span className={profile.isFounder?"founder-subtitle":"social-member-label"}>{profile.isFounder?"Stoic Discipline Founder":"Stoic Discipline member"}</span><small>{mutual?"Mutual friends":isFollowing?"You follow them":"Follows you"} · View profile</small></div><ChevronRight size={18} className="social-directory-chevron"/></button><div className="social-directory-stats"><div><Trophy size={15}/><strong>{mutual?Number(p.totalXp)||0:"—"}</strong><span>XP</span></div><div><ShieldCheck size={15}/><strong>{mutual?("Level "+(p.level||1)):"Private"}</strong><span>{mutual?(p.rank||"Initiate"):"Progress"}</span></div><div><Flame size={15}/><strong>{mutual?Number(p.streak)||0:"—"}</strong><span>day streak</span></div></div></article>})}</div>
      </section> : <>
        <p className="eyebrow">THE WORK YOU'VE PUT IN</p><div className="profile-name-row"><h1 className="tab-title">{accountName.trim() || user.displayName || "Your profile"}</h1><RankStoneEmblem level={levelInfo.level} Icon={[ShieldCheck, Shield, Swords, FlameRank, Mountain, Eye, Compass, Crown, Sun, Gem, InfinityIcon, Landmark][levelInfo.level - 1]} /><div className="profile-social-inline"><button aria-label="View people you follow" onClick={()=>setSocialListView("following")}><strong>{followingRecords.length}</strong><span>Following</span></button><button aria-label="View your followers" onClick={()=>setSocialListView("followers")}><strong>{followerRecords.length}</strong><span>Followers</span></button></div></div><p className={user.email?.toLowerCase() === "joshrpenney@hotmail.co.uk" ? "founder-subtitle own-profile-role" : "muted own-profile-role"}>{user.email?.toLowerCase() === "joshrpenney@hotmail.co.uk" ? "Stoic Discipline Founder" : "Stoic Discipline member"}</p><p className="muted">Measure progress by the promises you keep, not by comparison with anyone else.</p>
        
        <div className="profile-stats"><article><Flame size={22}/><strong>{streak}</strong><span>day streak</span></article><article><Target size={22}/><strong>{Number(progression.totalActions||0).toLocaleString()}</strong><span>actions completed</span></article><article><Trophy size={22}/><strong>{achievements.filter(a=>a.unlocked).length}/{achievements.length}</strong><span>achievements</span></article></div><button type="button" className="level-card rank-open-card" onClick={()=>{setShowRanksPage(true);window.scrollTo({top:0,behavior:"smooth"});}} aria-label="Open all ranks and achievements"><div className="rank-open-card-copy"><p className="eyebrow">CURRENT RANK</p><h2>Level {levelInfo.level} · {levelInfo.name}</h2><p>{levelInfo.xp.toLocaleString()} total XP</p></div><div className="rank-open-card-action"><span>View all ranks & badges</span><ChevronRight size={20}/></div></button>
        <section className="consistency-card profile-collapsible"><button type="button" className="profile-collapse-toggle" aria-expanded={showProfileCalendar} onClick={()=>setShowProfileCalendar(v=>!v)}><span><p className="eyebrow">SHOWING UP</p><strong>Consistency calendar</strong><small>{consistencyDays.monthLabel}</small></span><ChevronDown className={showProfileCalendar?"is-open":""} size={21}/></button>{showProfileCalendar && <div className="profile-collapse-content"><p className="muted">Your current month at a glance. Gold means every scheduled commitment was completed; darker squares are incomplete. The outlined square marks today.</p><div className="consistency-weekdays">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><span key={day}>{day}</span>)}</div><div className="consistency-grid">{consistencyDays.days.map(day=>day.blank?<div className="consistency-day blank" key={day.key} aria-hidden="true"/>:<div key={day.key} title={`${day.key}${day.isToday?" · Today":""}${day.future?" · Upcoming":day.isComplete?" · Complete":" · Incomplete"}`} className={`consistency-day ${day.isComplete?"full":"incomplete"} ${day.isToday?"today":""} ${day.future?"future":""}`} aria-label={`${day.key}${day.isToday?", today":""}: ${day.future?"upcoming":day.isComplete?"complete":"incomplete"}`}><span>{day.number}</span></div>)}</div><div className="consistency-legend"><span><i className="incomplete"/> Incomplete</span><span><i className="full"/> Complete</span><span><i className="today-key"/> Today</span></div></div>}</section>
    <section className="achievements-section profile-collapsible"><button type="button" className="profile-collapse-toggle" aria-expanded={showProfileAchievements} onClick={()=>setShowProfileAchievements(v=>!v)}><span><p className="eyebrow">PROOF OF PRACTICE</p><strong>Achievements</strong><small>{achievements.filter(a=>a.unlocked).length} unlocked</small></span><ChevronDown className={showProfileAchievements?"is-open":""} size={21}/></button>{showProfileAchievements && <div className="profile-collapse-content"><div className="achievement-grid">{achievements.map((a,index)=>{const Icon=a.icon;const pct=Math.round((a.progress/a.goal)*100);return <article className={"achievement "+(a.unlocked?"unlocked":"locked")+" achievement-group-"+a.group.toLowerCase()} key={a.title} style={{"--achievement-index":index}}><div className="achievement-icon" aria-hidden="true"><span className="achievement-medal-ring"/><Icon size={20}/><span className="achievement-medal-number">{String(index+1).padStart(2,"0")}</span></div><div className="achievement-copy"><strong>{a.title}</strong><span>{a.detail}</span><div className="achievement-progress-track" role="progressbar" aria-label={a.title+" progress"} aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={a.progress}><span style={{width:pct+"%"}}/></div><small className="achievement-progress-label">{a.progress.toLocaleString()} / {a.goal.toLocaleString()} {a.unlocked?"· Earned":"· "+pct+"%"}</small></div><div className="achievement-status">{a.unlocked?<Check size={16}/>:<span>LOCKED</span>}</div></article>})}</div></div>}</section>
        
      </>)}
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
          {communityResults.length>0 && <div className="community-list">{communityResults.map(profile=><article className="community-person" key={profile.uid}><button type="button" className="community-profile-trigger" aria-label={"View "+(profile.displayName||"member")+" profile"} onClick={()=>openMemberProfile(profile)}><div className="community-avatar">{(profile.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="community-person-copy"><strong>{profile.displayName||"Stoic member"}</strong><span>View profile</span></div></button><button className={followingRecords.some(r=>r.followedUid===profile.uid)?"secondary community-follow-button":"primary community-follow-button"} onClick={()=>toggleFollow(profile)}>{followingRecords.some(r=>r.followedUid===profile.uid)?<><UserCheck size={15}/> Following</>:<><UserPlus size={15}/> Follow</>}</button></article>)}</div>}
        </section>
        <section className="community-section"><div className="community-section-heading"><div><p className="eyebrow">YOUR ACCOUNTABILITY CIRCLE</p><h2>Following <span>{followingRecords.length}</span></h2></div><button className="quiet-icon-button" title="Refresh community" onClick={refreshCommunity}><RefreshCw size={16}/></button></div>
          {followingRecords.length===0 ? <div className="empty community-empty"><Users size={28}/><h3>Your circle starts here</h3><p>Search for a friend above and follow them. Their shared progress will appear here.</p></div> : <div className="community-list">{followingRecords.map(row=>{const p=row.progress||{};const due=Number(p.todayDue)||0;const completed=Number(p.todayCompleted)||0;return <article className="community-progress-card" key={row.followedUid}><div className="community-person"><button type="button" className="community-profile-trigger" aria-label={"View "+(row.profile?.displayName||"member")+" profile"} onClick={()=>setSelectedMemberProfile({...row.profile,uid:row.followedUid})}><div className="community-avatar">{(row.profile?.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="community-person-copy"><strong>{row.profile?.displayName||"Stoic member"}</strong><span>View profile · Level {p.level||1}</span></div></button><button className="quiet-icon-button danger" title={"Unfollow "+(row.profile?.displayName||"member")} onClick={()=>toggleFollow({...row.profile,uid:row.followedUid})}><UserCheck size={16}/></button></div>{row.progress ? <><div className="community-metrics"><div><Trophy size={15}/><strong>{Number(p.totalXp)||0}</strong><span>XP</span></div><div><Target size={15}/><strong>{Number(p.totalActions)||0}</strong><span>actions</span></div><div><Flame size={15}/><strong>{Number(p.streak)||0}</strong><span>day streak</span></div></div><div className="community-daily"><div className="community-daily-label"><span>Today's commitments</span><strong>{completed}/{due}</strong></div><div className="community-daily-track"><span style={{width:(due?Math.min(100,Math.round(completed/due*100)):0)+"%"}}/></div><small>{due===0?"No commitments due today":completed===due?"All due commitments completed":Math.round(completed/due*100)+"% complete so far"}</small></div></> : <p className="community-hint">Follow each other to unlock shared progress. They need to follow you back too.</p>}</article>})}</div>}
        </section>
        <section className="community-section"><div className="community-section-heading"><div><p className="eyebrow">THEY'RE IN YOUR CORNER</p><h2>Following you <span>{followerRecords.length}</span></h2></div><button className="quiet-icon-button" title="Refresh community" onClick={refreshCommunity}><RefreshCw size={16}/></button></div>
          {followerRecords.length===0 ? <div className="empty community-empty"><UserPlus size={28}/><h3>Your first follower</h3><p>When someone follows your account, they'll appear here. Your progress is only visible to people you follow back.</p></div> : <div className="community-list">{followerRecords.map(row=>{const mutual=followingRecords.some(r=>r.followedUid===row.followerUid);return <article className="community-person community-follower" key={row.followerUid}><button type="button" className="community-profile-trigger" aria-label={"View "+(row.profile?.displayName||"member")+" profile"} onClick={()=>setSelectedMemberProfile({...row.profile,uid:row.followerUid})}><div className="community-avatar">{(row.profile?.displayName||"S").trim().charAt(0).toUpperCase()}</div><div className="community-person-copy"><strong>{row.profile?.displayName||"Stoic member"}</strong><span>{mutual?"You're following each other":"Follows you · view profile"}</span></div></button>{!mutual&&<button className="primary community-follow-button" onClick={()=>toggleFollow({...row.profile,uid:row.followerUid})}><UserPlus size={15}/> Follow back</button>}</article>})}</div>}
        </section>
      </>}
      {activeTab === "Settings" && <>
        <button className="settings-back" onClick={()=>{if(settingsSection!=="menu"){setSettingsSection("menu");}else{setActiveTab("Profile");}setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><ArrowLeft size={16}/> {settingsSection!=="menu"?"All settings":"Back to profile"}</button>
        <p className="eyebrow">PERSONALISE YOUR PRACTICE</p><h1 className="tab-title">Settings</h1>
        <p className="muted">Choose a settings area below to personalise your journal.</p>
        {settingsSection === "menu" && <div className="settings-menu-grid">
          <button className="settings-menu-card" onClick={()=>setSettingsSection("appearance")}><span className="settings-menu-icon">◐</span><strong>Background colour</strong><span>Choose light or dark theme</span></button>
          <button className="settings-menu-card" onClick={()=>setSettingsSection("account")}><span className="settings-menu-icon">♙</span><strong>Account holder name</strong><span>Change the name shown on your profile</span></button>
          <button className="settings-menu-card" onClick={()=>setSettingsSection("privacy")}><span className="settings-menu-icon">♧</span><strong>Privacy & sharing</strong><span>Control whether mutual friends can see your progress</span></button>
          <button className="settings-menu-card" onClick={()=>{setSettingsSection("commitments");setShowAdd(false);setEditingHabitId(null);}}><span className="settings-menu-icon">⬡</span><strong>Manage commitments</strong><span>Edit your non-negotiables and scheduled habits</span></button>

        </div>}
        {settingsSection === "appearance" && <div className="settings-panel"><p className="eyebrow">DISPLAY</p><h2>Background colour</h2><p className="settings-description">Choose a theme for the journal. Your choice is saved on this device.</p><div className="theme-options"><button className={"theme-option "+(theme==="dark"?"selected":"")} onClick={()=>setTheme("dark")}><span className="theme-preview theme-preview-dark"/><strong>Dark theme</strong><span>Charcoal, bronze and gold</span></button><button className={"theme-option "+(theme==="light"?"selected":"")} onClick={()=>setTheme("light")}><span className="theme-preview theme-preview-light"/><strong>Light theme</strong><span>Warm ivory and muted gold</span></button></div></div>}
        {settingsSection === "account" && <div className="settings-panel"><p className="eyebrow">ACCOUNT</p><h2>Profile name</h2><p className="settings-description">This name appears as the heading on your Profile page and in your welcome message.</p><form className="settings-edit-form" onSubmit={saveAccountName}><label>Account holder name<input required maxLength="60" value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Enter your name"/></label><div className="form-actions"><button className="primary" disabled={busy}>{busy?"Saving…":"Save name"}</button></div></form></div>}
        {settingsSection === "privacy" && <div className="settings-panel"><p className="eyebrow">YOUR DATA, YOUR CHOICE</p><h2>Privacy & sharing</h2><p className="settings-description">Your habits, journal entries and book records remain private. This setting controls whether people you follow who also follow you back can see your shared progress summary.</p><div className="privacy-setting-row"><div><strong>Share my progress with mutual friends</strong><p className="settings-description">When off, your progress summary is hidden from friends. Your account name can still appear in member search so people can find you.</p></div><label className="privacy-switch"><input type="checkbox" checked={shareProgress} disabled={privacyBusy} onChange={async e=>{const next=e.target.checked;setShareProgress(next);setPrivacyBusy(true);setError("");setNotice("");try{await setDoc(doc(db,"users",user.uid,"settings","privacy"),{shareProgress:next,updatedAt:serverTimestamp()},{merge:true});await setDoc(doc(db,"userProgress",user.uid),{uid:user.uid,shareProgress:next,updatedAt:serverTimestamp()},{merge:true});setNotice(next?"Progress sharing enabled for mutual friends.":"Progress sharing turned off.");}catch(err){setShareProgress(!next);setError("Could not save privacy settings: "+err.message);}finally{setPrivacyBusy(false);}}}/><span/></label></div><div className="privacy-setting-row"><div><strong>Share reading activity</strong><p className="settings-description">When enabled, mutual friends can see the books you are currently reading, when you started each one, and your completed books in your profile Library. They can also receive notifications when you start or finish a book. Only book details and reading progress are shared — not your private journal or habits.</p></div><label className="privacy-switch"><input type="checkbox" checked={shareReadingActivity} disabled={privacyBusy} onChange={async e=>{const next=e.target.checked;setShareReadingActivity(next);setPrivacyBusy(true);setError("");setNotice("");try{await setDoc(doc(db,"users",user.uid,"settings","privacy"),{shareReadingActivity:next,updatedAt:serverTimestamp()},{merge:true});setNotice(next?"Reading activity sharing enabled.":"Reading activity sharing turned off.");}catch(err){setShareReadingActivity(!next);setError("Could not save reading privacy settings: "+err.message);}finally{setPrivacyBusy(false);}}}/><span/></label></div><p className="settings-description">You can change this at any time. Existing accounts keep their current data and login details.</p></div>}
        {settingsSection === "commitments" && <>
          <p className="eyebrow">YOUR DAILY STANDARD</p><h2 className="tab-title">Manage commitments</h2><p className="muted">Keep your five daily non-negotiables separate from up to five additional scheduled commitments.</p>
          {showAdd && <form className="add-form settings-add-form" onSubmit={addHabit}>
            <div className="commitment-form-type"><p className="eyebrow">ADDING {newNonNegotiable?"A NON-NEGOTIABLE":"A SCHEDULED COMMITMENT"}</p><strong>{newNonNegotiable?"Daily standard":"Flexible commitment"}</strong><small>{newNonNegotiable?"Due every day and counts towards your streak.":"Choose which days this commitment appears."}</small></div>
            <label>Commitment<input required maxLength="100" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Read 10 pages"/></label>
            <div className="form-row"><label>Category<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target (optional)<input value={newTarget} onChange={e=>setNewTarget(e.target.value)} placeholder="e.g. 10 pages"/></label></div>
            {!newNonNegotiable && <div className="schedule-picker"><span>Scheduled days</span><div className="schedule-days">{WEEKDAYS.map(day => <button type="button" key={day.value} className={"schedule-day "+(newSchedule.includes(day.value)?"selected":"")} onClick={()=>setNewSchedule(prev=>prev.includes(day.value)?prev.filter(d=>d!==day.value):[...prev,day.value].sort((a,b)=>a-b))}>{day.label}</button>)}</div><small>This commitment appears only on selected days.</small></div>}
            <div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary">Save {newNonNegotiable?"non-negotiable":"commitment"}</button></div>
          </form>}
          <section className="commitment-group-panel nonneg-group-panel">
            <div className="commitment-group-header"><div><p className="eyebrow">REQUIRED DAILY · COUNTS TOWARDS YOUR STREAK</p><h3>Non-negotiables <span>{nonNegotiableHabits.length}/5</span></h3><p>Exactly five standards. Edit a standard to change its details.</p></div><button className="quiet-account-button" disabled={nonNegotiableHabits.length>=MAX_NON_NEGOTIABLES} onClick={()=>{setNewTitle("");setNewTarget("");setNewCategory("Mindset");setNewNonNegotiable(true);setNewSchedule([0,1,2,3,4,5,6]);setShowAdd(true);setEditingHabitId(null);}}><Plus size={14}/> Add</button></div>
            {nonNegotiableHabits.length<MAX_NON_NEGOTIABLES&&<p className="commitment-capacity-note">Add {MAX_NON_NEGOTIABLES-nonNegotiableHabits.length} more {MAX_NON_NEGOTIABLES-nonNegotiableHabits.length===1?"standard":"standards"} to complete your five.</p>}
            <div className="settings-habit-list">{nonNegotiableHabits.map(h=>{const Icon=categoryIcon(h.category);return <article className="settings-habit" key={h.id}>
              {editingHabitId===h.id ? <form className="settings-edit-form" onSubmit={saveHabitEdit}>
                <label>Commitment name<input required maxLength="100" value={editingTitle} onChange={e=>setEditingTitle(e.target.value)}/></label>
                <div className="form-row"><label>Category<select value={editingCategory} onChange={e=>setEditingCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target<input value={editingTarget} onChange={e=>setEditingTarget(e.target.value)} placeholder="Optional target"/></label></div>
                <p className="settings-description">This is one of your five daily non-negotiables. It is due every day.</p>
                <div className="form-actions"><button type="button" className="secondary" onClick={()=>setEditingHabitId(null)}>Cancel</button><button className="primary">Save changes</button></div>
              </form> : <div className="settings-habit-main"><div className="habit-icon"><Icon size={18}/></div><div className="settings-habit-copy"><strong>{h.title}</strong><span>{h.target||h.category}</span><small>NON-NEGOTIABLE</small></div><button className="quiet-icon-button" aria-label={"Edit "+h.title} onClick={()=>beginEditHabit(h)}><Pencil size={15}/></button></div>}
            </article>})}</div>
            {nonNegotiableHabits.length===0&&<p className="empty">Add five non-negotiables to complete your daily standard.</p>}
          </section>
          <section className="commitment-group-panel flexible-group-panel">
            <div className="commitment-group-header"><div><p className="eyebrow">OPTIONAL · CHOOSE YOUR DAYS</p><h3>Scheduled commitments <span>{flexibleHabits.length}/5</span></h3><p>Additional habits that appear only on selected days.</p></div><button className="quiet-account-button" disabled={flexibleHabits.length>=MAX_FLEXIBLE_COMMITMENTS} onClick={()=>{setNewTitle("");setNewTarget("");setNewCategory("Mindset");setNewNonNegotiable(false);setNewSchedule([0,1,2,3,4,5,6]);setShowAdd(true);setEditingHabitId(null);}}><Plus size={14}/> Add</button></div>
            <div className="settings-habit-list">{flexibleHabits.map(h=>{const Icon=categoryIcon(h.category);return <article className="settings-habit" key={h.id}>
              {editingHabitId===h.id ? <form className="settings-edit-form" onSubmit={saveHabitEdit}>
                <label>Commitment name<input required maxLength="100" value={editingTitle} onChange={e=>setEditingTitle(e.target.value)}/></label>
                <div className="form-row"><label>Category<select value={editingCategory} onChange={e=>setEditingCategory(e.target.value)}>{["Mindset","Morning","Evening","Training","Running","Walking","Reading","Health","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Target<input value={editingTarget} onChange={e=>setEditingTarget(e.target.value)} placeholder="Optional target"/></label></div>
                <div className="schedule-picker"><span>Scheduled days</span><div className="schedule-days">{WEEKDAYS.map(day => <button type="button" key={day.value} className={"schedule-day "+(editingSchedule.includes(day.value)?"selected":"")} onClick={()=>setEditingSchedule(prev=>prev.includes(day.value)?prev.filter(d=>d!==day.value):[...prev,day.value].sort((a,b)=>a-b))}>{day.label}</button>)}</div><small>This commitment appears only on selected days.</small></div>
                <div className="form-actions"><button type="button" className="secondary" onClick={()=>setEditingHabitId(null)}>Cancel</button><button className="primary">Save changes</button></div>
              </form> : <div className="settings-habit-main"><div className="habit-icon"><Icon size={18}/></div><div className="settings-habit-copy"><strong>{h.title}</strong><span>{h.target||h.category}</span><small>SCHEDULED COMMITMENT</small></div><button className="quiet-icon-button" aria-label={"Edit "+h.title} onClick={()=>beginEditHabit(h)}><Pencil size={15}/></button><button className="quiet-icon-button danger" aria-label={"Remove "+h.title} onClick={()=>removeHabit(h)}><Trash2 size={15}/></button></div>}
            </article>})}</div>
            {flexibleHabits.length===0&&<p className="empty">No scheduled commitments yet. Add up to five optional habits.</p>}
          </section>
          <p className="settings-note">Changes apply to your daily checklist and Non-negotiables page. Past completion records and earned XP are retained when you archive a commitment.</p>
        </>}
        {settingsSection === "menu" && <div className="settings-panel reading-pace-panel"><p className="eyebrow">READING PREFERENCES</p><h2>Reading pace</h2><p className="settings-description">Set your personal reading speed. The app uses it to estimate how long books will take.</p><div className="settings-reading-pace"><label htmlFor="personal-reading-wpm">Words per minute</label><input id="personal-reading-wpm" type="number" min="20" max="2000" value={readingWpm} onChange={e=>setReadingWpm(Math.max(20,Math.min(2000,Number(e.target.value)||20)))}/><small>Current estimate: {wordsPerPage} words per page.</small></div></div>}

      </>}
    </section>}
    <nav className="bottom-nav">{[["Reading",BookOpen],["Non-negotiables",ShieldCheck],["Today",Target],["Profile",Star]].map(([label,Icon]) => <button type="button" key={label} className={`nav-item ${activeTab===label?"active":""}`} onClick={() => {if(label===activeTab){if(label==="Profile"){if(showRanksPage||socialListView||showMemberLibrary){setShowRanksPage(false);setSocialListView("");setShowMemberLibrary(false);}else{setShowProfileCalendar(false);setShowProfileAchievements(false);}}else if(label==="Reading"){setBookSearchOpen(false);setBookSearchResults([]);}else if(label==="Non-negotiables"||label==="Today"){setShowAdd(false);setEditingHabitId(null);}}else{tabHistoryRef.current.push(activeTab);window.history.pushState({stoicDiscipline:true,tab:label},"");setActiveTab(label);if(label!=="Profile"){setShowRanksPage(false);setSocialListView("");setShowMemberLibrary(false);}}setError("");setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}><span className="nav-icon-wrap"><Icon size={21}/></span><span>{label==="Non-negotiables"?"Non-neg.":label}</span></button>)}</nav>
    <p className="footnote">XP is awarded once per commitment each day. Unticking a commitment does not remove earned XP. Your progress is saved to your private Firebase account.</p>
  </main>;
}
