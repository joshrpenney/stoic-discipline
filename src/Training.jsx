import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { Activity, ArrowRight, Dumbbell, Footprints, Plus, Save, Target, Trophy, X } from "lucide-react";

const STRENGTH_GOALS = ["Bench press","Squat","Deadlift","Overhead press","Pull-ups","Custom strength exercise"];
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
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [category,setCategory]=useState("Strength");
  const [showAdd,setShowAdd]=useState(false);
  const [editing,setEditing]=useState(null);
  const [goalName,setGoalName]=useState("");
  const [customName,setCustomName]=useState("");
  const [current,setCurrent]=useState("");
  const [target,setTarget]=useState("");
  const [targetDate,setTargetDate]=useState("");
  const ref=doc(db,"users",user.uid,"training","data");

  useEffect(()=>onSnapshot(ref,snap=>{
    const data=snap.exists()?snap.data():{};
    setGoals(Array.isArray(data.performanceGoals)?data.performanceGoals:[]);
    setLoading(false);
  },e=>{setError("Your performance goals could not be loaded: "+e.message);setLoading(false);}),[user.uid]);

  const saveGoals=async(next)=>{
    setSaving(true);setError("");setNotice("");
    try{await setDoc(ref,{performanceGoals:next,updatedAt:serverTimestamp()},{merge:true});setGoals(next);setNotice("Performance goals saved.");setShowAdd(false);setEditing(null);}
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
    const goal={id:editing||newId(),category,name,unit:running?"time":"kg",current:running?timeLabel(current):Number(current),target:running?timeLabel(target):Number(target),targetDate,updatedAt:new Date().toISOString()};
    const next=editing?goals.map(g=>g.id===editing?{...g,...goal}:g):[...goals,goal];
    await saveGoals(next);
  };
  const remove=async id=>saveGoals(goals.filter(g=>g.id!==id));
  const groupGoals=group=>goals.filter(g=>g.category===group);
  const renderGoal=goal=><article className="performance-goal-card" key={goal.id}>
    <div className="performance-goal-top"><div><span className="performance-goal-type">{goal.category==="Strength"?"STRENGTH":"RUNNING"}</span><h3>{goal.name}</h3></div><button type="button" className="performance-edit" onClick={()=>beginEdit(goal)}>Update</button></div>
    <div className="performance-values"><div><small>CURRENT</small><strong>{goal.current}{goal.unit==="kg"?"kg":""}</strong></div><ArrowRight size={17}/><div><small>TARGET</small><strong>{goal.target}{goal.unit==="kg"?"kg":""}</strong></div></div>
    {goal.targetDate&&<p className="performance-date">Target date · {new Date(goal.targetDate+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</p>}
  </article>;

  if(loading)return <section className="training-page"><p className="eyebrow">YOUR PERFORMANCE</p><h1 className="tab-title">Loading your goals…</h1></section>;
  return <section className="training-page performance-page">
    <div className="training-heading"><div><p className="eyebrow">YOUR PHYSICAL PROGRESS</p><h1 className="tab-title">Performance</h1><p className="muted">Choose what you want to improve. Keep track of where you are and where you're heading.</p></div></div>
    {error&&<div className="training-message error">{error}</div>}{notice&&<div className="training-message">{notice}</div>}
    <section className="performance-category">
      <div className="performance-category-heading"><span className="performance-category-icon"><Dumbbell size={20}/></span><div><h2>Strength</h2><p>Build towards your next personal best.</p></div><button type="button" aria-label="Add strength goal" onClick={()=>beginAdd("Strength")}><Plus size={18}/></button></div>
      {groupGoals("Strength").map(renderGoal)}
      {!groupGoals("Strength").length&&<p className="performance-empty">No strength goals yet. Add a lift or movement you'd like to improve.</p>}
    </section>
    <section className="performance-category">
      <div className="performance-category-heading"><span className="performance-category-icon"><Footprints size={20}/></span><div><h2>Running</h2><p>Work towards faster times and longer distances.</p></div><button type="button" aria-label="Add running goal" onClick={()=>beginAdd("Running")}><Plus size={18}/></button></div>
      {groupGoals("Running").map(renderGoal)}
      {!groupGoals("Running").length&&<p className="performance-empty">No running goals yet. Add a distance or race time to work towards.</p>}
    </section>
    {goals.length>0&&<p className="performance-footnote"><Trophy size={14}/> Update your current performance whenever you set a new personal best.</p>}
    {showAdd&&<div className="training-modal-backdrop" onClick={()=>setShowAdd(false)}><section className="training-modal performance-modal" onClick={e=>e.stopPropagation()}>
      <div className="training-modal-head"><div><p className="eyebrow">{editing?"UPDATE YOUR PROGRESS":"SET A PERFORMANCE GOAL"}</p><h2>{editing?"Update goal":"New goal"}</h2></div><button type="button" onClick={()=>setShowAdd(false)}><X size={18}/></button></div>
      <label>Focus<select value={category} onChange={e=>{setCategory(e.target.value);setGoalName("");setCustomName("");}}><option>Strength</option><option>Running</option></select></label>
      <label>Goal<select value={goalName} onChange={e=>setGoalName(e.target.value)}><option value="">Choose a goal</option>{(category==="Strength"?STRENGTH_GOALS:RUNNING_GOALS).map(n=><option key={n}>{n}</option>)}</select></label>
      {(goalName==="Custom strength exercise"||goalName==="Custom distance")&&<label>{category==="Strength"?"Exercise name":"Distance / event"}<input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder={category==="Strength"?"e.g. Weighted dip":"e.g.  marathon"}/></label>}
      <div className="performance-form-row"><label>Current {category==="Strength"?"weight":"time"}<input value={current} onChange={e=>setCurrent(e.target.value)} placeholder={category==="Strength"?"e.g. 80":"e.g. 24:30"} inputMode={category==="Strength"?"decimal":"text"}/></label><label>Target {category==="Strength"?"weight":"time"}<input value={target} onChange={e=>setTarget(e.target.value)} placeholder={category==="Strength"?"e.g. 100":"e.g. 19:59"} inputMode={category==="Strength"?"decimal":"text"}/></label></div>
      <p className="performance-input-hint">{category==="Strength"?"Enter weights in kilograms.":"Enter times as minutes:seconds, for example 24:30 or 1:45:00."}</p>
      <label>Target date <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/></label>
      <button type="button" className="training-primary" disabled={saving} onClick={submit}><Save size={16}/>{saving?"Saving…":editing?"Save progress":"Add goal"}</button>
      {editing&&<button type="button" className="performance-delete" disabled={saving} onClick={()=>remove(editing)}>Remove this goal</button>}
    </section></div>}
  </section>;
}
