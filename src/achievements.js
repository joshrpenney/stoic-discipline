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

// Achievement IDs are permanent. Earned Firestore records preserve legitimate
// historical awards; long-term honours remain hidden until Unbreakable is earned.
export const ACHIEVEMENT_DEFINITIONS = [
  { id:"discipline-first-step", title:"The First Step", detail:"Complete your first commitment.", category:"Discipline", rarity:"Bronze", metric:"actions", goal:1, icon:"Star" },
  { id:"discipline-showing-up", title:"Showing Up", detail:"Complete all five daily non-negotiables on 5 days.", category:"Discipline", rarity:"Bronze", metric:"qualifyingDays", goal:5, icon:"CalendarCheck" },
  { id:"discipline-dependable", title:"Dependable", detail:"Complete all five daily non-negotiables on 30 days.", category:"Discipline", rarity:"Silver", metric:"qualifyingDays", goal:30, icon:"Shield" },
  { id:"discipline-relentless", title:"Relentless", detail:"Complete all five daily non-negotiables on 100 days.", category:"Discipline", rarity:"Gold", metric:"qualifyingDays", goal:100, icon:"Mountain" },
  { id:"discipline-way-of-life", title:"A Way of Life", detail:"Complete all five daily non-negotiables on 365 days.", category:"Discipline", rarity:"Platinum", metric:"qualifyingDays", goal:365, icon:"Gem" },
  { id:"discipline-streak-7", title:"Finding Your Feet", detail:"Keep a 7-day non-negotiable streak.", category:"Discipline", rarity:"Bronze", metric:"streak", goal:7, icon:"Footprints" },
  { id:"discipline-streak-30", title:"The Standard", detail:"Keep a 30-day non-negotiable streak.", category:"Discipline", rarity:"Silver", metric:"streak", goal:30, icon:"ShieldCheck" },
  { id:"discipline-streak-100", title:"Iron Will", detail:"Keep a 100-day non-negotiable streak.", category:"Discipline", rarity:"Gold", metric:"streak", goal:100, icon:"Flame" },
  { id:"discipline-streak-365", title:"Unbreakable", detail:"Keep a 365-day non-negotiable streak.", category:"Discipline", rarity:"Platinum", metric:"streak", goal:365, icon:"Crown" },
  { id:"discipline-streak-730", title:"The Second Year", detail:"Keep a 730-day non-negotiable streak. Unlocked after earning Unbreakable.", category:"Discipline", rarity:"Platinum", metric:"streak", goal:730, icon:"Sunrise", requires365DayStreak:true },
  { id:"discipline-streak-1000", title:"The Disciplined Few", detail:"Keep a 1,000-day non-negotiable streak. Available after earning Unbreakable.", category:"Discipline", rarity:"Legendary", metric:"streak", goal:1000, icon:"Infinity", requires365DayStreak:true },
  { id:"discipline-streak-1825", title:"A Life of Discipline", detail:"Keep a 1,825-day non-negotiable streak. Unlocked after earning Unbreakable.", category:"Discipline", rarity:"Legendary", metric:"streak", goal:1825, icon:"Landmark", requires365DayStreak:true },
  { id:"discipline-streak-3650", title:"The Stoic Path", detail:"Keep a 3,650-day non-negotiable streak. Unlocked after earning Unbreakable.", category:"Discipline", rarity:"Legendary", metric:"streak", goal:3650, icon:"Gem", requires365DayStreak:true },

  { id:"knowledge-first-book", title:"First Chapter", detail:"Add your first book to your library.", category:"Knowledge", rarity:"Bronze", metric:"startedBooks", goal:1, icon:"BookOpen" },
  { id:"knowledge-first-finish", title:"A Student Begins", detail:"Finish your first book.", category:"Knowledge", rarity:"Bronze", metric:"finishedBooks", goal:1, icon:"Bookmark" },
  { id:"knowledge-five-books", title:"Reader's Resolve", detail:"Finish 5 books.", category:"Knowledge", rarity:"Silver", metric:"finishedBooks", goal:5, icon:"BookMarked" },
  { id:"knowledge-ten-books", title:"Well Read", detail:"Finish 10 books.", category:"Knowledge", rarity:"Gold", metric:"finishedBooks", goal:10, icon:"Library" },
  { id:"knowledge-25-books", title:"Library Builder", detail:"Finish 25 books.", category:"Knowledge", rarity:"Gold", metric:"finishedBooks", goal:25, icon:"ScrollText" },
  { id:"knowledge-50-books", title:"Lifelong Student", detail:"Finish 50 books.", category:"Knowledge", rarity:"Platinum", metric:"finishedBooks", goal:50, icon:"GraduationCap" },
  { id:"knowledge-1000-pages", title:"Knowledge Seeker", detail:"Read 1,000 pages.", category:"Knowledge", rarity:"Silver", metric:"pagesRead", goal:1000, icon:"Brain" },
  { id:"knowledge-10000-pages", title:"Scholar", detail:"Read 10,000 pages.", category:"Knowledge", rarity:"Platinum", metric:"pagesRead", goal:10000, icon:"Landmark" },
  { id:"knowledge-100-books", title:"The Living Library", detail:"Finish 100 books. Available after earning Unbreakable.", category:"Knowledge", rarity:"Legendary", metric:"finishedBooks", goal:100, icon:"Library", requires365DayStreak:true },

  { id:"physical-first-session", title:"First Steps", detail:"Complete your first training or movement session.", category:"Physical Excellence", rarity:"Bronze", metric:"trainingDone", goal:1, icon:"Footprints" },
  { id:"physical-25-sessions", title:"Strength Through Effort", detail:"Complete 25 training or movement sessions.", category:"Physical Excellence", rarity:"Silver", metric:"trainingDone", goal:25, icon:"Dumbbell" },
  { id:"physical-100-sessions", title:"Built by Practice", detail:"Complete 100 training or movement sessions.", category:"Physical Excellence", rarity:"Gold", metric:"trainingDone", goal:100, icon:"Medal" },
  { id:"physical-first-record", title:"Getting Stronger", detail:"Record your first personal best.", category:"Physical Excellence", rarity:"Silver", metric:"personalBests", goal:1, icon:"Trophy" },
  { id:"physical-500-sessions", title:"Forged Over Time", detail:"Complete 500 training or movement sessions. Available after earning Unbreakable.", category:"Physical Excellence", rarity:"Legendary", metric:"trainingDone", goal:500, icon:"Dumbbell", requires365DayStreak:true },

  { id:"growth-architect", title:"The Architect", detail:"Create your first scheduled commitment.", category:"Personal Growth", rarity:"Bronze", metric:"createdScheduledCommitments", goal:1, icon:"Compass" },
  { id:"growth-beyond-intention", title:"Beyond Intention", detail:"Complete 10 daily or scheduled commitments.", category:"Personal Growth", rarity:"Bronze", metric:"growthCompletions", goal:10, icon:"Flag" },
  { id:"growth-priorities", title:"Master of Priorities", detail:"Complete at least one commitment on all seven weekdays.", category:"Personal Growth", rarity:"Silver", metric:"growthWeekdays", goal:7, icon:"CalendarCheck" },
  { id:"growth-excellence", title:"The Pursuit of Excellence", detail:"Complete 50 daily or scheduled commitments.", category:"Personal Growth", rarity:"Silver", metric:"growthCompletions", goal:50, icon:"Medal" },
  { id:"growth-word", title:"A Man of His Word", detail:"Complete 100 daily or scheduled commitments.", category:"Personal Growth", rarity:"Gold", metric:"growthCompletions", goal:100, icon:"Shield" },
  { id:"growth-relentless", title:"Relentless Progress", detail:"Complete 250 daily or scheduled commitments.", category:"Personal Growth", rarity:"Platinum", metric:"growthCompletions", goal:250, icon:"Flame" },
  { id:"growth-intentional", title:"Intentional Living", detail:"Complete commitments in at least four different non-training categories.", category:"Personal Growth", rarity:"Platinum", metric:"growthCategories", goal:4, icon:"Target" },
  { id:"mastery-growth", title:"Master of Self", detail:"Earn every standard Personal Growth achievement.", category:"Personal Growth", rarity:"Mastery", metric:"mastery:Personal Growth", goal:1, icon:"Crown", mastery:true },
  { id:"growth-1000-commitments", title:"A Thousand Acts", detail:"Complete 1,000 daily or scheduled commitments. Available after earning Unbreakable.", category:"Personal Growth", rarity:"Legendary", metric:"growthCompletions", goal:1000, icon:"Gem", requires365DayStreak:true },

  { id:"mastery-discipline", title:"Master of Discipline", detail:"Earn every available standard Discipline achievement.", category:"Discipline", rarity:"Mastery", metric:"mastery:Discipline", goal:1, icon:"Crown", mastery:true },
  { id:"mastery-knowledge", title:"Master of Knowledge", detail:"Earn every available standard Knowledge achievement.", category:"Knowledge", rarity:"Mastery", metric:"mastery:Knowledge", goal:1, icon:"GraduationCap", mastery:true },
  { id:"mastery-physical", title:"Physical Mastery", detail:"Earn every available standard Physical Excellence achievement.", category:"Physical Excellence", rarity:"Mastery", metric:"mastery:Physical Excellence", goal:1, icon:"Trophy", mastery:true },
  { id:"mastery-stoic-ideal", title:"The Stoic Ideal", detail:"Earn all four category mastery honours.", category:"Personal Growth", rarity:"Legendary", metric:"mastery:all", goal:1, icon:"Landmark", mastery:true }
];

export const CATEGORY_BASE_ACHIEVEMENTS = Object.fromEntries(
  ACHIEVEMENT_CATEGORIES.map(category => [category.id, ACHIEVEMENT_DEFINITIONS.filter(item => item.category === category.id && !item.mastery && !item.requires365DayStreak)])
);
