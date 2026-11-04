import { useEffect, useState } from "react";
import { arrayUnion, collection, doc, limit, onSnapshot, orderBy, query, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ArrowRight, Dumbbell, Footprints, Plus, Save, Target, Trophy, X } from "lucide-react";

const STRENGTH_GOALS = ["Bench press","Squat","Deadlift","Overhead press","Pull-ups","Push-ups","Custom strength exercise"];
const strengthUnit = name => ["Pull-ups","Push-ups"].includes(name) ? "reps" : "kg";
const formatValue = (value,unit) => `${value}${unit==="kg"?"kg":unit==="reps"?" reps":""}`;
const RUNNING_GOALS = ["5K time","10K time","Half-marathon time","Marathon time","Custom distance"];
const STRAVA_API = "https://stoic-strava-api.joshrpenney.workers.dev";
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
  const [strava,setStrava]=useState({loading:true,connected:false,athlete:null});
  const [stravaBusy,setStravaBusy]=useState(false);
  const [importBusy,setImportBusy]=useState(false);
  const [importProgress,setImportProgress]=useState({count:0,page:0});
  const [importSummary,setImportSummary]=useState(null);
  const [runActivities,setRunActivities]=useState([]);
  const [activitiesLoading,setActivitiesLoading]=useState(true);
  const [prSyncBusy,setPrSyncBusy]=useState(false);
  const [prSyncProgress,setPrSyncProgress]=useState({done:0,total:0});
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

  useEffect(()=>{
    let active=true;
    const checkStrava=async()=>{
      try{
        const token=await user.getIdToken();
        const response=await fetch(STRAVA_API+"/strava/status",{headers:{Authorization:"Bearer "+token}});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error||"Could not check Strava connection.");
        if(active)setStrava({loading:false,connected:!!data.connected,athlete:data.athlete||null});
      }catch(e){if(active)setStrava({loading:false,connected:false,athlete:null});}
    };
    checkStrava();
    return()=>{active=false;};
  },[user.uid]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const result=params.get("strava");
    if(!result)return;
    if(result==="connected"){
      setNotice("Strava connected successfully. Your running data is ready to import.");
      setStrava(current=>({...current,connected:true,loading:false}));
    }else if(result==="denied")setError("Strava connection was cancelled. You can try again whenever you are ready.");
    else if(result==="error")setError("Strava could not complete the connection. Please try again.");
    params.delete("strava");
    const query=params.toString();
    window.history.replaceState(window.history.state,"",window.location.pathname+(query?"?"+query:"")+window.location.hash);
  },[]);

  const connectStrava=async()=>{
    setStravaBusy(true);setError("");setNotice("");
    try{
      const token=await user.getIdToken();
      const response=await fetch(STRAVA_API+"/strava/connect",{headers:{Authorization:"Bearer "+token}});
      const data=await response.json();
      if(!response.ok||!data.url)throw new Error(data.error||"Could not start Strava connection.");
      window.location.assign(data.url);
    }catch(e){setError(e.message||"Could not connect to Strava.");setStravaBusy(false);}
  };
  const importStravaHistory=async()=>{
    if(!strava.connected||importBusy)return;
    setImportBusy(true);setError("");setNotice("");setImportProgress({count:0,page:0});
    try{
      const token=await user.getIdToken();
      const after=Math.floor(Date.now()/1000)-4*365.25*24*60*60;
      let page=1,total=0,hasMore=true;
      while(hasMore){
        const response=await fetch(STRAVA_API+"/strava/activities?after="+after+"&page="+page,{headers:{Authorization:"Bearer "+token}});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Strava could not return your running history.");
        const activities=Array.isArray(data.activities)?data.activities:[];
        if(activities.length){
          const batch=writeBatch(db);
          activities.forEach(activity=>{
            const activityRef=doc(db,"users",user.uid,"trainingActivities",String(activity.id));
            batch.set(activityRef,{...activity,source:"strava",importedAt:serverTimestamp()},{merge:true});
          });
          await batch.commit();
          total+=activities.length;
        }
        setImportProgress({count:total,page});
        hasMore=!!data.hasMore;
        page+=1;
        if(page>100)throw new Error("Import paused after 100 pages. Please contact support before trying again.");
      }
      await setDoc(doc(db,"users",user.uid,"training","stravaSync"),{lastImportedAt:serverTimestamp(),fourYearImportAfter:after,activityCount:total,source:"strava"},{merge:true});
      setImportSummary({count:total,completedAt:new Date().toISOString()});
      setNotice("Running history imported. "+total+" activities added or updated.");
    }catch(e){setError("Running history import stopped: "+(e.message||"Unknown error")+". You can safely try again; activities are matched by Strava ID.");}
    finally{setImportBusy(false);}
  };
  useEffect(()=>onSnapshot(ref,snap=>{
    const data=snap.exists()?snap.data():{};
    setGoals(Array.isArray(data.performanceGoals)?data.performanceGoals.map(g=>g.name==="Pull-ups"?{...g,unit:"reps"}:g):[]);
    setAchievements(Array.isArray(data.performanceAchievements)?data.performanceAchievements.map(a=>a.name==="Pull-ups"?{...a,unit:"reps"}:a):[]);
    setLoading(false);
  },e=>{setError("Your performance goals could not be loaded: "+e.message);setLoading(false);}),[user.uid]);

  useEffect(()=>{
    const activitiesRef=collection(db,"users",user.uid,"trainingActivities");
    const activitiesQuery=query(activitiesRef,orderBy("startDate","desc"),limit(500));
    return onSnapshot(activitiesQuery,snap=>{
      setRunActivities(snap.docs.map(item=>({id:item.id,...item.data()})));
      setActivitiesLoading(false);
    },e=>{setActivitiesLoading(false);setError("Your imported running history could not be loaded: "+e.message);});
  },[db,user.uid]);

  const syncStravaBestEfforts=async()=>{
    if(prSyncBusy||!strava.connected||!runActivities.length)return;
    setPrSyncBusy(true);setError("");setNotice("");
    setPrSyncProgress({done:0,total:runActivities.length});
    try{
      const token=await user.getIdToken();
      let completed=0;
      for(const activity of runActivities){
        if(activity.bestEffortsLoaded){completed++;setPrSyncProgress({done:completed,total:runActivities.length});continue;}
        const response=await fetch(STRAVA_API+"/strava/activities/"+encodeURIComponent(activity.id),{headers:{Authorization:"Bearer "+token}});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Strava could not return detailed activity records.");
        await setDoc(doc(db,"users",user.uid,"trainingActivities",String(activity.id)),{
          bestEfforts:Array.isArray(data.bestEfforts)?data.bestEfforts:[],
          bestEffortsLoaded:true,
          detailedElevationGain:Number(data.totalElevationGain)||Number(activity.totalElevationGain)||0
        },{merge:true});
        completed++;
        setPrSyncProgress({done:completed,total:runActivities.length});
      }
      setNotice("Personal-best data refreshed from "+completed+" running activities.");
    }catch(e){setError("Personal-best sync stopped: "+(e.message||"Unknown error")+". You can run it again safely.");}
    finally{setPrSyncBusy(false);}
  };

  const saveGoals=async(next,nextAchievements=achievements,newCelebration=null)=>{
    setSaving(true);setError("");setNotice("");
    try{await setDoc(ref,{performanceGoals:next,performanceAchievements:nextAchievements,achievementFeatures:arrayUnion("Physical Excellence"),updatedAt:serverTimestamp()},{merge:true});setGoals(next);setAchievements(nextAchievements);setNotice("Performance goals saved.");setShowAdd(false);setEditing(null);if(newCelebration)setCelebration(newCelebration);}
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
    const goal={id:editing||newId(),category,name,unit,current:currentValue,target:targetValue,targetDate,updatedAt:new Date().toISOString()};
    const next=editing?goals.map(g=>g.id===editing?{...g,...goal}:g):[...goals,goal];
    const record=improved?{id:newId(),goalId:goal.id,name,category,value:currentValue,unit:goal.unit,previous:previous.current,improvement:running?seconds(previous.current)-seconds(currentValue):Number(currentValue)-Number(previous.current),date:new Date().toISOString()}:null;
    const cleanAchievements=achievements.filter(item=>!item.milestone);
    await saveGoals(next,record?[record,...cleanAchievements]:cleanAchievements,record);
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
            <section className="performance-dashboard-section strava-connection-panel">
        <div className="performance-section-heading"><div><p className="eyebrow">RUNNING DATA</p><h2>Strava connection</h2></div><span className="performance-status">{strava.loading?"Checking…":strava.connected?"Connected":"Not connected"}</span></div>
        <p className="muted">{strava.connected?(strava.athlete?.firstname?"Connected to "+strava.athlete.firstname+(strava.athlete.lastname?" "+strava.athlete.lastname:"")+".":"Your Strava account is connected."):"Connect Strava to bring your running history and personal bests into Stoic Discipline. Strength training will continue to be logged here manually."}</p>
        {!strava.connected&&<button type="button" className="training-primary" disabled={strava.loading||stravaBusy} onClick={connectStrava}>{stravaBusy?"Connecting…":"Connect Strava"}</button>}
        {strava.connected&&<>
          <p className="performance-input-hint">Import your running history from the last four years. Activities are matched by Strava ID, so repeating the import will update existing records rather than create duplicates. Strength workouts are never imported.</p>
          <button type="button" className="training-primary" disabled={importBusy} onClick={importStravaHistory}>{importBusy?"Importing running history…":"Import four years of running history"}</button>
          {importBusy&&<p className="performance-input-hint">Imported {importProgress.count} activities · page {importProgress.page}</p>}
          {importSummary&&!importBusy&&<p className="performance-input-hint">Last import: {importSummary.count} activities.</p>}
        </>}
      </section>
      <section className="performance-dashboard-section">
        <div className="performance-section-heading"><div><p className="eyebrow">YOUR RUNNING RECORD</p><h2>Running overview</h2></div><span className="performance-status">{activitiesLoading?"Loading…":runActivities.length+" runs"}</span></div>
        {activitiesLoading?<p className="performance-empty">Loading your imported runs…</p>:runActivities.length?(()=>{
          const now=new Date();
          const yearStart=new Date(now.getFullYear(),0,1);
          const yearKm=runActivities.filter(a=>new Date(a.startDate)>=yearStart&&new Date(a.startDate)<=now).reduce((sum,a)=>sum+(Number(a.distance)||0),0)/1000;
          const monday=new Date(now);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
          const weekKm=runActivities.filter(a=>new Date(a.startDate)>=monday&&new Date(a.startDate)<=now).reduce((sum,a)=>sum+(Number(a.distance)||0),0)/1000;
          const pace=a=>a.distance>0&&a.movingTime>0?timeLabel(Math.round(a.movingTime/(a.distance/1000)))+"/km":"—";
          const longestRun=runActivities.reduce((best,a)=>Number(a.distance)>Number(best?.distance||0)?a:best,null);
          const fastestRun=runActivities.filter(a=>Number(a.distance)>=3000&&Number(a.movingTime)>0).reduce((best,a)=>!best||Number(a.movingTime)/Number(a.distance)<Number(best.movingTime)/Number(best.distance)?a:best,null);
          const highestClimb=runActivities.reduce((best,a)=>Number(a.totalElevationGain)>Number(best?.totalElevationGain||0)?a:best,null);
          const prNames=[{key:"5k",label:"5K"},{key:"10k",label:"10K"},{key:"half-marathon",label:"Half-marathon"},{key:"marathon",label:"Marathon"}];
          const personalBests=prNames.map(pr=>{
            const candidates=runActivities.flatMap(a=>(Array.isArray(a.bestEfforts)?a.bestEfforts:[]).filter(e=>String(e.name||"").toLowerCase()===pr.key&&Number(e.elapsedTime)>0).map(e=>({...e,activityName:a.name,activityDate:a.startDate})));
            return {...pr,best:candidates.sort((a,b)=>Number(a.elapsedTime)-Number(b.elapsedTime))[0]||null};
          });
          const detailsLoaded=runActivities.filter(a=>a.bestEffortsLoaded).length;
          return <>
            <div className="performance-running-stats">
              <article><small>THIS YEAR</small><strong>{yearKm.toLocaleString("en-GB",{maximumFractionDigits:0})} km</strong><span>{now.getFullYear()} year to date</span></article>
              <article><small>THIS WEEK</small><strong>{weekKm.toFixed(1)} km</strong><span>{runActivities.filter(a=>{const d=new Date(a.startDate);return d>=monday&&d<=now;}).length} runs</span></article>
              <article><small>ACTIVITIES</small><strong>{runActivities.length}</strong><span>Imported from Strava</span></article>
            </div>
            <div className="performance-alltime-summary">
              <div><small>LONGEST RUN</small><strong>{longestRun?(Number(longestRun.distance)/1000).toFixed(2)+" km":"—"}</strong><span>{longestRun?.name||""}</span></div>
              <div><small>FASTEST AVERAGE PACE · RUNS 3KM+</small><strong>{fastestRun?pace(fastestRun):"—"}</strong><span>{fastestRun?.name||""}</span></div>
              <div><small>BIGGEST CLIMB</small><strong>{highestClimb?Math.round(Number(highestClimb.totalElevationGain)||0)+" m":"—"}</strong><span>{highestClimb?.name||""}</span></div>
            </div>
            <div className="performance-alltime-prs">
              <div className="performance-chart-title"><div><strong>All-time personal bests</strong><small>Strava best efforts in your imported history</small></div></div>
              {personalBests.map(pr=><article key={pr.key}><div><strong>{pr.label}</strong><small>{pr.best?new Date(pr.best.startDate||pr.best.activityDate).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"No recorded effort yet"}</small></div><b>{pr.best?timeLabel(pr.best.elapsedTime):"—"}</b></article>)}
              <button type="button" className="training-primary" disabled={prSyncBusy||!strava.connected} onClick={syncStravaBestEfforts}>{prSyncBusy?"Checking detailed Strava records…":detailsLoaded===runActivities.length?"Refresh personal-best data":"Calculate all-time personal bests"}</button>
              {prSyncBusy&&<small className="performance-input-hint">Checking activity {prSyncProgress.done} of {prSyncProgress.total}…</small>}
              <small className="performance-input-hint">Records are based on Strava's official best-effort data. The current import covers the last four years, so older runs are not included yet.</small>
            </div>
            <div className="performance-recent-runs"><div className="performance-chart-title"><strong>Recent runs</strong><small>Latest Strava activities</small></div>
              {runActivities.slice(0,6).map(a=><article key={a.id}><div><strong>{a.name||"Run"}</strong><small>{new Date(a.startDate).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})} · {a.sportType||"Run"}</small></div><div><b>{(Number(a.distance||0)/1000).toFixed(2)} km</b><small>{pace(a)}</small></div></article>)}
            </div>
          </>;
        })():<p className="performance-empty">No running activities found yet. Import your Strava history to see your mileage and recent runs here.</p>}
      </section>
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
        {achievements.filter(item=>!item.milestone).length ? <div className="performance-achievement-list">{achievements.filter(item=>!item.milestone).slice(0,6).map(item=><article key={item.id}><span className="performance-achievement-icon"><Trophy size={16}/></span><div><strong>New {item.category==="Strength"?"strength":"running"} personal best</strong><b>{item.name} · {formatValue(item.value,item.unit)}</b><small>{new Date(item.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</small></div></article>)}</div> : <p className="performance-empty">Your personal bests and lifetime achievements will appear here as you progress.</p>}
      </section>
      {records.length>0&&<p className="performance-footnote"><Trophy size={14}/> Keep raising your standard, one personal best at a time.</p>}
    </>}
    {celebration&&<div className="training-modal-backdrop performance-celebration-backdrop"><section className="performance-celebration" role="dialog" aria-modal="true">
      <span className="performance-celebration-trophy"><Trophy size={34}/></span><p className="eyebrow">NEW PERSONAL RECORD</p><h2>A new standard.</h2>
      <strong className="performance-celebration-value">{formatValue(celebration.value,celebration.unit)}</strong><h3>{celebration.name}</h3>
      <div className="performance-celebration-details"><div><small>PREVIOUS BEST</small><b>{formatValue(celebration.previous,celebration.unit)}</b></div><div><small>IMPROVEMENT</small><b>{celebration.unit==="kg"?"+"+celebration.improvement+"kg":celebration.unit==="reps"?"+"+celebration.improvement+" reps":timeLabel(celebration.improvement)}</b></div></div>
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
