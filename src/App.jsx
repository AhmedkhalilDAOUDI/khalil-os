import { useState, useEffect } from "react";

const ANTHROPIC_API = "https://khalil-os-production.up.railway.app/api/messages";

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT_TARGETS = { kcal: 2100, protein: 180, carbs: 200, fat: 60 };
const DEFAULT_STATS   = { currentWeight: 85, goalWeight: 78, height: 175 };
const STAPLES = ["white rice", "white bread", "fekkas", "eggs", "horse ground meat", "peanuts", "olive oil", "black coffee"];
const ANTI_BLOAT_NOTES = "Avoid high-FODMAP foods, excess sodium, carbonated drinks. Prioritize: ginger, turmeric, lean proteins, olive oil, eggs. Horse meat is lean and high protein.";

const SPLITS = [
  { day: "Monday",    label: "Push",         muscles: "Chest · Shoulders · Triceps", color: "#e8534a" },
  { day: "Tuesday",   label: "Pull",         muscles: "Back · Biceps · Rear Delts",  color: "#4a9ee8" },
  { day: "Wednesday", label: "Legs",         muscles: "Quads · Hamstrings · Calves", color: "#e8a94a" },
  { day: "Thursday",  label: "Back + Chest", muscles: "Chest · Lats · Rhomboids",    color: "#4ae8a9" },
  { day: "Friday",    label: "Upper",        muscles: "Full Upper Body Compound",    color: "#a94ae8" },
];

const DEFAULT_WORKOUTS = {
  Push: [
    { id: "p1", name: "Flat Barbell Bench Press", sets: "4×6-8", rpe: "RPE 8" },
    { id: "p2", name: "Incline Dumbbell Press",   sets: "3×10",  rpe: "RPE 7" },
    { id: "p3", name: "Cable Lateral Raise",      sets: "4×15",  rpe: "RPE 7" },
    { id: "p4", name: "Overhead Press",           sets: "3×8",   rpe: "RPE 8" },
    { id: "p5", name: "Tricep Pushdown",          sets: "3×12",  rpe: "RPE 7" },
    { id: "p6", name: "Stairmaster",              sets: "20 min",rpe: "Steady" },
  ],
  Pull: [
    { id: "pu1", name: "Weighted Pull-Ups",      sets: "4×6",   rpe: "RPE 8" },
    { id: "pu2", name: "Barbell Row",            sets: "4×8",   rpe: "RPE 8" },
    { id: "pu3", name: "Seated Cable Row",       sets: "3×10",  rpe: "RPE 7" },
    { id: "pu4", name: "Face Pulls",             sets: "3×15",  rpe: "RPE 6" },
    { id: "pu5", name: "Barbell Curl",           sets: "3×10",  rpe: "RPE 7" },
    { id: "pu6", name: "Treadmill Incline Walk", sets: "20 min",rpe: "Steady" },
  ],
  Legs: [
    { id: "l1", name: "Back Squat",              sets: "4×6-8", rpe: "RPE 8" },
    { id: "l2", name: "Romanian Deadlift",       sets: "3×10",  rpe: "RPE 7" },
    { id: "l3", name: "Leg Press",               sets: "3×12",  rpe: "RPE 7" },
    { id: "l4", name: "Leg Curl",                sets: "3×12",  rpe: "RPE 7" },
    { id: "l5", name: "Calf Raises",             sets: "4×15",  rpe: "RPE 6" },
    { id: "l6", name: "Stairmaster",             sets: "15 min",rpe: "Moderate" },
  ],
  "Back + Chest": [
    { id: "bc1", name: "Deadlift",               sets: "4×5",   rpe: "RPE 8" },
    { id: "bc2", name: "Incline Barbell Press",  sets: "4×8",   rpe: "RPE 8" },
    { id: "bc3", name: "Chest-Supported Row",    sets: "3×10",  rpe: "RPE 7" },
    { id: "bc4", name: "Cable Fly",              sets: "3×12",  rpe: "RPE 6" },
    { id: "bc5", name: "Lat Pulldown",           sets: "3×10",  rpe: "RPE 7" },
    { id: "bc6", name: "Treadmill",              sets: "20 min",rpe: "Steady" },
  ],
  Upper: [
    { id: "u1", name: "Overhead Press",          sets: "4×6",   rpe: "RPE 8" },
    { id: "u2", name: "Weighted Pull-Ups",       sets: "4×6",   rpe: "RPE 8" },
    { id: "u3", name: "Dumbbell Bench Press",    sets: "3×10",  rpe: "RPE 7" },
    { id: "u4", name: "Cable Row",               sets: "3×10",  rpe: "RPE 7" },
    { id: "u5", name: "Lateral Raise",           sets: "3×15",  rpe: "RPE 6" },
    { id: "u6", name: "Stairmaster",             sets: "20 min",rpe: "Steady" },
  ],
};

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Helpers ────────────────────────────────────────────────────────────────
const store = {
  get: (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } },
  set: (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const todayKey = () => new Date().toISOString().slice(0, 10);
const uid      = () => Math.random().toString(36).slice(2, 8);
const currentWeekKeys = () => {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 5 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d.toISOString().slice(0, 10); });
};

async function askClaude(sys, user) {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST", headers: { "Content-Type": "application/json",  },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1000, system: sys, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Styles ─────────────────────────────────────────────────────────────────
const card      = { background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16 };
const cardTitle = { fontSize: 10, letterSpacing: 2, color: "#444", fontFamily: "DM Mono, monospace", marginBottom: 8 };
const btn       = { width: "100%", padding: "12px", background: "#e8534a11", color: "#e8534a", border: "1px solid #e8534a44", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "DM Mono, monospace", letterSpacing: 2, marginTop: 8, transition: "all 0.2s" };
const btnGhost  = { ...btn, background: "transparent", color: "#333", border: "1px solid #1a1a1a", fontSize: 10 };
const btnDisabled = { ...btn, opacity: 0.4, cursor: "not-allowed" };
const inp       = { width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 12, fontFamily: "DM Mono, monospace", outline: "none", boxSizing: "border-box" };
const statBox   = { flex: 1, background: "#080808", borderRadius: 8, padding: "10px", textAlign: "center" };

function Pill({ label, color }) {
  return (
    <span style={{ background: color+"22", color, border:`1px solid ${color}44`, borderRadius:4, padding:"2px 8px", fontSize:10, fontFamily:"DM Mono, monospace", letterSpacing:0.5, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function MacroRing({ value, max, color, label, unit = "g" }) {
  const pct = Math.min(value / max, 1);
  const r = 28, cx = 34, cy = 34, stroke = 5, circ = 2 * Math.PI * r;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={68} height={68}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:"stroke-dasharray 0.6s ease" }} />
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" style={{ fontSize:11, fontFamily:"DM Mono, monospace", fontWeight:600 }}>{value}</text>
      </svg>
      <span style={{ fontSize:10, color:"#666", fontFamily:"DM Mono, monospace", letterSpacing:1 }}>{label}</span>
      <span style={{ fontSize:9, color:"#444", fontFamily:"DM Mono, monospace" }}>{unit==="kcal" ? `/${max}kcal` : `/${max}g`}</span>
    </div>
  );
}

// ── NUTRITION TAB ──────────────────────────────────────────────────────────
function NutritionTab({ log, setLog, targets }) {
  const [ingredients, setIngredients] = useState(STAPLES.join(", "));
  const [meal,        setMeal]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [mealName,    setMealName]    = useState("");
  const [logInput,    setLogInput]    = useState({ kcal:"", protein:"", carbs:"", fat:"" });
  const [editingMeal, setEditingMeal] = useState(null); // { dayKey, index }
  const [editMealVal, setEditMealVal] = useState({ name:"", kcal:"", protein:"", carbs:"", fat:"" });

  const todayLog = log[todayKey()] || { kcal:0, protein:0, carbs:0, fat:0, meals:[] };

  async function generateMeal() {
    setLoading(true); setMeal(null);
    const sys = `You are a sports nutritionist. Fat loss goal. Daily targets: ${targets.kcal}kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat. ${ANTI_BLOAT_NOTES}. Respond ONLY with valid JSON, no markdown. Format: {"name":"","kcal":0,"protein":0,"carbs":0,"fat":0,"ingredients":[{"item":"","amount":""}],"instructions":"","antiInflamNote":""}`;
    const text = await askClaude(sys, `Ingredients: ${ingredients}. Generate a high-protein, anti-bloating meal.`);
    try { const clean = text.replace(/```json|```/g,"").trim(); const jsonMatch = clean.match(/{[\s\S]*}/); setMeal(JSON.parse(jsonMatch ? jsonMatch[0] : clean)); }
    catch(err) { console.log("RAW RESPONSE:", text); console.log("ERROR:", err); setMeal({ name:"Parse error", kcal:0, protein:0, carbs:0, fat:0, ingredients:[], instructions:text, antiInflamNote:"" }); }
    setLoading(false);
  }

  function buildDayLog(prev, delta) {
    return {
      kcal:    (prev.kcal    || 0) + (delta.kcal    || 0),
      protein: (prev.protein || 0) + (delta.protein || 0),
      carbs:   (prev.carbs   || 0) + (delta.carbs   || 0),
      fat:     (prev.fat     || 0) + (delta.fat     || 0),
      meals:   [...(prev.meals || []), { name: delta.name, kcal: delta.kcal||0, protein: delta.protein||0, carbs: delta.carbs||0, fat: delta.fat||0 }],
    };
  }

  function logMeal(m) {
    const key  = todayKey();
    const prev = log[key] || { kcal:0, protein:0, carbs:0, fat:0, meals:[] };
    const newLog = { ...log, [key]: buildDayLog(prev, m) };
    setLog(newLog); store.set("nutrition_log", newLog);
  }

  function logManual() {
    const m = { name: mealName||"Manual entry", kcal:+logInput.kcal, protein:+logInput.protein, carbs:+logInput.carbs, fat:+logInput.fat };
    logMeal(m); setLogInput({ kcal:"", protein:"", carbs:"", fat:"" }); setMealName("");
  }

  function deleteMealEntry(dayKey, idx) {
    const day     = log[dayKey];
    if (!day) return;
    const removed = day.meals[idx];
    const newMeals = day.meals.filter((_, i) => i !== idx);
    const updated  = {
      kcal:    day.kcal    - (removed.kcal    || 0),
      protein: day.protein - (removed.protein || 0),
      carbs:   day.carbs   - (removed.carbs   || 0),
      fat:     day.fat     - (removed.fat     || 0),
      meals:   newMeals,
    };
    const newLog = { ...log, [dayKey]: updated };
    setLog(newLog); store.set("nutrition_log", newLog);
  }

  function startEditMeal(dayKey, idx) {
    const m = log[dayKey]?.meals?.[idx];
    if (!m) return;
    setEditingMeal({ dayKey, idx });
    setEditMealVal({ name: m.name||"", kcal: m.kcal||"", protein: m.protein||"", carbs: m.carbs||"", fat: m.fat||"" });
  }

  function saveEditMeal() {
    const { dayKey, idx } = editingMeal;
    const day  = log[dayKey];
    const old  = day.meals[idx];
    const nw   = { name: editMealVal.name, kcal:+editMealVal.kcal, protein:+editMealVal.protein, carbs:+editMealVal.carbs, fat:+editMealVal.fat };
    const newMeals = day.meals.map((m, i) => i === idx ? nw : m);
    const updated  = {
      kcal:    day.kcal    - (old.kcal||0)    + nw.kcal,
      protein: day.protein - (old.protein||0) + nw.protein,
      carbs:   day.carbs   - (old.carbs||0)   + nw.carbs,
      fat:     day.fat     - (old.fat||0)     + nw.fat,
      meals:   newMeals,
    };
    const newLog = { ...log, [dayKey]: updated };
    setLog(newLog); store.set("nutrition_log", newLog); setEditingMeal(null);
  }

  const todayMeals = todayLog.meals || [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Daily macros */}
      <div style={card}>
        <div style={cardTitle}>TODAY · {todayKey()}</div>
        <div style={{ display:"flex", justifyContent:"space-around", padding:"12px 0" }}>
          <MacroRing value={todayLog.kcal}    max={targets.kcal}    color="#e8534a" label="KCAL"    unit="kcal" />
          <MacroRing value={todayLog.protein} max={targets.protein} color="#4ae8a9" label="PROTEIN" />
          <MacroRing value={todayLog.carbs}   max={targets.carbs}   color="#4a9ee8" label="CARBS"   />
          <MacroRing value={todayLog.fat}     max={targets.fat}     color="#e8a94a" label="FAT"     />
        </div>

        {/* Logged meals list with edit/delete */}
        {todayMeals.length > 0 && (
          <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:12, display:"flex", flexDirection:"column", gap:6 }}>
            {todayMeals.map((m, i) => (
              <div key={i}>
                {editingMeal?.dayKey === todayKey() && editingMeal?.idx === i ? (
                  <div style={{ background:"#e8534a0d", border:"1px solid #e8534a22", borderRadius:8, padding:10 }}>
                    <input value={editMealVal.name} onChange={e=>setEditMealVal(p=>({...p,name:e.target.value}))} placeholder="Meal name" style={{...inp, marginBottom:6}} />
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      {["kcal","protein","carbs","fat"].map(k=>(
                        <input key={k} type="number" value={editMealVal[k]} onChange={e=>setEditMealVal(p=>({...p,[k]:e.target.value}))} placeholder={k.charAt(0).toUpperCase()+k.slice(1)} style={inp} />
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:8 }}>
                      <button onClick={saveEditMeal} style={{ flex:1, padding:"8px", background:"#e8534a22", color:"#e8534a", border:"1px solid #e8534a44", borderRadius:6, cursor:"pointer", fontSize:10, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>SAVE</button>
                      <button onClick={()=>setEditingMeal(null)} style={{ flex:1, padding:"8px", background:"#111", color:"#555", border:"1px solid #222", borderRadius:6, cursor:"pointer", fontSize:10, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:"#ccc", fontFamily:"Syne, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</div>
                      <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
                        <Pill label={`${m.kcal}kcal`} color="#e8534a" />
                        <Pill label={`${m.protein}g P`} color="#4ae8a9" />
                        <Pill label={`${m.carbs}g C`} color="#4a9ee8" />
                        <Pill label={`${m.fat}g F`} color="#e8a94a" />
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:5, marginLeft:8, flexShrink:0 }}>
                      <button onClick={()=>startEditMeal(todayKey(), i)} style={{ background:"#111", border:"1px solid #2a2a2a", color:"#666", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:11, fontFamily:"DM Mono, monospace" }}>✎</button>
                      <button onClick={()=>deleteMealEntry(todayKey(), i)} style={{ background:"#1a0808", border:"1px solid #3a1a1a", color:"#e8534a", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:11, fontFamily:"DM Mono, monospace" }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Meal Generator */}
      <div style={card}>
        <div style={cardTitle}>AI MEAL GENERATOR</div>
        <textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} style={{...inp, resize:"vertical", lineHeight:1.6}} rows={3} />
        <button onClick={generateMeal} disabled={loading} style={loading ? btnDisabled : btn}>
          {loading ? "GENERATING…" : "GENERATE MEAL"}
        </button>
        {meal && (
          <div style={{ marginTop:16, borderTop:"1px solid #1a1a1a", paddingTop:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#fff", fontFamily:"Syne, sans-serif" }}>{meal.name}</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                <Pill label={`${meal.kcal}kcal`} color="#e8534a" />
                <Pill label={`${meal.protein}g P`} color="#4ae8a9" />
                <Pill label={`${meal.carbs}g C`} color="#4a9ee8" />
                <Pill label={`${meal.fat}g F`} color="#e8a94a" />
              </div>
            </div>
            <div style={{ fontSize:12, color:"#888", lineHeight:1.6, marginBottom:8 }}>{meal.instructions}</div>
            {meal.antiInflamNote && (
              <div style={{ fontSize:11, color:"#4ae8a9", background:"#4ae8a922", borderRadius:6, padding:"6px 10px", marginBottom:10 }}>
                💚 {meal.antiInflamNote}
              </div>
            )}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {meal.ingredients?.map((ing,i)=>(
                <span key={i} style={{ fontSize:11, color:"#aaa", background:"#111", borderRadius:4, padding:"3px 8px" }}>{ing.amount} {ing.item}</span>
              ))}
            </div>
            <button onClick={()=>logMeal(meal)} style={{...btn, background:"#4ae8a922", color:"#4ae8a9", border:"1px solid #4ae8a944"}}>
              LOG THIS MEAL
            </button>
          </div>
        )}
      </div>

      {/* Manual log */}
      <div style={card}>
        <div style={cardTitle}>MANUAL LOG</div>
        <input value={mealName} onChange={e=>setMealName(e.target.value)} placeholder="Meal name (optional)" style={inp} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
          {["kcal","protein","carbs","fat"].map(k=>(
            <input key={k} type="number" value={logInput[k]} onChange={e=>setLogInput(p=>({...p,[k]:e.target.value}))} placeholder={k.charAt(0).toUpperCase()+k.slice(1)} style={inp} />
          ))}
        </div>
        <button onClick={logManual} style={{...btn, marginTop:10}}>LOG ENTRY</button>
      </div>
    </div>
  );
}

// ── TRAINING TAB ───────────────────────────────────────────────────────────
function TrainingTab({ sessionLog, setSessionLog }) {
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday:"long" });
  const todaySplit = SPLITS.find(s => s.day === todayLabel);
  const [selected,  setSelected]  = useState(todaySplit?.label || SPLITS[0].label);
  const [editMode,  setEditMode]  = useState(false);
  const [newEx,     setNewEx]     = useState({ name:"", sets:"", rpe:"" });
  const [editingId, setEditingId] = useState(null);
  const [editVal,   setEditVal]   = useState({});
  const [customWorkouts, setCustomWorkouts] = useState(store.get("custom_workouts", DEFAULT_WORKOUTS));

  const compKey = `comp_${todayKey()}_${selected}`;
  const [completed, setCompleted] = useState(store.get(compKey, {}));

  function switchSplit(label) {
    setSelected(label); setEditMode(false); setEditingId(null);
    setCompleted(store.get(`comp_${todayKey()}_${label}`, {}));
  }

  const viewSplit = SPLITS.find(s => s.label === selected) || SPLITS[0];
  const exercises = customWorkouts[selected] || [];
  const doneCount = exercises.filter(e => completed[e.id]).length;

  function toggleExercise(id) {
    const updated = { ...completed, [id]: !completed[id] };
    setCompleted(updated); store.set(compKey, updated);
    const done = exercises.filter(e => updated[e.id]).length;
    const key  = todayKey();
    const newLog = { ...sessionLog, [key]: { ...(sessionLog[key]||{}), [selected]: { done, total: exercises.length } } };
    setSessionLog(newLog); store.set("session_log", newLog);
  }

  function saveCustom(updated) { setCustomWorkouts(updated); store.set("custom_workouts", updated); }
  function addExercise() {
    if (!newEx.name.trim()) return;
    saveCustom({ ...customWorkouts, [selected]: [...exercises, { id:uid(), name:newEx.name.trim(), sets:newEx.sets||"3×10", rpe:newEx.rpe||"RPE 7" }] });
    setNewEx({ name:"", sets:"", rpe:"" });
  }
  function deleteExercise(id) {
    saveCustom({ ...customWorkouts, [selected]: exercises.filter(e=>e.id!==id) });
    const c = { ...completed }; delete c[id]; setCompleted(c); store.set(compKey, c);
  }
  function saveEdit(id) {
    saveCustom({ ...customWorkouts, [selected]: exercises.map(e=>e.id===id?{...e,...editVal}:e) });
    setEditingId(null);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={card}>
        <div style={cardTitle}>WEEKLY SPLIT</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
          {SPLITS.map(s=>(
            <button key={s.label} onClick={()=>switchSplit(s.label)} style={{
              background: selected===s.label ? s.color+"22" : "#0d0d0d",
              border:`1px solid ${selected===s.label ? s.color : "#222"}`,
              color: selected===s.label ? s.color : "#555",
              borderRadius:6, padding:"6px 12px", cursor:"pointer",
              fontSize:11, fontFamily:"DM Mono, monospace", letterSpacing:1, transition:"all 0.2s",
            }}>
              {s.day.slice(0,3).toUpperCase()}
              {s.day===todayLabel && <span style={{ marginLeft:4, color:"#e8534a" }}>●</span>}
            </button>
          ))}
          {["SAT","SUN"].map(d=>(
            <span key={d} style={{ background:"#0d0d0d", border:"1px solid #111", color:"#2a2a2a", borderRadius:6, padding:"6px 12px", fontSize:11, fontFamily:"DM Mono, monospace" }}>{d}</span>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={cardTitle}>{selected.toUpperCase()}</div>
            <div style={{ fontSize:11, color:"#555", fontFamily:"DM Mono, monospace" }}>{viewSplit.muscles}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:22, fontWeight:800, color:viewSplit.color, fontFamily:"Syne, sans-serif" }}>{doneCount}/{exercises.length}</div>
              <div style={{ fontSize:10, color:"#444", fontFamily:"DM Mono, monospace" }}>DONE</div>
            </div>
            <button onClick={()=>{setEditMode(e=>!e);setEditingId(null);}} style={{
              background: editMode ? viewSplit.color+"22" : "#111",
              border:`1px solid ${editMode ? viewSplit.color : "#222"}`,
              color: editMode ? viewSplit.color : "#555",
              borderRadius:6, padding:"6px 10px", cursor:"pointer",
              fontSize:10, fontFamily:"DM Mono, monospace", letterSpacing:1,
            }}>{editMode?"DONE":"EDIT"}</button>
          </div>
        </div>

        <div style={{ background:"#111", borderRadius:2, height:3, marginBottom:14 }}>
          <div style={{ background:viewSplit.color, height:3, borderRadius:2, transition:"width 0.4s ease", width:`${exercises.length?(doneCount/exercises.length)*100:0}%` }} />
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {exercises.map(ex=>(
            <div key={ex.id}>
              {editingId===ex.id ? (
                <div style={{ background:viewSplit.color+"0d", border:`1px solid ${viewSplit.color}33`, borderRadius:8, padding:10 }}>
                  <input value={editVal.name} onChange={e=>setEditVal(p=>({...p,name:e.target.value}))} style={{...inp,marginBottom:6}} placeholder="Exercise name" />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    <input value={editVal.sets} onChange={e=>setEditVal(p=>({...p,sets:e.target.value}))} style={inp} placeholder="Sets" />
                    <input value={editVal.rpe}  onChange={e=>setEditVal(p=>({...p,rpe:e.target.value}))}  style={inp} placeholder="RPE" />
                  </div>
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <button onClick={()=>saveEdit(ex.id)} style={{ flex:1, padding:"8px", background:viewSplit.color+"22", color:viewSplit.color, border:`1px solid ${viewSplit.color}44`, borderRadius:6, cursor:"pointer", fontSize:10, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>SAVE</button>
                    <button onClick={()=>setEditingId(null)} style={{ flex:1, padding:"8px", background:"#111", color:"#555", border:"1px solid #222", borderRadius:6, cursor:"pointer", fontSize:10, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>CANCEL</button>
                  </div>
                </div>
              ) : (
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  background: completed[ex.id] ? viewSplit.color+"11" : "#0a0a0a",
                  border:`1px solid ${completed[ex.id] ? viewSplit.color+"44" : "#1a1a1a"}`,
                  borderRadius:8, padding:"10px 12px", transition:"all 0.2s",
                  cursor: editMode ? "default" : "pointer",
                }} onClick={()=>!editMode&&toggleExercise(ex.id)}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                    {!editMode && (
                      <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, border:`2px solid ${completed[ex.id]?viewSplit.color:"#333"}`, background:completed[ex.id]?viewSplit.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {completed[ex.id] && <span style={{ fontSize:10, color:"#000", fontWeight:700 }}>✓</span>}
                      </div>
                    )}
                    <span style={{ fontSize:13, color:completed[ex.id]?"#fff":"#999", fontFamily:"Syne, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ex.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:5, alignItems:"center", flexShrink:0, marginLeft:8 }}>
                    <Pill label={ex.sets} color={completed[ex.id]?viewSplit.color:"#333"} />
                    <Pill label={ex.rpe}  color="#2a2a2a" />
                    {editMode && (
                      <>
                        <button onClick={e=>{e.stopPropagation();setEditingId(ex.id);setEditVal({name:ex.name,sets:ex.sets,rpe:ex.rpe});}} style={{ background:"#111", border:"1px solid #2a2a2a", color:"#666", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:11, fontFamily:"DM Mono, monospace" }}>✎</button>
                        <button onClick={e=>{e.stopPropagation();deleteExercise(ex.id);}} style={{ background:"#1a0808", border:"1px solid #3a1a1a", color:"#e8534a", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:11, fontFamily:"DM Mono, monospace" }}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {editMode && (
          <div style={{ marginTop:14, borderTop:"1px solid #1a1a1a", paddingTop:14 }}>
            <div style={{ fontSize:10, color:"#444", fontFamily:"DM Mono, monospace", letterSpacing:2, marginBottom:8 }}>ADD EXERCISE</div>
            <input value={newEx.name} onChange={e=>setNewEx(p=>({...p,name:e.target.value}))} placeholder="Exercise name" style={{...inp,marginBottom:6}} onKeyDown={e=>e.key==="Enter"&&addExercise()} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              <input value={newEx.sets} onChange={e=>setNewEx(p=>({...p,sets:e.target.value}))} placeholder="Sets (e.g. 4×8)" style={inp} />
              <input value={newEx.rpe}  onChange={e=>setNewEx(p=>({...p,rpe:e.target.value}))}  placeholder="RPE / note" style={inp} />
            </div>
            <button onClick={addExercise} style={{...btn,marginTop:8}}>+ ADD TO {selected.toUpperCase()}</button>
            <button onClick={()=>saveCustom({...customWorkouts,[selected]:DEFAULT_WORKOUTS[selected]})} style={btnGhost}>RESET TO DEFAULT</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PROGRESS TAB ───────────────────────────────────────────────────────────
function ProgressTab({ log, sessionLog, stats, targets }) {
  const [weights,     setWeights]     = useState(store.get("weight_log", {}));
  const [weightInput, setWeightInput] = useState("");

  function logWeight() {
    if (!weightInput) return;
    const updated = { ...weights, [todayKey()]: +weightInput };
    setWeights(updated); store.set("weight_log", updated); setWeightInput("");
  }

  const weightEntries = Object.entries(weights).sort(([a],[b])=>a.localeCompare(b)).slice(-14);
  const latest      = weightEntries[weightEntries.length-1]?.[1] || stats.currentWeight;
  const startWeight = weightEntries.length > 0 ? weightEntries[0][1] : stats.currentWeight;
  const lost        = (startWeight - latest).toFixed(1);
  const toGoal      = Math.max(0, latest - stats.goalWeight).toFixed(1);
  const totalToLose = startWeight - stats.goalWeight;
  const goalPct     = totalToLose > 0 ? Math.min(Math.max((startWeight - latest) / totalToLose, 0), 1) : 0;
  const W=280, H=60, vals=weightEntries.map(e=>e[1]);
  const wMax=Math.max(...vals,stats.currentWeight+1), wMin=Math.min(...vals,stats.goalWeight-1), wRange=wMax-wMin||1;

  const last7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const k=d.toISOString().slice(0,10); return { day:DAYS_SHORT[d.getDay()], data:log[k]||null }; });
  const weekKeys = currentWeekKeys();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={card}>
        <div style={cardTitle}>WEIGHT TRACKING</div>
        <div style={{ display:"flex", gap:12, margin:"12px 0" }}>
          <div style={statBox}>
            <div style={{ fontSize:22, fontWeight:800, color:"#e8534a", fontFamily:"Syne, sans-serif" }}>{latest}kg</div>
            <div style={{ fontSize:10, color:"#444", fontFamily:"DM Mono, monospace" }}>CURRENT</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize:22, fontWeight:800, color:"#4ae8a9", fontFamily:"Syne, sans-serif" }}>-{lost}kg</div>
            <div style={{ fontSize:10, color:"#444", fontFamily:"DM Mono, monospace" }}>LOST</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize:22, fontWeight:800, color:"#e8a94a", fontFamily:"Syne, sans-serif" }}>{toGoal}kg</div>
            <div style={{ fontSize:10, color:"#444", fontFamily:"DM Mono, monospace" }}>TO GOAL</div>
          </div>
        </div>

        {/* Goal progress bar */}
        <div style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:9, color:"#333", fontFamily:"DM Mono, monospace" }}>{stats.currentWeight}kg START</span>
            <span style={{ fontSize:9, color:"#4ae8a9", fontFamily:"DM Mono, monospace" }}>{stats.goalWeight}kg GOAL</span>
          </div>
          <div style={{ background:"#111", borderRadius:3, height:6 }}>
            <div style={{ background:"linear-gradient(90deg,#e8534a,#4ae8a9)", height:6, borderRadius:3, width:`${goalPct*100}%`, transition:"width 0.5s" }} />
          </div>
          <div style={{ fontSize:9, color:"#555", fontFamily:"DM Mono, monospace", marginTop:4, textAlign:"right" }}>{Math.round(goalPct*100)}% TO GOAL</div>
        </div>

        {weightEntries.length > 1 && (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block", margin:"8px 0" }}>
            <polyline points={weightEntries.map((e,i)=>`${(i/(weightEntries.length-1))*W},${H-((e[1]-wMin)/wRange)*(H-10)-5}`).join(" ")}
              fill="none" stroke="#e8534a" strokeWidth={2} strokeLinejoin="round" />
            {weightEntries.map((e,i)=>{ const x=(i/(weightEntries.length-1))*W, y=H-((e[1]-wMin)/wRange)*(H-10)-5; return <circle key={i} cx={x} cy={y} r={3} fill="#e8534a" />; })}
          </svg>
        )}

        <div style={{ display:"flex", gap:8 }}>
          <input type="number" value={weightInput} onChange={e=>setWeightInput(e.target.value)}
            placeholder="Log today's weight (kg)" style={{...inp,flex:1}} onKeyDown={e=>e.key==="Enter"&&logWeight()} />
          <button onClick={logWeight} style={{...btn,width:"auto",padding:"0 16px",marginTop:0}}>LOG</button>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>NUTRITION · LAST 7 DAYS</div>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          {last7.map(({day,data},i)=>{
            const pct=data?Math.min(data.kcal/targets.kcal,1):0;
            const color=pct>0.85&&pct<1.1?"#4ae8a9":pct>0.4?"#e8a94a":"#1a1a1a";
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:"100%", height:60, background:"#111", borderRadius:4, position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", bottom:0, width:"100%", height:`${pct*100}%`, background:color, borderRadius:4, transition:"height 0.5s ease" }} />
                </div>
                <span style={{ fontSize:9, color:"#444", fontFamily:"DM Mono, monospace" }}>{day.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
          <Pill label="ON TARGET" color="#4ae8a9" /><Pill label="PARTIAL" color="#e8a94a" /><Pill label="NOT LOGGED" color="#444" />
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>SESSIONS · THIS WEEK</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:10 }}>
          {SPLITS.map((s,i)=>{
            const dateKey=weekKeys[i], sess=sessionLog[dateKey]?.[s.label]||null, pct=sess?sess.done/sess.total:0;
            return (
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:11, color:"#555", fontFamily:"DM Mono, monospace", width:94 }}>{s.day.slice(0,3).toUpperCase()} · {s.label.slice(0,4).toUpperCase()}</span>
                <div style={{ flex:1, background:"#111", borderRadius:3, height:6 }}>
                  <div style={{ background:pct===1?s.color:pct>0?"#e8a94a":"#1a1a1a", height:6, borderRadius:3, width:`${pct*100}%`, transition:"width 0.4s" }} />
                </div>
                <span style={{ fontSize:11, color:"#444", fontFamily:"DM Mono, monospace", width:40, textAlign:"right" }}>{sess?`${sess.done}/${sess.total}`:"—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS TAB ───────────────────────────────────────────────────────────
function SettingsTab({ targets, setTargets, stats, setStats }) {
  const [tEdit, setTEdit] = useState({ ...targets });
  const [sEdit, setSEdit] = useState({ ...stats });
  const [tSaved, setTSaved] = useState(false);
  const [sSaved, setSSaved] = useState(false);

  // Sync local form state when props update externally
  useEffect(() => { setTEdit({ ...targets }); }, [JSON.stringify(targets)]);
  useEffect(() => { setSEdit({ ...stats }); }, [JSON.stringify(stats)]);

  function saveTargets() {
    const updated = { kcal:+tEdit.kcal, protein:+tEdit.protein, carbs:+tEdit.carbs, fat:+tEdit.fat };
    setTargets(updated); store.set("targets", updated);
    setTSaved(true); setTimeout(()=>setTSaved(false), 2000);
  }

  function saveStats() {
    const updated = { currentWeight:+sEdit.currentWeight, goalWeight:+sEdit.goalWeight, height:+sEdit.height };
    setStats(updated); store.set("stats", updated);
    setSSaved(true); setTimeout(()=>setSSaved(false), 2000);
  }

  const totalMacroKcal = (+tEdit.protein*4) + (+tEdit.carbs*4) + (+tEdit.fat*9);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Daily targets */}
      <div style={card}>
        <div style={cardTitle}>DAILY TARGETS</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { key:"kcal",    label:"Calories (kcal)", color:"#e8534a" },
            { key:"protein", label:"Protein (g)",     color:"#4ae8a9" },
            { key:"carbs",   label:"Carbs (g)",       color:"#4a9ee8" },
            { key:"fat",     label:"Fat (g)",         color:"#e8a94a" },
          ].map(f=>(
            <div key={f.key}>
              <div style={{ fontSize:10, color:f.color, fontFamily:"DM Mono, monospace", letterSpacing:1, marginBottom:4 }}>{f.label.toUpperCase()}</div>
              <input type="number" value={tEdit[f.key]} onChange={e=>setTEdit(p=>({...p,[f.key]:e.target.value}))} style={{...inp, borderColor: f.color+"33" }} />
            </div>
          ))}
        </div>

        {/* Macro kcal breakdown */}
        <div style={{ marginTop:12, background:"#080808", borderRadius:8, padding:"10px 12px" }}>
          <div style={{ fontSize:10, color:"#333", fontFamily:"DM Mono, monospace", letterSpacing:1, marginBottom:6 }}>MACRO BREAKDOWN</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <Pill label={`P: ${(+tEdit.protein*4).toFixed(0)}kcal`} color="#4ae8a9" />
            <Pill label={`C: ${(+tEdit.carbs*4).toFixed(0)}kcal`}   color="#4a9ee8" />
            <Pill label={`F: ${(+tEdit.fat*9).toFixed(0)}kcal`}     color="#e8a94a" />
            <Pill label={`= ${totalMacroKcal}kcal`} color={Math.abs(totalMacroKcal-(+tEdit.kcal))<50?"#4ae8a9":"#e8534a"} />
          </div>
          {Math.abs(totalMacroKcal-(+tEdit.kcal))>50 && (
            <div style={{ fontSize:10, color:"#e8534a", fontFamily:"DM Mono, monospace", marginTop:6 }}>
              ⚠ Macros sum to {totalMacroKcal}kcal — doesn't match target
            </div>
          )}
        </div>

        <button onClick={saveTargets} style={{...btn, ...(tSaved?{background:"#4ae8a922",color:"#4ae8a9",border:"1px solid #4ae8a944"}:{})}}>
          {tSaved ? "✓ SAVED" : "SAVE TARGETS"}
        </button>
      </div>

      {/* Personal stats */}
      <div style={card}>
        <div style={cardTitle}>PERSONAL STATS</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { key:"currentWeight", label:"Current Weight (kg)" },
            { key:"goalWeight",    label:"Goal Weight (kg)"    },
            { key:"height",        label:"Height (cm)"         },
          ].map(f=>(
            <div key={f.key}>
              <div style={{ fontSize:10, color:"#555", fontFamily:"DM Mono, monospace", letterSpacing:1, marginBottom:4 }}>{f.label.toUpperCase()}</div>
              <input type="number" value={sEdit[f.key]} onChange={e=>setSEdit(p=>({...p,[f.key]:e.target.value}))} style={inp} />
            </div>
          ))}
        </div>

        {/* BMI + deficit estimate */}
        <div style={{ marginTop:12, background:"#080808", borderRadius:8, padding:"10px 12px" }}>
          <div style={{ fontSize:10, color:"#333", fontFamily:"DM Mono, monospace", letterSpacing:1, marginBottom:6 }}>ESTIMATES</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {(() => {
              const bmi = (+sEdit.currentWeight / ((+sEdit.height/100)**2)).toFixed(1);
              const tolose = +sEdit.currentWeight - +sEdit.goalWeight;
              const weeks  = tolose > 0 ? Math.ceil(tolose / 0.5) : 0;
              return (
                <>
                  <Pill label={`BMI ${bmi}`} color="#4a9ee8" />
                  <Pill label={`${tolose}kg to lose`} color="#e8a94a" />
                  <Pill label={`~${weeks} weeks`} color="#a94ae8" />
                </>
              );
            })()}
          </div>
          <div style={{ fontSize:10, color:"#333", fontFamily:"DM Mono, monospace", marginTop:6 }}>Based on ~0.5kg/week loss rate</div>
        </div>

        <button onClick={saveStats} style={{...btn, ...(sSaved?{background:"#4ae8a922",color:"#4ae8a9",border:"1px solid #4ae8a944"}:{})}}>
          {sSaved ? "✓ SAVED" : "SAVE STATS"}
        </button>
      </div>

      {/* Anti-bloat guide */}
      <div style={card}>
        <div style={cardTitle}>ANTI-BLOAT GUIDE</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:4 }}>
          {[
            { label:"✅ EAT",    color:"#4ae8a9", items:["Eggs","Horse meat","White rice (cooled)","Olive oil","Ginger tea","Black coffee"] },
            { label:"⚠️ LIMIT", color:"#e8a94a", items:["Peanuts","White bread","Fekkas + Pickers (treat only)"] },
            { label:"🚫 AVOID", color:"#e8534a", items:["Carbonated drinks","Excess sodium","Fried food","Alcohol"] },
          ].map(g=>(
            <div key={g.label} style={{ background:g.color+"0d", border:`1px solid ${g.color}22`, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:11, fontFamily:"DM Mono, monospace", color:g.color, marginBottom:6, letterSpacing:1 }}>{g.label}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {g.items.map(item=><Pill key={item} label={item} color={g.color} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── COACH TAB ──────────────────────────────────────────────────────────────
function CoachTab({ log, sessionLog, targets, stats }) {
  const [feedback, setFeedback] = useState("");
  const [loading,  setLoading]  = useState(false);

  async function generateFeedback() {
    setLoading(true); setFeedback("");
    const weights      = store.get("weight_log", {});
    const wEntries     = Object.entries(weights).sort(([a],[b])=>a.localeCompare(b));
    const latest       = wEntries[wEntries.length-1]?.[1] || "not logged";
    const nutSummary   = Object.entries(log).slice(-7).map(([k,v])=>`${k}: ${v.kcal}kcal, ${v.protein}g protein`).join("; ");
    const sessSummary  = Object.entries(sessionLog).slice(-5).map(([k,v])=>`${k}: ${Object.entries(v).map(([s,d])=>`${s} ${d.done}/${d.total}`).join(", ")}`).join("; ");
    const sys  = `You are a no-nonsense fitness coach. User: Khalil, ${stats.currentWeight}kg → ${stats.goalWeight}kg goal, ${stats.height}cm. Daily targets: ${targets.kcal}kcal, ${targets.protein}g protein. Trains Mon–Fri: Push/Pull/Legs/Back+Chest/Upper. Be direct, specific, motivating. No fluff.`;
    const prompt = `Week review. Current weight: ${latest}kg. Nutrition last 7 days: ${nutSummary||"no data"}. Sessions: ${sessSummary||"no data"}. Give a 3-part review: (1) What he nailed, (2) What needs fixing, (3) One specific adjustment for next week.`;
    setFeedback(await askClaude(sys, prompt));
    setLoading(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={card}>
        <div style={cardTitle}>WEEKLY COACH REVIEW</div>
        <p style={{ fontSize:12, color:"#555", fontFamily:"DM Mono, monospace", lineHeight:1.7, marginTop:4 }}>
          AI feedback based on your logged nutrition, sessions, and weight. Best run at end of week.
        </p>
        <button onClick={generateFeedback} disabled={loading} style={loading?btnDisabled:btn}>
          {loading?"ANALYZING…":"GENERATE FEEDBACK"}
        </button>
        {feedback && (
          <div style={{ marginTop:16, borderTop:"1px solid #1a1a1a", paddingTop:16 }}>
            <div style={{ fontSize:13, color:"#ccc", fontFamily:"DM Mono, monospace", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{feedback}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState("nutrition");
  const [nutritionLog, setNutritionLog] = useState(store.get("nutrition_log", {}));
  const [sessionLog,   setSessionLog]   = useState(store.get("session_log",   {}));
  const [targets,      setTargets]      = useState(store.get("targets",        DEFAULT_TARGETS));
  const [stats,        setStats]        = useState(store.get("stats",          DEFAULT_STATS));

  const today      = new Date().toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });
  const todaySplit = SPLITS.find(s => s.day === new Date().toLocaleDateString("en-US", { weekday:"long" }));

  const tabs = [
    { id:"nutrition", label:"NUTRITION" },
    { id:"training",  label:"TRAINING"  },
    { id:"progress",  label:"PROGRESS"  },
    { id:"coach",     label:"COACH"     },
    { id:"settings",  label:"SETTINGS"  },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#080808", color:"#fff", fontFamily:"Syne, sans-serif", maxWidth:480, margin:"0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input:focus, textarea:focus { border-color:#333 !important; }
        input::placeholder, textarea::placeholder { color:#2a2a2a; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:#080808; } ::-webkit-scrollbar-thumb { background:#1a1a1a; border-radius:2px; }
      `}</style>

      {/* Header */}
      <div style={{ padding:"24px 20px 16px", borderBottom:"1px solid #111" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:-0.5 }}>KHALIL OS</div>
            <div style={{ fontSize:10, color:"#333", fontFamily:"DM Mono, monospace", letterSpacing:2, marginTop:2 }}>{today.toUpperCase()}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            {todaySplit
              ? <><div style={{ fontSize:11, color:"#444", fontFamily:"DM Mono, monospace", letterSpacing:1 }}>TODAY</div>
                  <div style={{ fontSize:13, fontWeight:700, color:todaySplit.color }}>{todaySplit.label.toUpperCase()}</div></>
              : <div style={{ fontSize:11, color:"#2a2a2a", fontFamily:"DM Mono, monospace" }}>REST DAY</div>
            }
          </div>
        </div>
        <div style={{ marginTop:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:10, color:"#2a2a2a", fontFamily:"DM Mono, monospace" }}>DAILY CALORIES</span>
            <span style={{ fontSize:10, color:"#e8534a", fontFamily:"DM Mono, monospace" }}>
              {nutritionLog[todayKey()]?.kcal||0} / {targets.kcal}
            </span>
          </div>
          <div style={{ background:"#111", borderRadius:2, height:2 }}>
            <div style={{ background:"#e8534a", height:2, borderRadius:2, transition:"width 0.4s", width:`${Math.min((nutritionLog[todayKey()]?.kcal||0)/targets.kcal*100,100)}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid #111", overflowX:"auto" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1, minWidth:60, padding:"12px 0", background:"none", border:"none",
            borderBottom: tab===t.id ? "2px solid #e8534a" : "2px solid transparent",
            color: tab===t.id ? "#fff" : "#333", cursor:"pointer",
            fontSize:9, fontFamily:"DM Mono, monospace", letterSpacing:1.5, transition:"all 0.2s", whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:16, paddingBottom:48 }}>
        {tab==="nutrition" && <NutritionTab log={nutritionLog} setLog={setNutritionLog} targets={targets} />}
        {tab==="training"  && <TrainingTab  sessionLog={sessionLog} setSessionLog={setSessionLog} />}
        {tab==="progress"  && <ProgressTab  log={nutritionLog} sessionLog={sessionLog} stats={stats} targets={targets} />}
        {tab==="coach"     && <CoachTab     log={nutritionLog} sessionLog={sessionLog} targets={targets} stats={stats} />}
        {tab==="settings"  && <SettingsTab  targets={targets} setTargets={setTargets} stats={stats} setStats={setStats} />}
      </div>
    </div>
  );
}
