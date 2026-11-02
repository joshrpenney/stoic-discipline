import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { ArrowRight, Dumbbell, Footprints, Plus, Save, Target, Trophy, X } from "lucide-react";

const STRENGTH_GOALS = ["Bench press","Squat","Deadlift","Overhead press","Pull-ups","Push-ups","Custom strength exercise"];
const strengthUnit = name => ["Pull-ups","Push-ups"].includes(name) ? "reps" : "kg";
const formatValue = (value,unit) => `${value}${unit==="kg"?"kg":unit==="reps"?" reps":""}`;
const RUNNING_GOALS = ["5K time","10K time","Half-marathon time","Marathon time","Custom distance"];
const newId = () => globalThis.crypto?.randomUUID?.() || String(Date.now());

function seconds(value) {
  const parts=String(value||"").split(":").map(Number);
  if(parts.length===2) return parts[0]*60+parts[1];
  if(parts.length===3) return parts[0]*3600+parts[1]*60+parts[2];
  return Number(value)||0;
}
function timeLabel(value) {
  const n=Math.max(0,Math.round(seconds(value)));
  const h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`;
}

export default function Training({user,db}) {
  const [goals,setGoals]=useState([]);
  const [achievements,setAchievements]=useState([]);
  const [celebration,setCelebration]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [category,setCategory]=useState("Strength");
  const [showAdd,setShowAdd]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [editing,setEditing]=useState(null);
  const [goalName,setGoalName]=useState("");
  const [customName,setCustomName]=useState("");
  const [current,setCurrent]=useState("");
  const [target,setTarget]=useState("");
  const [targetDate,setTargetDate]=useState("");
  const ref=doc(db,"users",user.uid,"training","data");

  useEffect(()=>onSnapshot(ref,snap=>{
    const data=snap.exists()?snap.data():{};
    setGoals(Array.isArray(data.performanceGoals)?data.performanceGoals.map(g=>g.name==="Pull-ups"?{...g,unit:"reps"}:g):[]);
    setAchievements(Array.isArray(data.performanceAchievements)?data.performanceAchievements.map(a=>a.name==="Pull-ups"?{...a,unit:"reps"}:a):[]);
    setLoading(false);
  },e=>{setError("Your performance goals could not be loaded: "+e.message);setLoading(false);}),[user.uid]);

  const saveGoals=async(next,nextAchievements=achievements,newCelebration=null)=>{
    setSaving(true);setError("");setNotice("");
    try{await setDoc(ref,{performanceGoals:next,performanceAchievements:nextAchievements,updatedAt:serverTimestamp()},{merge:true});setGoals(next);setAchievements(nextAchievements);setNotice("Performance goals saved.");setShowAdd(false);setEditing(null);if(newCelebration)setCelebration(newCelebration);}
    catch(e){setError("Could not save your goals: "+e.message);}
    finally{setSaving(false);}
  };
  const beginAdd=(group)=>{
    setCategory(group);setGoalName("");setCustomName("");setCurrent("");setTarget("");setTargetDate("");setEditing(null);setShowAdd(true);setError("");setNotice("");
  };
  const beginEdit=(goal)=>{
    setCategory(goal.category);setGoalName(goal.name);setCustomName(goal.customName||"");setCurrent(String(goal.current??""));setTarget(String(goal.target??""));setTargetDate(goal.targetDate||"");setEditing(goal.id);setShowAdd(true);setError("");setNotice("");
  };
  const submit=async()=>{
    const name=goalName==="Custom strength exercise"||goalName==="Custom distance"?customName.trim():goalName;
    if(!name||!current.trim()||!target.trim()){setError("Enter a goal, your current performance and your target.");return;}
    const running=category==="Running";
    if(running&&(seconds(current)<=0||seconds(target)<=0)){setError("Enter both times in minutes:seconds format, for example 24:30.");return;}
    if(!running&&(!(Number(current)>0)||!(Number(target)>0))){setError("Enter current and target values greater than zero.");return;}
    const previous=editing?goals.find(g=>g.id===editing):null;
    const currentValue=running?timeLabel(current):Number(current);
    const targetValue=running?timeLabel(target):Number(target);
    const improved=previous && (running?seconds(currentValue)<seconds(previous.current):Number(currentValue)>Number(previous.current));
    const unit=running?"time":strengthUnit(name);
    const goal={id:editing||newId(),category,name,unit,current:currentValue,target:targetValue,targetDate,baseline:previous?.baseline??(running?seconds(currentValue):Number(currentValue)),updatedAt:new Date().toISOString()};
    const next=editing?goals.map(g=>g.id===editing?{...g,...goal}:g):[...goals,goal];
    const record=improved?{id:newId(),goalId:goal.id,name,category,value:currentValue,unit:goal.unit,previous:previous.current,improvement:running?seconds(previous.current)-seconds(currentValue):Number(currentValue)-Number(previous.current),date:new Date().toISOString()}:null;
    const baseline=Number(goal.baseline);
    const start=running?baseline:baseline;
    const finish=running?seconds(targetValue):Number(targetValue);
    const now=running?seconds(currentValue):Number(currentValue);
    const total=running?start-finish:finish-start;
    const progress=total>0?(running?start-now:now-start)/total:0;
    const alreadyUnlocked=new Set(achievements.filter(a=>a.milestone&&a.goalId===goal.id).map(a=>a.milestone));
    const milestoneEvents=[25,50,75,100].filter(step=>progress>=step/100&&!alreadyUnlocked.has(step)).map(step=>({
      id:newId(),goalId:goal.id,name,category,value:currentValue,unit:goal.unit,milestone:step,
      title:step===100?"Target achieved":step+"% of target reached",
      detail:step===100?"You reached the standard you set.":"A new milestone on the way to your target.",
      date:new Date().toISOString()
    }));
    const nextAchievements=[...milestoneEvents,...(record?[record]:[]),...achievements];
    await saveGoals(next,nextAchievements,milestoneEvents.length?{...milestoneEvents[milestoneEvents.length-1],type:"milestone"}:record);
  };
  const remove=async id=>saveGoals(goals.filter(g=>g.id!==id));
  const groupGoals=group=>goals.filter(g=>g.category===group);
  const renderGoal=goal=><article className="performance-goal-card" key={goal.id}>
    <div className="performance-goal-top"><div><span className="performance-goal-type">{goal.category==="Strength"?"STRENGTH":"RUNNING"}</span><h3>{goal.name}</h3></div><button type="button" className="performance-edit" onClick={()=>beginEdit(goal)}>Update</button></div>
    <div className="performance-values"><div><small>CURRENT</small><strong>{formatValue(goal.current,goal.unit)}</strong></div><ArrowRight size={17}/><div><small>TARGET</small><strong>{formatValue(goal.target,goal.unit)}</strong></div></div>
    {goal.targetDate&&<p className="performance-date">Target date · {new Date(goal.targetDate+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</p>}
  </article>;

  if(loading)return <section className="training-page"><p className="eyebrow">YOUR PERFORMANCE</p><h1 className="tab-title">Loading your goals…</h1></section>;
  const strengthGoals=groupGoals("Strength"), runningGoals=groupGoals("Running");
  const records=[...goals].slice().sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0));
  const bests=[...strengthGoals,...runningGoals];
  return <section className="training-page performance-page">
    <div className="performance-dashboard-heading">
      <div><p className="eyebrow">YOUR PHYSICAL PROGRESS</p><h1 className="tab-title">Performance</h1><p className="muted">Choose your targets. Track your best. Keep improving.</p></div>
    </div>
    {error&&<div className="training-message error">{error}</div>}{notice&&<div className="training-message">{notice}</div>}
    {showSettings ? <>
      <div className="performance-settings-title"><div><p className="eyebrow">MANAGE YOUR TARGETS</p><h2>Performance settings</h2></div><button type="button" className="performance-back" onClick={()=>setShowSettings(false)}>Back to overview</button></div>
      <section className="performance-category">
        <div className="performance-category-heading"><span className="performance-category-icon"><Dumbbell size={20}/></span><div><h2>Strength</h2><p>Choose the lifts and movements you want to improve.</p></div><button type="button" aria-label="Add strength goal" onClick={()=>beginAdd("Strength")}><Plus size={18}/></button></div>
        {strengthGoals.map(renderGoal)}
        {!strengthGoals.length&&<p className="performance-empty">No strength goals yet. Add a lift or movement you'd like to improve.</p>}
      </section>
      <section className="performance-category">
        <div className="performance-category-heading"><span className="performance-category-icon"><Footprints size={20}/></span><div><h2>Running</h2><p>Choose the distances and times you want to achieve.</p></div><button type="button" aria-label="Add running goal" onClick={()=>beginAdd("Running")}><Plus size={18}/></button></div>
        {runningGoals.map(renderGoal)}
        {!runningGoals.length&&<p className="performance-empty">No running goals yet. Add a distance or race time to work towards.</p>}
      </section>
    </> : <>
            <section className="performance-dashboard-section">
        <div className="performance-section-heading"><div><p className="eyebrow">WHAT YOU ARE WORKING TOWARDS</p><h2>Your current standards</h2></div><button type="button" onClick={()=>setShowSettings(true)}>Manage <ArrowRight size={14}/></button></div>
        {goals.length ? <div className="performance-dashboard-goals">{goals.map(goal=><article key={goal.id} className="performance-mini-goal"><div><span>{goal.category==="Strength"?"STRENGTH":"RUNNING"}</span><strong>{goal.name}</strong></div><div className="performance-mini-values"><div><small>CURRENT</small><b>{formatValue(goal.current,goal.unit)}</b></div><ArrowRight size={14}/><div><small>TARGET</small><b>{formatValue(goal.target,goal.unit)}</b></div></div></article>)}</div> : <p className="performance-empty">No active targets yet. Open Performance settings to choose the strength or running targets you want to pursue.</p>}
      </section>
      <section className="performance-dashboard-section">
        <div className="performance-section-heading"><div><p className="eyebrow">YOUR LATEST STANDARDS</p><h2>Personal bests</h2></div></div>
        {bests.length ? <div className="performance-record-grid">{bests.map(goal=><article key={goal.id}><span>{goal.name}</span><strong>{formatValue(goal.current,goal.unit)}</strong><small>Current best</small></article>)}</div> : <p className="performance-empty">Your personal bests will appear here as you add goals in Performance settings.</p>}
      </section>
      <section className="performance-dashboard-section">
        <div className="performance-section-heading"><div><p className="eyebrow">MILESTONES</p><h2>Recent achievements</h2></div></div>
        {achievements.length ? <div className="performance-achievement-list">{achievements.slice(0,6).map(item=><article key={item.id}><span className="performance-achievement-icon"><Trophy size={16}/></span><div><strong>{item.milestone?item.title:"New "+(item.category==="Strength"?"strength":"running")+" personal best"}</strong><b>{item.name} · {formatValue(item.value,item.unit)}</b><small>{new Date(item.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</small></div></article>)}</div> : <p className="performance-empty">Your milestone achievements and personal bests will appear here as you progress.</p>}
      </section>
      {records.length>0&&<p className="performance-footnote"><Trophy size={14}/> Keep raising your standard, one personal best at a time.</p>}
    </>}
    {celebration&&<div className="training-modal-backdrop performance-celebration-backdrop"><section className="performance-celebration" role="dialog" aria-modal="true">
      <span className="performance-celebration-trophy"><Trophy size={34}/></span><p className="eyebrow">{celebration.type==="milestone"?"MILESTONE UNLOCKED":"NEW PERSONAL RECORD"}</p><h2>{celebration.type==="milestone"?celebration.title:"A new standard."}</h2>
      <strong className="performance-celebration-value">{celebration.type==="milestone"?celebration.milestone+"%":formatValue(celebration.value,celebration.unit)}</strong><h3>{celebration.name}</h3>
      {celebration.type==="milestone"?<p className="performance-input-hint">{celebration.detail}</p>:<div className="performance-celebration-details"><div><small>PREVIOUS BEST</small><b>{formatValue(celebration.previous,celebration.unit)}</b></div><div><small>IMPROVEMENT</small><b>{celebration.unit==="kg"?"+"+celebration.improvement+"kg":celebration.unit==="reps"?"+"+celebration.improvement+" reps":timeLabel(celebration.improvement)}</b></div></div>}
      <button type="button" className="training-primary" onClick={()=>setCelebration(null)}>Continue</button>
    </section></div>}
    {showAdd&&<div className="training-modal-backdrop" onClick={()=>setShowAdd(false)}><section className="training-modal performance-modal" onClick={e=>e.stopPropagation()}>
      <div className="training-modal-head"><div><p className="eyebrow">{editing?"UPDATE YOUR PROGRESS":"SET A PERFORMANCE GOAL"}</p><h2>{editing?"Update goal":"New goal"}</h2></div><button type="button" onClick={()=>setShowAdd(false)}><X size={18}/></button></div>
      <label>Focus<select value={category} onChange={e=>{setCategory(e.target.value);setGoalName("");setCustomName("");}}><option>Strength</option><option>Running</option></select></label>
      <label>Goal<select value={goalName} onChange={e=>setGoalName(e.target.value)}><option value="">Choose a goal</option>{(category==="Strength"?STRENGTH_GOALS:RUNNING_GOALS).map(n=><option key={n}>{n}</option>)}</select></label>
      {(goalName==="Custom strength exercise"||goalName==="Custom distance")&&<label>{category==="Strength"?"Exercise name":"Distance / event"}<input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder={category==="Strength"?"e.g. Weighted dip":"e.g.  marathon"}/></label>}
      <div className="performance-form-row"><label>Current {category==="Strength"?(["Pull-ups","Push-ups"].includes(goalName)?"reps":"weight"):"time"}<input value={current} onChange={e=>setCurrent(e.target.value)} placeholder={category==="Strength"?(["Pull-ups","Push-ups"].includes(goalName)?"e.g. 8":"e.g. 80"):"e.g. 24:30"} inputMode={category==="Strength"?"decimal":"text"}/></label><label>Target {category==="Strength"?(["Pull-ups","Push-ups"].includes(goalName)?"reps":"weight"):"time"}<input value={target} onChange={e=>setTarget(e.target.value)} placeholder={category==="Strength"?(["Pull-ups","Push-ups"].includes(goalName)?"e.g. 15":"e.g. 100"):"e.g. 19:59"} inputMode={category==="Strength"?"decimal":"text"}/></label></div>
      <p className="performance-input-hint">{category==="Strength"?(["Pull-ups","Push-ups"].includes(goalName)?"Enter the number of repetitions.":"Enter weights in kilograms."):"Enter times as minutes:seconds, for example 24:30 or 1:45:00."}</p>
      <label>Target date <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/></label>
      <button type="button" className="training-primary" disabled={saving} onClick={submit}><Save size={16}/>{saving?"Saving…":editing?"Save progress":"Add goal"}</button>
      {editing&&<button type="button" className="performance-delete" disabled={saving} onClick={()=>remove(editing)}>Remove this goal</button>}
    </section></div>}
  </section>;
}
