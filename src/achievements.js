export const ACHIEVEMENT_CATEGORIES = [
  { id: "Discipline", label: "Discipline", description: "The promises you keep, day after day." },
  { id: "Knowledge", label: "Knowledge", description: "A lifelong pursuit of understanding." },
  { id: "Physical Excellence", label: "Physical Excellence", description: "Strength and endurance earned through practice." },
  { id: "Personal Growth", label: "Personal Growth", description: "The deliberate work of becoming better." }
];

export const RARITY = {
  Bronze: { xp: 50 },
  Silver: { xp: 150 },
  Gold: { xp: 350 },
  Platinum: { xp: 750 },
  Mastery: { xp: 1000 },
  Legendary: { xp: 2500 }
};

// Progress is calculated from recorded app activity. Achievement IDs never change;
// Firestore records make an earned achievement permanent even if progress later changes.
export const ACHIEVEMENT_DEFINITIONS = [
  { id:"discipline-first-step", title:"The First Step", detail:"Complete your first commitment.", category:"Discipline", rarity:"Bronze", metric:"actions", goal:1, icon:"Star" },
  { id:"discipline-showing-up", title:"Showing Up", detail:"Complete the full five-standard daily code on 5 days.", category:"Discipline", rarity:"Bronze", metric:"qualifyingDays", goal:5, icon:"CalendarCheck" },
  { id:"discipline-dependable", title:"Dependable", detail:"Complete the full daily code on 30 days.", category:"Discipline", rarity:"Silver", metric:"qualifyingDays", goal:30, icon:"Shield" },
  { id:"discipline-relentless", title:"Relentless", detail:"Complete the full daily code on 100 days.", category:"Discipline", rarity:"Gold", metric:"qualifyingDays", goal:100, icon:"Mountain" },
  { id:"discipline-way-of-life", title:"A Way of Life", detail:"Complete the full daily code on 365 days.", category:"Discipline", rarity:"Platinum", metric:"qualifyingDays", goal:365, icon:"Gem" },
  { id:"discipline-streak-7", title:"Finding Your Feet", detail:"Keep a 7-day non-negotiable streak.", category:"Discipline", rarity:"Bronze", metric:"streak", goal:7, icon:"Footprints" },
  { id:"discipline-streak-30", title:"The Standard", detail:"Keep a 30-day non-negotiable streak.", category:"Discipline", rarity:"Silver", metric:"streak", goal:30, icon:"ShieldCheck" },
  { id:"discipline-streak-100", title:"Iron Will", detail:"Keep a 100-day non-negotiable streak.", category:"Discipline", rarity:"Gold", metric:"streak", goal:100, icon:"Flame" },
  { id:"discipline-streak-365", title:"Unbreakable", detail:"Keep a 365-day non-negotiable streak.", category:"Discipline", rarity:"Platinum", metric:"streak", goal:365, icon:"Crown" },
  { id:"discipline-streak-1000", title:"The Disciplined Few", detail:"Keep a 1,000-day non-negotiable streak.", category:"Discipline", rarity:"Platinum", metric:"streak", goal:1000, icon:"Infinity" },

  { id:"knowledge-first-book", title:"First Chapter", detail:"Add your first book to your library.", category:"Knowledge", rarity:"Bronze", metric:"startedBooks", goal:1, icon:"BookOpen" },
  { id:"knowledge-first-finish", title:"A Student Begins", detail:"Finish your first book.", category:"Knowledge", rarity:"Bronze", metric:"finishedBooks", goal:1, icon:"Bookmark" },
  { id:"knowledge-five-books", title:"Reader's Resolve", detail:"Finish 5 books.", category:"Knowledge", rarity:"Silver", metric:"finishedBooks", goal:5, icon:"BookMarked" },
  { id:"knowledge-ten-books", title:"Well Read", detail:"Finish 10 books.", category:"Knowledge", rarity:"Gold", metric:"finishedBooks", goal:10, icon:"Library" },
  { id:"knowledge-25-books", title:"Library Builder", detail:"Finish 25 books.", category:"Knowledge", rarity:"Gold", metric:"finishedBooks", goal:25, icon:"ScrollText" },
  { id:"knowledge-50-books", title:"Lifelong Student", detail:"Finish 50 books.", category:"Knowledge", rarity:"Platinum", metric:"finishedBooks", goal:50, icon:"GraduationCap" },
  { id:"knowledge-1000-pages", title:"Knowledge Seeker", detail:"Read 1,000 pages.", category:"Knowledge", rarity:"Silver", metric:"pagesRead", goal:1000, icon:"Brain" },
  { id:"knowledge-10000-pages", title:"Scholar", detail:"Read 10,000 pages.", category:"Knowledge", rarity:"Platinum", metric:"pagesRead", goal:10000, icon:"Landmark" },

  { id:"physical-first-session", title:"First Steps", detail:"Complete your first training or movement session.", category:"Physical Excellence", rarity:"Bronze", metric:"trainingDone", goal:1, icon:"Footprints" },
  { id:"physical-25-sessions", title:"Strength Through Effort", detail:"Complete 25 training or movement sessions.", category:"Physical Excellence", rarity:"Silver", metric:"trainingDone", goal:25, icon:"Dumbbell" },
  { id:"physical-100-sessions", title:"Built by Practice", detail:"Complete 100 training or movement sessions.", category:"Physical Excellence", rarity:"Gold", metric:"trainingDone", goal:100, icon:"Medal" },
  { id:"physical-first-record", title:"Getting Stronger", detail:"Record your first personal best.", category:"Physical Excellence", rarity:"Silver", metric:"personalBests", goal:1, icon:"Trophy" },

  { id:"growth-five-standards", title:"Define Your Code", detail:"Establish all five daily non-negotiables.", category:"Personal Growth", rarity:"Bronze", metric:"nonNegotiables", goal:5, icon:"Target" },
  { id:"growth-first-commitment", title:"Goal Setter", detail:"Create your first scheduled personal commitment.", category:"Personal Growth", rarity:"Bronze", metric:"scheduledCommitments", goal:1, icon:"Flag" },
  { id:"growth-five-commitments", title:"Forward Motion", detail:"Build a practice with five scheduled commitments.", category:"Personal Growth", rarity:"Silver", metric:"scheduledCommitments", goal:5, icon:"Compass" },

  { id:"mastery-discipline", title:"Master of Discipline", detail:"Earn every available Discipline achievement.", category:"Discipline", rarity:"Mastery", metric:"mastery:Discipline", goal:1, icon:"Crown", mastery:true },
  { id:"mastery-knowledge", title:"Master of Knowledge", detail:"Earn every available Knowledge achievement.", category:"Knowledge", rarity:"Mastery", metric:"mastery:Knowledge", goal:1, icon:"GraduationCap", mastery:true },
  { id:"mastery-physical", title:"Physical Mastery", detail:"Earn every available Physical Excellence achievement.", category:"Physical Excellence", rarity:"Mastery", metric:"mastery:Physical Excellence", goal:1, icon:"Trophy", mastery:true },
  { id:"mastery-growth", title:"Master of Self", detail:"Earn every available Personal Growth achievement.", category:"Personal Growth", rarity:"Mastery", metric:"mastery:Personal Growth", goal:1, icon:"Crown", mastery:true },
  { id:"mastery-stoic-ideal", title:"The Stoic Ideal", detail:"Earn all four category mastery honours.", category:"Personal Growth", rarity:"Legendary", metric:"mastery:all", goal:1, icon:"Landmark", mastery:true }
];

export const CATEGORY_BASE_ACHIEVEMENTS = Object.fromEntries(
  ACHIEVEMENT_CATEGORIES.map(category => [category.id, ACHIEVEMENT_DEFINITIONS.filter(item => item.category === category.id && !item.mastery)])
);
