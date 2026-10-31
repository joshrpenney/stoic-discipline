import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { Activity, ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, Dumbbell, Footprints, Plus, Save, Trash2, Trophy, X } from "lucide-react";

const EXERCISES = [
  {name:"Barbell bench press",group:"Chest",equipment:"Gym",alternatives:["Dumbbell floor press","Weighted push-up"]},
  {name:"Dumbbell bench press",group:"Chest",equipment:"Both",alternatives:["Dumbbell floor press","Weighted push-up"]},
  {name:"Incline dumbbell press",group:"Chest",equipment:"Both",alternatives:["Feet-elevated push-up"]},
  {name:"Push-up",group:"Chest",equipment:"Home",alternatives:["Weighted push-up"]},
  {name:"Weighted push-up",group:"Chest",equipment:"Home",alternatives:["Dumbbell floor press"]},
  {name:"Dumbbell shoulder press",group:"Shoulders",equipment:"Both",alternatives:["Pike push-up"]},
  {name:"Lateral raise",group:"Shoulders",equipment:"Both",alternatives:["Lean-away lateral raise"]},
  {name:"Pull-up",group:"Back",equipment:"Both",alternatives:["Dumbbell row"]},
  {name:"One-arm dumbbell row",group:"Back",equipment:"Both",alternatives:["Chest-supported row"]},
  {name:"Barbell row",group:"Back",equipment:"Gym",alternatives:["One-arm dumbbell row"]},
  {name:"Lat pulldown",group:"Back",equipment:"Gym",alternatives:["Pull-up"]},
  {name:"Dumbbell curl",group:"Arms",equipment:"Both",alternatives:["Hammer curl"]},
  {name:"Hammer curl",group:"Arms",equipment:"Both",alternatives:["Dumbbell curl"]},
  {name:"Triceps extension",group:"Arms",equipment:"Both",alternatives:["Close-grip push-up"]},
  {name:"Goblet squat",group:"Legs",equipment:"Both",alternatives:["Dumbbell split squat"]},
  {name:"Barbell back squat",group:"Legs",equipment:"Gym",alternatives:["Goblet squat"]},
  {name:"Dumbbell Romanian deadlift",group:"Legs",equipment:"Both",alternatives:["Single-leg Romanian deadlift"]},
  {name:"Bulgarian split squat",group:"Legs",equipment:"Both",alternatives:["Reverse lunge"]},
  {name:"Dumbbell reverse lunge",group:"Legs",equipment:"Both",alternatives:["Bulgarian split squat"]},
  {name:"Calf raise",group:"Legs",equipment:"Both",alternatives:["Single-leg calf raise"]},
  {name:"Plank",group:"Core",equipment:"Home",alternatives:["Weighted plank"]},
  {name:"Dead bug",group:"Core",equipment:"Home",alternatives:["Hollow hold"]}
];
const TEMPLATES = [
  {name:"Push / Pull / Legs",type:"strength",days:["Push","Pull","Legs","Push","Pull","Legs"],description:"Six sessions across the week. A classic bodybuilding split."},
  {name:"Upper / Lower",type:"strength",days:["Upper","Lower","Rest","Upper","Lower"],description:"Four sessions with room for recovery and running."},
  {name:"Full Body",type:"strength",days:["Full body","Rest","Full body","Rest","Full body"],description:"Three full-body sessions per week."},
  {name:"Home Dumbbell",type:"strength",days:["Upper","Lower","Rest","Upper","Lower"],description:"Designed around dumbbells, bodyweight and a weighted vest."},
  {name:"Hybrid Base",type:"hybrid",days:["Upper","Easy run","Lower","Intervals","Rest","Full body","Long run"],description:"A balanced starting structure combining strength and running."}
];
const RUN_TYPES=["Easy run","Long run","Intervals","Tempo","Recovery run"];
const dayNames=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const makeId=()=>globalThis.crypto?.randomUUID?.() || String(Date.now())+Math.random().toString(16).slice(2);

export default function Training({user,db}) {
  const [tab,setTab]=useState("Today");
  const [equipment,setEquipment]=useState("Both");
  const [programmes,setProgrammes]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [showBuilder,setShowBuilder]=useState(false);
  const [programmeName,setProgrammeName]=useState("");
  const [programmeType,setProgrammeType]=useState("strength");
  const [programmeDays,setProgrammeDays]=useState(["Upper","Lower","Rest","Upper","Lower","Rest","Rest"]);
  const [selectedExercises,setSelectedExercises]=useState([]);
  const [exerciseSearch,setExerciseSearch]=useState("");
  const [activeProgramme,setActiveProgramme]=useState("");
  const [logSession,setLogSession]=useState(null);
  const [logRows,setLogRows]=useState([]);
  const [runDistance,setRunDistance]=useState("");
  const [runDuration,setRunDuration]=useState("");
  const [runDate,setRunDate]=useState(new Date().toISOString().slice(0,10));
  const [runType,setRunType]=useState("Easy run");
  const [runNotes,setRunNotes]=useState("");
  const [workoutDate,setWorkoutDate]=useState(new Date().toISOString().slice(0,10));
  const [workoutNotes,setWorkoutNotes]=useState("");
  const [restSeconds,setRestSeconds]=useState(90);
  const [restUntil,setRestUntil]=useState(0);
  const [now,setNow]=useState(Date.now());

  const dataRef=doc(db,"users",user.uid,"training","data");
  useEffect(()=>onSnapshot(dataRef,snap=>{
    const data=snap.exists()?snap.data():{};
    setProgrammes(Array.isArray(data.programmes)?data.programmes:[]);
    setSessions(Array.isArray(data.sessions)?data.sessions:[]);
    setActiveProgramme(data.activeProgramme||"");
    setEquipment(data.equipment||"Both");
    setLoading(false);
  },e=>{setError("Training data could not be loaded: "+e.message);setLoading(false);}),[user.uid]);
  useEffect(()=>{if(!restUntil)return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[restUntil]);
  const persist=async(next={})=>{
    setSaving(true);setError("");setNotice("");
    try{await setDoc(dataRef,{programmes,sessions,activeProgramme,equipment,...next,updatedAt:serverTimestamp()},{merge:true});setNotice("Training data saved.");}
    catch(e){setError("Could not save training data: "+e.message);}
    finally{setSaving(false);}
  };
  const currentProgramme=programmes.find(p=>p.id===activeProgramme)||programmes[0]||null;
  const weeklySessions=useMemo(()=>currentProgramme?.days||[],[currentProgramme]);
  const completedWorkouts=sessions.filter(s=>s.kind==="strength");
  const completedRuns=sessions.filter(s=>s.kind==="run");
  const totalKm=completedRuns.reduce((n,s)=>n+(Number(s.distance)||0),0);
  const pace=runDistance&&runDuration?(Number(runDuration)/Number(runDistance)):0;
  const formatPace=value=>value>0?Math.floor(value)+":"+String(Math.round((value%1)*60)).padStart(2,"0"):"—";
  const eligibleExercises=EXERCISES.filter(e=>(equipment==="Both"||e.equipment==="Both"||e.equipment===equipment)&&e.name.toLowerCase().includes(exerciseSearch.toLowerCase()));
  const createTemplate=async template=>{
    const days=Array.from({length:7},(_,i)=>template.days[i]||"Rest");
    const p={id:makeId(),name:template.name,type:template.type,days,exercises:[],createdAt:new Date().toISOString(),template:true};
    const next=[...programmes,p];setProgrammes(next);setActiveProgramme(p.id);await persist({programmes:next,activeProgramme:p.id});setTab("Plan");
  };
  const createProgramme=async()=>{
    if(!programmeName.trim()){setError("Give your programme a name first.");return;}
    const p={id:makeId(),name:programmeName.trim(),type:programmeType,days:programmeDays,exercises:selectedExercises,createdAt:new Date().toISOString(),template:false};
    const next=[...programmes,p];setProgrammes(next);setActiveProgramme(p.id);await persist({programmes:next,activeProgramme:p.id});setShowBuilder(false);setProgrammeName("");setSelectedExercises([]);setTab("Plan");
  };
  const startLog=day=>{
    const plan=currentProgramme?.exercises||[];
    const chosen=plan.length?plan:[{name:"Dumbbell bench press",sets:3,reps:"8–12",equipment:"Both"},{name:"One-arm dumbbell row",sets:3,reps:"8–12",equipment:"Both"}];
    setLogRows(chosen.map(e=>({name:e.name,sets:Array.from({length:Number(e.sets)||3},()=>({weight:"",reps:""}))})));
    setWorkoutNotes("");setWorkoutDate(new Date().toISOString().slice(0,10));setLogSession(day||"Strength workout");
  };
  const saveWorkout=async()=>{
    const session={id:makeId(),kind:"strength",title:logSession,date:workoutDate,notes:workoutNotes,exercises:logRows,createdAt:new Date().toISOString()};
    const next=[session,...sessions];setSessions(next);await persist({sessions:next});setLogSession(null);
  };
  const saveRun=async()=>{
    if(!(Number(runDistance)>0)||!(Number(runDuration)>0)){setError("Enter a distance and duration greater than zero.");return;}
    const session={id:makeId(),kind:"run",title:runType,date:runDate,distance:Number(runDistance),duration:Number(runDuration),pace:pace,notes:runNotes,source:"manual",createdAt:new Date().toISOString()};
    const next=[session,...sessions];setSessions(next);await persist({sessions:next});setRunDistance("");setRunDuration("");setRunNotes("");setNotice("Run saved to your training history.");
  };
  const removeProgramme=async id=>{
    const next=programmes.filter(p=>p.id!==id);const nextActive=activeProgramme===id?(next[0]?.id||""):activeProgramme;
    setProgrammes(next);setActiveProgramme(nextActive);await persist({programmes:next,activeProgramme:nextActive});
  };
  const toggleExercise=name=>setSelectedExercises(rows=>rows.some(x=>x.name===name)?rows.filter(x=>x.name!==name):[...rows,{name,sets:3,reps:"8–12"}]);
  const updateDay=(index,value)=>setProgrammeDays(days=>days.map((d,i)=>i===index?value:d));
  const deleteSession=async id=>{const next=sessions.filter(s=>s.id!==id);setSessions(next);await persist({sessions:next});};
  if(loading)return <section className="training-page"><p className="eyebrow">TRAINING & PERFORMANCE</p><h1 className="tab-title">Preparing your training space</h1></section>;

  return <section className="training-page">
    <div className="training-heading"><div><p className="eyebrow">YOUR TRAINING</p><h1 className="tab-title">Training</h1><p className="muted">Keep your plan simple. Do the work, record it, move forward.</p></div></div>
    <div className="training-tabs">{["Today","Plan","Progress"].map(label=><button type="button" key={label} className={tab===label?"active":""} onClick={()=>{setTab(label);setNotice("");setError("");}}>{label}</button>)}</div>
    {error&&<div className="training-message error">{error}</div>}{notice&&<div className="training-message">{notice}</div>}
    {tab==="Today"&&<>
      
      <div className="training-panel">
        <div className="training-panel-head"><div><p className="eyebrow">YOUR PLAN</p><h2>{currentProgramme?.name||"No programme yet"}</h2><p>{currentProgramme?"This is your current weekly structure.":"Choose a simple plan to get started."}</p></div><Dumbbell size={22}/></div>
        {currentProgramme?<div className="training-week-strip">{dayNames.map((day,i)=><div key={day}><span>{day.slice(0,3)}</span><strong>{currentProgramme.days?.[i]||"Rest"}</strong></div>)}</div>:<div className="training-actions"><button onClick={()=>setTab("Plan")}>Explore templates <ChevronRight size={16}/></button><button className="secondary" onClick={()=>setShowBuilder(true)}>Build a programme</button></div>}
      </div>
      <div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">GET IT DONE</p><h2>Record a session</h2></div></div><div className="training-actions"><button onClick={()=>startLog("Strength workout")}><Dumbbell size={16}/> Log workout</button><button className="secondary" onClick={()=>setTab("Running")}><Footprints size={16}/> Log run</button></div></div>
          </>}
    {tab==="Strength"&&<>
      <div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">STRENGTH TRAINING</p><h2>Choose your equipment</h2><p>Filter the exercise library and see suitable alternatives.</p></div><Dumbbell size={22}/></div><div className="training-segment">{["Both","Gym","Home"].map(v=><button key={v} className={equipment===v?"active":""} onClick={()=>{setEquipment(v);persist({equipment:v});}}>{v}</button>)}</div><input className="training-input" value={exerciseSearch} onChange={e=>setExerciseSearch(e.target.value)} placeholder="Search exercises…"/><div className="training-exercise-list">{eligibleExercises.map(e=><article key={e.name}><div><strong>{e.name}</strong><small>{e.group} · {e.equipment==="Both"?"Gym or home":e.equipment+" equipment"}</small>{e.alternatives?.length>0&&<small>Alternatives: {e.alternatives.join(", ")}</small>}</div><button className={selectedExercises.some(x=>x.name===e.name)?"selected":""} onClick={()=>toggleExercise(e.name)}>{selectedExercises.some(x=>x.name===e.name)?<Check size={17}/>:<Plus size={17}/>}</button></article>)}</div>{selectedExercises.length>0&&<div className="training-selected"><strong>{selectedExercises.length} exercises selected</strong><button onClick={()=>{setProgrammeType("strength");setProgrammeName("My strength programme");setShowBuilder(true);}}>Use in a programme</button></div>}</div>
    </>}
    {tab==="Running"&&<>
      <div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">RUNNING</p><h2>Record a run</h2><p>Manual recording is available now. The activity model is designed to accept synced Garmin and Strava runs later.</p></div><Footprints size={22}/></div><div className="training-form-grid"><label>Session type<select value={runType} onChange={e=>setRunType(e.target.value)}>{RUN_TYPES.map(v=><option key={v}>{v}</option>)}</select></label><label>Date<input type="date" value={runDate} onChange={e=>setRunDate(e.target.value)}/></label><label>Distance (km)<input type="number" min="0.1" step="0.01" value={runDistance} onChange={e=>setRunDistance(e.target.value)} placeholder="e.g. 5"/></label><label>Duration (minutes)<input type="number" min="1" step="0.1" value={runDuration} onChange={e=>setRunDuration(e.target.value)} placeholder="e.g. 25"/></label></div><div className="training-pace-preview"><span>Calculated average pace</span><strong>{formatPace(pace)} <small>min/km</small></strong></div><label className="training-full-label">Notes<textarea value={runNotes} onChange={e=>setRunNotes(e.target.value)} placeholder="How did the run feel? Route, effort, conditions…"/></label><button className="training-primary" onClick={saveRun}><Save size={16}/> Save run</button></div>
      <div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">RUN HISTORY</p><h2>Recorded runs</h2></div><Footprints size={21}/></div>{completedRuns.map(s=><div className="training-history-row" key={s.id}><span className="training-history-icon"><Footprints size={17}/></span><div><strong>{s.title}</strong><small>{s.date} · {s.distance} km · {formatPace(s.pace)}/km</small></div><button onClick={()=>deleteSession(s.id)} aria-label="Delete run"><Trash2 size={15}/></button></div>)}{!completedRuns.length&&<p className="training-empty">No runs recorded yet.</p>}</div>
    </>}
    {tab==="Plan"&&<>
      <div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">PROGRAMME LIBRARY</p><h2>Start with a structure</h2><p>Use a template as it is, or adapt it to your own training.</p></div><CalendarDays size={22}/></div><div className="training-template-grid">{TEMPLATES.map(t=><article key={t.name}><span>{t.type==="hybrid"?"STRENGTH + RUNNING":"STRENGTH"}</span><strong>{t.name}</strong><p>{t.description}</p><button onClick={()=>createTemplate(t)}>Use template <ChevronRight size={15}/></button></article>)}</div><button className="training-outline" onClick={()=>{setProgrammeName("");setProgrammeType("strength");setProgrammeDays(["Upper","Lower","Rest","Upper","Lower","Rest","Rest"]);setSelectedExercises([]);setShowBuilder(true);}}> <Plus size={16}/> Build my own programme</button></div>
      <div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">SAVED PROGRAMMES</p><h2>Your plans</h2></div><Trophy size={21}/></div>{programmes.map(p=><article className="training-programme-row" key={p.id}><div><strong>{p.name}</strong><small>{p.type==="hybrid"?"Hybrid programme":"Strength programme"}{p.id===activeProgramme?" · ACTIVE":""}</small></div><div><button onClick={()=>{setActiveProgramme(p.id);persist({activeProgramme:p.id});}}>Select</button><button onClick={()=>removeProgramme(p.id)} aria-label="Delete programme"><Trash2 size={15}/></button></div></article>)}{!programmes.length&&<p className="training-empty">Your saved programmes will appear here.</p>}</div>
    </>}
    {tab==="Schedule"&&<div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">WEEKLY STRUCTURE</p><h2>{currentProgramme?.name||"Your training week"}</h2><p>Strength and running can live in the same plan. Rest is deliberately scheduled, not treated as failure.</p></div><CalendarDays size={22}/></div>{dayNames.map((day,i)=><div className="training-schedule-row" key={day}><span>{day}</span><strong>{currentProgramme?.days?.[i]||"Rest"}</strong><small>{(currentProgramme?.days?.[i]||"Rest")==="Rest"?"Recovery":"Planned session"}</small></div>)}{!currentProgramme&&<button className="training-primary" onClick={()=>setTab("Plan")}>Choose a programme</button>}</div>}
    {tab==="Progress"&&<><div className="training-stat-grid"><article><span>Strength sessions</span><strong>{completedWorkouts.length}</strong><small>All time</small></article><article><span>Runs</span><strong>{completedRuns.length}</strong><small>All time</small></article><article><span>Distance</span><strong>{totalKm.toFixed(1)} km</strong><small>Total recorded</small></article></div><div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">PERSONAL RECORDS</p><h2>Performance milestones</h2></div><Trophy size={21}/></div><p className="training-empty">Your recorded training, distance and pace at a glance.</p></div><div className="training-panel"><div className="training-panel-head"><div><p className="eyebrow">RECENT SESSIONS</p><h2>Training history</h2></div></div>{sessions.slice(0,12).map(s=><div className="training-history-row" key={s.id}><span className="training-history-icon">{s.kind==="run"?<Footprints size={17}/>:<Dumbbell size={17}/>}</span><div><strong>{s.title}</strong><small>{s.date}{s.kind==="run"?" · "+s.distance+" km · "+formatPace(s.pace)+"/km":" · Strength workout"}</small></div><button onClick={()=>deleteSession(s.id)} aria-label="Delete session"><Trash2 size={15}/></button></div>)}{!sessions.length&&<p className="training-empty">Your sessions will appear here after you record them.</p>}</div></>}
    {showBuilder&&<div className="training-modal-backdrop" onClick={()=>setShowBuilder(false)}><section className="training-modal" onClick={e=>e.stopPropagation()}><div className="training-modal-head"><div><p className="eyebrow">PROGRAMME BUILDER</p><h2>Create your plan</h2></div><button onClick={()=>setShowBuilder(false)}><X size={18}/></button></div><label>Programme name<input value={programmeName} onChange={e=>setProgrammeName(e.target.value)} placeholder="e.g. Hybrid athlete plan"/></label><label>Programme type<select value={programmeType} onChange={e=>setProgrammeType(e.target.value)}><option value="strength">Strength only</option><option value="hybrid">Hybrid · strength and running</option></select></label><p className="eyebrow">WEEKLY PLAN</p>{dayNames.map((day,i)=><label className="training-day-edit" key={day}><span>{day}</span><select value={programmeDays[i]||"Rest"} onChange={e=>updateDay(i,e.target.value)}>{["Rest","Push","Pull","Legs","Upper","Lower","Full body",...RUN_TYPES].map(v=><option key={v}>{v}</option>)}</select></label>)}<p className="eyebrow">EXERCISES ({selectedExercises.length})</p><div className="training-picked-list">{selectedExercises.map(e=><span key={e.name}>{e.name}<button onClick={()=>toggleExercise(e.name)}><X size={13}/></button></span>)}</div><button className="training-primary" disabled={saving} onClick={createProgramme}><Save size={16}/> Save programme</button></section></div>}
    {logSession&&<div className="training-modal-backdrop" onClick={()=>setLogSession(null)}><section className="training-modal training-log-modal" onClick={e=>e.stopPropagation()}><div className="training-modal-head"><div><p className="eyebrow">WORKOUT LOG</p><h2>{logSession}</h2></div><button onClick={()=>setLogSession(null)}><X size={18}/></button></div><label>Date<input type="date" value={workoutDate} onChange={e=>setWorkoutDate(e.target.value)}/></label>{logRows.map((row,i)=><div className="training-log-exercise" key={row.name}><strong>{row.name}</strong>{row.sets.map((set,j)=><div className="training-log-set" key={j}><span>Set {j+1}</span><input aria-label="Weight in kg" type="number" min="0" step="0.5" placeholder="kg" value={set.weight} onChange={e=>setLogRows(rows=>rows.map((r,k)=>k===i?{...r,sets:r.sets.map((v,n)=>n===j?{...v,weight:e.target.value}:v)}:r))}/><input aria-label="Reps" type="number" min="0" placeholder="reps" value={set.reps} onChange={e=>setLogRows(rows=>rows.map((r,k)=>k===i?{...r,sets:r.sets.map((v,n)=>n===j?{...v,reps:e.target.value}:v)}:r))}/></div>)}<button className="training-add-set" onClick={()=>setLogRows(rows=>rows.map((r,k)=>k===i?{...r,sets:[...r.sets,{weight:"",reps:""}]}:r))}><Plus size={14}/> Add set</button></div>)}<label>Session notes<textarea value={workoutNotes} onChange={e=>setWorkoutNotes(e.target.value)} placeholder="How did the session go?"/></label><div className="training-rest-control"><span>Rest timer</span><select value={restSeconds} onChange={e=>setRestSeconds(Number(e.target.value))}><option value={60}>60 seconds</option><option value={90}>90 seconds</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option></select><button onClick={()=>setRestUntil(Date.now()+restSeconds*1000)}>Start</button>{restUntil>now&&<strong>{Math.ceil((restUntil-now)/1000)}s</strong>}</div><button className="training-primary" disabled={saving} onClick={saveWorkout}><Check size={16}/> Finish and save workout</button></section></div>}
    {saving&&<p className="training-saving">Saving your training…</p>}
  </section>;
}
