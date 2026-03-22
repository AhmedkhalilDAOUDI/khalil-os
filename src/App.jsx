import { useState, useEffect } from "react";

const ANTHROPIC_API = "http://localhost:3001/api/messages";

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT_TARGETS = { kcal: 2100, protein: 180, carbs: 200, fat: 60 };
const DEFAULT_STATS   = { currentWeight: 85, goalWeight: 78, height: 175 };
const STAPLES = ["white rice", "white bread", "fekkas", "eggs", "horse ground meat", "peanuts", "olive oil", "black coffee"];
const ANTI_BLOAT_NOTES = "Avoid high-FODMAP foods, excess sodium, carbonated drinks. Prioritize: ginger, turmeric, lean proteins, olive oil, eggs. Horse meat is lean and high protein.";

const SPLITS = [
  { day: "Monday",    label: "Push",         muscles: "Chest · Shoulders · Triceps", color: "var(--copper)" },
  { day: "Tuesday",   label: "Pull",         muscles: "Back · Biceps · Rear Delts",  color: "var(--copper)" },
  { day: "Wednesday", label: "Legs",         muscles: "Quads · Hamstrings · Calves", color: "var(--copper)" },
  { day: "Thursday",  label: "Back + Chest", muscles: "Chest · Lats · Rhomboids",    color: "var(--copper)" },
  { day: "Friday",    label: "Upper",        muscles: "Full Upper Body Compound",    color: "var(--copper)" },
];

const SPLIT_KANJI = { Push: "押", Pull: "引", Legs: "脚", "Back + Chest": "背", Upper: "上" };

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
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1000, system: sys, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Design tokens ──────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;600&family=JetBrains+Mono:wght@300;400;500&family=Zen+Kaku+Gothic+New:wght@300;400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink:     #0e0e0f;
    --ink-2:   #161618;
    --ink-3:   #1e1e21;
    --ink-4:   #2a2a2e;
    --fog:     #3a3a40;
    --mist:    #6a6a72;
    --ash:     #9a9aa4;
    --paper:   #f5f0e8;
    --copper:  #b87333;
    --copper-l:#d4955a;
    --copper-d:#8a5520;
    --copper-g: linear-gradient(135deg, #b87333, #d4955a);
    --text:    #e8e6e0;
    --text-2:  #9a9aa4;
    --text-3:  #5a5a62;
    --border:  #1e1e21;
    --border-2:#2a2a2e;
    --red:     #c0392b;
    --green:   #27ae60;
    --blue:    #2980b9;
  }

  @media (prefers-color-scheme: light) {
    :root {
      --ink:    #f5f0e8;
      --ink-2:  #ede8de;
      --ink-3:  #e2dbd0;
      --ink-4:  #d4ccbf;
      --fog:    #b8b0a4;
      --mist:   #8a8278;
      --ash:    #5a5248;
      --text:   #1a1714;
      --text-2: #5a5248;
      --text-3: #8a8278;
      --border: #d8d0c4;
      --border-2:#c8c0b4;
    }
  }

  body { background: var(--ink); color: var(--text); font-family: 'JetBrains Mono', monospace; -webkit-font-smoothing: antialiased; }

  input, textarea, button { font-family: inherit; }
  input:focus, textarea:focus { outline: none; border-color: var(--copper) !important; }
  input::placeholder, textarea::placeholder { color: var(--text-3); }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--ink-4); border-radius: 2px; }

  .card {
    background: var(--ink-2);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 20px;
    position: relative;
  }

  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 2px; height: 100%;
    background: var(--copper-g);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .card:hover::before { opacity: 1; }

  .label {
    font-size: 9px;
    letter-spacing: 3px;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
  }

  .kanji {
    font-family: 'Noto Serif JP', serif;
    color: var(--copper);
    opacity: 0.15;
    font-weight: 300;
    line-height: 1;
    user-select: none;
  }

  .btn-primary {
    width: 100%;
    padding: 13px;
    background: transparent;
    color: var(--copper);
    border: 1px solid var(--copper-d);
    border-radius: 2px;
    cursor: pointer;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 3px;
    margin-top: 12px;
    transition: all 0.25s;
    position: relative;
    overflow: hidden;
  }

  .btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--copper-g);
    opacity: 0;
    transition: opacity 0.25s;
  }

  .btn-primary:hover::after { opacity: 0.08; }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn-ghost {
    width: 100%;
    padding: 11px;
    background: transparent;
    color: var(--text-3);
    border: 1px solid var(--border-2);
    border-radius: 2px;
    cursor: pointer;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 3px;
    margin-top: 8px;
    transition: all 0.2s;
  }

  .btn-ghost:hover { border-color: var(--fog); color: var(--ash); }

  .inp {
    width: 100%;
    background: var(--ink);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 11px 14px;
    color: var(--text);
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    transition: border-color 0.2s;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 2px;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 1px;
    white-space: nowrap;
    border: 1px solid;
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 16px 0;
    position: relative;
  }

  .divider::after {
    content: '一';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Noto Serif JP', serif;
    font-size: 10px;
    color: var(--copper);
    opacity: 0.4;
    background: var(--ink-2);
    padding: 0 8px;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-bar::-webkit-scrollbar { display: none; }

  .tab-btn {
    flex: 1;
    min-width: 64px;
    padding: 14px 4px;
    background: none;
    border: none;
    border-bottom: 1px solid transparent;
    color: var(--text-3);
    cursor: pointer;
    font-size: 8px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 2px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab-btn.active {
    color: var(--copper);
    border-bottom-color: var(--copper);
  }

  .ex-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--ink);
    gap: 10px;
  }

  .ex-row:hover { border-color: var(--border-2); }
  .ex-row.done { border-color: var(--copper-d); background: var(--ink-2); }

  .checkbox {
    width: 16px; height: 16px;
    border: 1px solid var(--fog);
    border-radius: 2px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .checkbox.checked {
    border-color: var(--copper);
    background: var(--copper);
  }

  .ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }

  .stat-box {
    flex: 1;
    background: var(--ink);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 14px 10px;
    text-align: center;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .fade-up { animation: fadeUp 0.3s ease forwards; }

  @keyframes shimmer {
    0%   { opacity: 0.4; }
    50%  { opacity: 0.8; }
    100% { opacity: 0.4; }
  }

  .loading-pulse { animation: shimmer 1.5s ease infinite; }
`;

// ── Micro components ───────────────────────────────────────────────────────
function Tag({ label, color = "var(--copper)" }) {
  return (
    <span className="tag" style={{ color, borderColor: color + "44", background: color + "11" }}>
      {label}
    </span>
  );
}

function MacroRing({ value, max, color, label, unit = "g" }) {
  const pct = Math.min(value / max, 1);
  const r = 26, cx = 32, cy = 32, stroke = 3, circ = 2 * Math.PI * r;
  return (
    <div className="ring-wrap">
      <svg width={64} height={64}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-2)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dasharray 0.7s ease" }} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fill="var(--text)" style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
          {value}
        </text>
      </svg>
      <span className="label">{label}</span>
      <span style={{ fontSize: 8, color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}>
        {unit === "kcal" ? `/${max}` : `/${max}g`}
      </span>
    </div>
  );
}

function SectionTitle({ children, kanji }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <span className="label">{children}</span>
      {kanji && <span className="kanji" style={{ fontSize: 28 }}>{kanji}</span>}
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
  const [editingMeal, setEditingMeal] = useState(null);
  const [editMealVal, setEditMealVal] = useState({ name:"", kcal:"", protein:"", carbs:"", fat:"" });

  const todayLog = log[todayKey()] || { kcal:0, protein:0, carbs:0, fat:0, meals:[] };

  async function generateMeal() {
    setLoading(true); setMeal(null);
    const sys = `You are a sports nutritionist. Fat loss goal. Daily targets: ${targets.kcal}kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat. ${ANTI_BLOAT_NOTES}. Respond ONLY with valid JSON, no markdown. Format: {"name":"","kcal":0,"protein":0,"carbs":0,"fat":0,"ingredients":[{"item":"","amount":""}],"instructions":"","antiInflamNote":""}`;
    const text = await askClaude(sys, `Ingredients: ${ingredients}. Generate a high-protein, anti-bloating meal.`);
    try {
      const clean = text.replace(/```json|```/g,"").trim();
      const jsonMatch = clean.match(/{[\s\S]*}/);
      setMeal(JSON.parse(jsonMatch ? jsonMatch[0] : clean));
    } catch(err) {
      setMeal({ name:"Parse error", kcal:0, protein:0, carbs:0, fat:0, ingredients:[], instructions:text, antiInflamNote:"" });
    }
    setLoading(false);
  }

  function logMeal(m) {
    const key  = todayKey();
    const prev = log[key] || { kcal:0, protein:0, carbs:0, fat:0, meals:[] };
    const updated = {
      kcal: (prev.kcal||0)+(m.kcal||0), protein:(prev.protein||0)+(m.protein||0),
      carbs:(prev.carbs||0)+(m.carbs||0), fat:(prev.fat||0)+(m.fat||0),
      meals:[...(prev.meals||[]), { name:m.name, kcal:m.kcal||0, protein:m.protein||0, carbs:m.carbs||0, fat:m.fat||0 }],
    };
    const newLog = { ...log, [key]: updated };
    setLog(newLog); store.set("nutrition_log", newLog);
  }

  function logManual() {
    logMeal({ name:mealName||"Manual entry", kcal:+logInput.kcal, protein:+logInput.protein, carbs:+logInput.carbs, fat:+logInput.fat });
    setLogInput({ kcal:"", protein:"", carbs:"", fat:"" }); setMealName("");
  }

  function deleteMealEntry(dayKey, idx) {
    const day = log[dayKey]; if (!day) return;
    const removed = day.meals[idx];
    const updated = {
      kcal:day.kcal-(removed.kcal||0), protein:day.protein-(removed.protein||0),
      carbs:day.carbs-(removed.carbs||0), fat:day.fat-(removed.fat||0),
      meals:day.meals.filter((_,i)=>i!==idx),
    };
    const newLog = { ...log, [dayKey]: updated };
    setLog(newLog); store.set("nutrition_log", newLog);
  }

  function startEditMeal(dayKey, idx) {
    const m = log[dayKey]?.meals?.[idx]; if (!m) return;
    setEditingMeal({ dayKey, idx });
    setEditMealVal({ name:m.name||"", kcal:m.kcal||"", protein:m.protein||"", carbs:m.carbs||"", fat:m.fat||"" });
  }

  function saveEditMeal() {
    const { dayKey, idx } = editingMeal;
    const day = log[dayKey], old = day.meals[idx];
    const nw = { name:editMealVal.name, kcal:+editMealVal.kcal, protein:+editMealVal.protein, carbs:+editMealVal.carbs, fat:+editMealVal.fat };
    const updated = {
      kcal:day.kcal-(old.kcal||0)+nw.kcal, protein:day.protein-(old.protein||0)+nw.protein,
      carbs:day.carbs-(old.carbs||0)+nw.carbs, fat:day.fat-(old.fat||0)+nw.fat,
      meals:day.meals.map((m,i)=>i===idx?nw:m),
    };
    const newLog = { ...log, [dayKey]: updated };
    setLog(newLog); store.set("nutrition_log", newLog); setEditingMeal(null);
  }

  const pctKcal = Math.min((todayLog.kcal / targets.kcal) * 100, 100);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Daily overview */}
      <div className="card fade-up">
        <SectionTitle kanji="食">今日 · {todayKey()}</SectionTitle>
        <div style={{ display:"flex", justifyContent:"space-around", padding:"8px 0 16px" }}>
          <MacroRing value={todayLog.kcal}    max={targets.kcal}    color="var(--copper)"  label="kcal" unit="kcal" />
          <MacroRing value={todayLog.protein} max={targets.protein} color="#7fb3d3"         label="protein" />
          <MacroRing value={todayLog.carbs}   max={targets.carbs}   color="#a8c5a0"         label="carbs" />
          <MacroRing value={todayLog.fat}     max={targets.fat}     color="#c9956c"         label="fat" />
        </div>

        {/* Calorie bar */}
        <div style={{ height:1, background:"var(--border)", marginBottom:10, position:"relative" }}>
          <div style={{ position:"absolute", top:0, left:0, height:"100%", width:`${pctKcal}%`, background:"var(--copper-g)", transition:"width 0.5s ease" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:9, color:"var(--text-3)", letterSpacing:2 }}>CONSUMED</span>
          <span style={{ fontSize:9, color:"var(--copper)", letterSpacing:1, fontFamily:"JetBrains Mono" }}>{todayLog.kcal} / {targets.kcal}</span>
        </div>

        {/* Meal list */}
        {(todayLog.meals||[]).length > 0 && (
          <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:6 }}>
            {todayLog.meals.map((m, i) => (
              <div key={i}>
                {editingMeal?.dayKey === todayKey() && editingMeal?.idx === i ? (
                  <div style={{ background:"var(--ink)", border:"1px solid var(--copper-d)", borderRadius:2, padding:12 }}>
                    <input value={editMealVal.name} onChange={e=>setEditMealVal(p=>({...p,name:e.target.value}))}
                      placeholder="Meal name" className="inp" style={{ marginBottom:8 }} />
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      {["kcal","protein","carbs","fat"].map(k=>(
                        <input key={k} type="number" value={editMealVal[k]}
                          onChange={e=>setEditMealVal(p=>({...p,[k]:e.target.value}))}
                          placeholder={k} className="inp" />
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:8 }}>
                      <button onClick={saveEditMeal} className="btn-primary" style={{ marginTop:0 }}>SAVE</button>
                      <button onClick={()=>setEditingMeal(null)} className="btn-ghost" style={{ marginTop:0 }}>CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{m.name}</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        <Tag label={`${m.kcal}kcal`} color="var(--copper)" />
                        <Tag label={`${m.protein}g P`} color="#7fb3d3" />
                        <Tag label={`${m.carbs}g C`} color="#a8c5a0" />
                        <Tag label={`${m.fat}g F`} color="#c9956c" />
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:4, marginLeft:8, flexShrink:0 }}>
                      <button onClick={()=>startEditMeal(todayKey(),i)} style={{ background:"none", border:"1px solid var(--border-2)", color:"var(--mist)", borderRadius:2, padding:"4px 8px", cursor:"pointer", fontSize:11 }}>✎</button>
                      <button onClick={()=>deleteMealEntry(todayKey(),i)} style={{ background:"none", border:"1px solid var(--border-2)", color:"var(--red)", borderRadius:2, padding:"4px 8px", cursor:"pointer", fontSize:11 }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Meal Generator */}
      <div className="card fade-up" style={{ animationDelay:"0.05s" }}>
        <SectionTitle kanji="生">AI MEAL GENERATOR</SectionTitle>
        <textarea value={ingredients} onChange={e=>setIngredients(e.target.value)}
          className="inp" style={{ resize:"vertical", lineHeight:1.7, minHeight:72 }} rows={3} />
        <button onClick={generateMeal} disabled={loading} className="btn-primary">
          <span className={loading ? "loading-pulse" : ""}>{loading ? "生成中..." : "GENERATE  /  生成"}</span>
        </button>

        {meal && (
          <div className="fade-up" style={{ marginTop:20 }}>
            <div className="divider" />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:8, flexWrap:"wrap" }}>
              <div style={{ fontSize:14, color:"var(--text)", fontFamily:"Noto Serif JP, serif", fontWeight:400, letterSpacing:0.5 }}>{meal.name}</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                <Tag label={`${meal.kcal}kcal`} color="var(--copper)" />
                <Tag label={`${meal.protein}g P`} color="#7fb3d3" />
                <Tag label={`${meal.carbs}g C`} color="#a8c5a0" />
                <Tag label={`${meal.fat}g F`} color="#c9956c" />
              </div>
            </div>
            <p style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.8, marginBottom:12 }}>{meal.instructions}</p>
            {meal.antiInflamNote && (
              <div style={{ fontSize:11, color:"#a8c5a0", background:"#a8c5a011", border:"1px solid #a8c5a022", borderRadius:2, padding:"8px 12px", marginBottom:12, lineHeight:1.6 }}>
                {meal.antiInflamNote}
              </div>
            )}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
              {meal.ingredients?.map((ing,i)=>(
                <span key={i} style={{ fontSize:10, color:"var(--ash)", background:"var(--ink)", border:"1px solid var(--border)", borderRadius:2, padding:"3px 8px", fontFamily:"JetBrains Mono" }}>
                  {ing.amount} {ing.item}
                </span>
              ))}
            </div>
            <button onClick={()=>logMeal(meal)} className="btn-primary" style={{ borderColor:"#a8c5a044", color:"#a8c5a0" }}>
              LOG THIS MEAL  /  記録
            </button>
          </div>
        )}
      </div>

      {/* Manual log */}
      <div className="card fade-up" style={{ animationDelay:"0.1s" }}>
        <SectionTitle kanji="手">MANUAL LOG</SectionTitle>
        <input value={mealName} onChange={e=>setMealName(e.target.value)} placeholder="Meal name" className="inp" style={{ marginBottom:8 }} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {["kcal","protein","carbs","fat"].map(k=>(
            <div key={k}>
              <div className="label" style={{ marginBottom:4 }}>{k}</div>
              <input type="number" value={logInput[k]} onChange={e=>setLogInput(p=>({...p,[k]:e.target.value}))} className="inp" />
            </div>
          ))}
        </div>
        <button onClick={logManual} className="btn-primary">LOG ENTRY  /  記録</button>
      </div>
    </div>
  );
}

// ── TRAINING TAB ──────────────────────────────────────────────────────────
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

  const exercises = customWorkouts[selected] || [];
  const doneCount = exercises.filter(e => completed[e.id]).length;
  const pct       = exercises.length ? doneCount / exercises.length : 0;

  function toggleExercise(id) {
    const updated = { ...completed, [id]: !completed[id] };
    setCompleted(updated); store.set(compKey, updated);
    const done = exercises.filter(e => updated[e.id]).length;
    const newLog = { ...sessionLog, [todayKey()]: { ...(sessionLog[todayKey()]||{}), [selected]: { done, total:exercises.length } } };
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

      {/* Day selector */}
      <div className="card fade-up">
        <SectionTitle>週間スケジュール · WEEKLY SPLIT</SectionTitle>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {SPLITS.map(s => (
            <button key={s.label} onClick={()=>switchSplit(s.label)} style={{
              flex:1, minWidth:48, padding:"10px 4px",
              background: selected===s.label ? "var(--copper-d)" : "var(--ink)",
              border: `1px solid ${selected===s.label ? "var(--copper)" : "var(--border)"}`,
              color: selected===s.label ? "var(--copper-l)" : "var(--text-3)",
              borderRadius:2, cursor:"pointer", fontSize:8, fontFamily:"JetBrains Mono",
              letterSpacing:1, transition:"all 0.2s", position:"relative",
            }}>
              {s.day.slice(0,3).toUpperCase()}
              {s.day === todayLabel && (
                <span style={{ position:"absolute", top:4, right:4, width:4, height:4, borderRadius:"50%", background:"var(--copper)" }} />
              )}
            </button>
          ))}
          {["SAT","SUN"].map(d=>(
            <span key={d} style={{ flex:1, minWidth:48, padding:"10px 4px", background:"var(--ink)", border:"1px solid var(--border)", color:"var(--text-3)", borderRadius:2, fontSize:8, fontFamily:"JetBrains Mono", letterSpacing:1, textAlign:"center", opacity:0.4 }}>{d}</span>
          ))}
        </div>
      </div>

      {/* Session card */}
      <div className="card fade-up" style={{ animationDelay:"0.05s" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:24, fontFamily:"Noto Serif JP, serif", fontWeight:300, color:"var(--text)", letterSpacing:2, marginBottom:4 }}>
              {selected}
            </div>
            <div className="label">{SPLITS.find(s=>s.label===selected)?.muscles}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:28, fontFamily:"Noto Serif JP, serif", fontWeight:300, color:"var(--copper)", lineHeight:1 }}>{doneCount}</div>
              <div className="label" style={{ marginTop:2 }}>of {exercises.length}</div>
            </div>
            <span className="kanji" style={{ fontSize:36, opacity:0.12 }}>{SPLIT_KANJI[selected]}</span>
            <button onClick={()=>{setEditMode(e=>!e);setEditingId(null);}} style={{
              background: editMode ? "var(--copper-d)" : "var(--ink)",
              border:`1px solid ${editMode ? "var(--copper)" : "var(--border-2)"}`,
              color: editMode ? "var(--copper)" : "var(--mist)",
              borderRadius:2, padding:"6px 12px", cursor:"pointer",
              fontSize:9, fontFamily:"JetBrains Mono", letterSpacing:1,
            }}>{editMode ? "DONE" : "EDIT"}</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height:1, background:"var(--border)", marginBottom:16 }}>
          <div style={{ height:"100%", width:`${pct*100}%`, background:"var(--copper-g)", transition:"width 0.5s ease" }} />
        </div>

        {/* Exercise list */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {exercises.map(ex => (
            <div key={ex.id}>
              {editingId === ex.id ? (
                <div style={{ background:"var(--ink)", border:"1px solid var(--copper-d)", borderRadius:2, padding:12 }}>
                  <input value={editVal.name} onChange={e=>setEditVal(p=>({...p,name:e.target.value}))} className="inp" style={{ marginBottom:6 }} />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    <input value={editVal.sets} onChange={e=>setEditVal(p=>({...p,sets:e.target.value}))} className="inp" placeholder="Sets" />
                    <input value={editVal.rpe}  onChange={e=>setEditVal(p=>({...p,rpe:e.target.value}))}  className="inp" placeholder="RPE" />
                  </div>
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <button onClick={()=>saveEdit(ex.id)} className="btn-primary" style={{ marginTop:0 }}>SAVE</button>
                    <button onClick={()=>setEditingId(null)} className="btn-ghost" style={{ marginTop:0 }}>CANCEL</button>
                  </div>
                </div>
              ) : (
                <div className={`ex-row ${completed[ex.id] ? "done" : ""}`}
                  onClick={()=>!editMode&&toggleExercise(ex.id)}
                  style={{ cursor: editMode ? "default" : "pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                    {!editMode && (
                      <div className={`checkbox ${completed[ex.id] ? "checked" : ""}`}>
                        {completed[ex.id] && <span style={{ fontSize:9, color:"var(--ink)", fontWeight:700 }}>✓</span>}
                      </div>
                    )}
                    <span style={{ fontSize:13, color: completed[ex.id] ? "var(--text)" : "var(--text-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ex.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
                    <Tag label={ex.sets} color={completed[ex.id] ? "var(--copper)" : "var(--fog)"} />
                    <Tag label={ex.rpe}  color="var(--fog)" />
                    {editMode && (
                      <>
                        <button onClick={e=>{e.stopPropagation();setEditingId(ex.id);setEditVal({name:ex.name,sets:ex.sets,rpe:ex.rpe});}}
                          style={{ background:"none", border:"1px solid var(--border-2)", color:"var(--mist)", borderRadius:2, padding:"3px 8px", cursor:"pointer", fontSize:11 }}>✎</button>
                        <button onClick={e=>{e.stopPropagation();deleteExercise(ex.id);}}
                          style={{ background:"none", border:"1px solid var(--border-2)", color:"var(--red)", borderRadius:2, padding:"3px 8px", cursor:"pointer", fontSize:11 }}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add exercise */}
        {editMode && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
            <div className="label" style={{ marginBottom:10 }}>ADD EXERCISE</div>
            <input value={newEx.name} onChange={e=>setNewEx(p=>({...p,name:e.target.value}))}
              placeholder="Exercise name" className="inp" style={{ marginBottom:6 }}
              onKeyDown={e=>e.key==="Enter"&&addExercise()} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              <input value={newEx.sets} onChange={e=>setNewEx(p=>({...p,sets:e.target.value}))} placeholder="Sets" className="inp" />
              <input value={newEx.rpe}  onChange={e=>setNewEx(p=>({...p,rpe:e.target.value}))}  placeholder="RPE" className="inp" />
            </div>
            <button onClick={addExercise} className="btn-primary">+ ADD TO {selected.toUpperCase()}</button>
            <button onClick={()=>saveCustom({...customWorkouts,[selected]:DEFAULT_WORKOUTS[selected]})} className="btn-ghost">
              RESET TO DEFAULT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PROGRESS TAB ──────────────────────────────────────────────────────────
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

  const W=300, H=56, vals=weightEntries.map(e=>e[1]);
  const wMax=Math.max(...vals,stats.currentWeight+1), wMin=Math.min(...vals,stats.goalWeight-1), wRange=wMax-wMin||1;

  const last7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const k=d.toISOString().slice(0,10); return { day:DAYS_SHORT[d.getDay()], data:log[k]||null }; });
  const weekKeys = currentWeekKeys();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Weight card */}
      <div className="card fade-up">
        <SectionTitle kanji="重">WEIGHT TRACKING</SectionTitle>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <div className="stat-box">
            <div style={{ fontSize:24, fontFamily:"Noto Serif JP, serif", fontWeight:300, color:"var(--copper)" }}>{latest}</div>
            <div className="label" style={{ marginTop:4 }}>kg now</div>
          </div>
          <div className="stat-box">
            <div style={{ fontSize:24, fontFamily:"Noto Serif JP, serif", fontWeight:300, color:"#a8c5a0" }}>-{lost}</div>
            <div className="label" style={{ marginTop:4 }}>kg lost</div>
          </div>
          <div className="stat-box">
            <div style={{ fontSize:24, fontFamily:"Noto Serif JP, serif", fontWeight:300, color:"var(--ash)" }}>{toGoal}</div>
            <div className="label" style={{ marginTop:4 }}>to goal</div>
          </div>
        </div>

        {/* Goal progress */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span className="label">{stats.currentWeight}kg start</span>
            <span className="label" style={{ color:"var(--copper)" }}>{stats.goalWeight}kg 目標</span>
          </div>
          <div style={{ height:1, background:"var(--border)" }}>
            <div style={{ height:"100%", width:`${goalPct*100}%`, background:"var(--copper-g)", transition:"width 0.6s ease" }} />
          </div>
          <div style={{ textAlign:"right", marginTop:4 }}>
            <span style={{ fontSize:9, color:"var(--copper)", fontFamily:"JetBrains Mono" }}>{Math.round(goalPct*100)}%</span>
          </div>
        </div>

        {/* Sparkline */}
        {weightEntries.length > 1 && (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block", margin:"12px 0", opacity:0.8 }}>
            <polyline
              points={weightEntries.map((e,i)=>`${(i/(weightEntries.length-1))*W},${H-((e[1]-wMin)/wRange)*(H-8)-4}`).join(" ")}
              fill="none" stroke="var(--copper)" strokeWidth={1.5} strokeLinejoin="round" opacity={0.6} />
            {weightEntries.map((e,i)=>{
              const x=(i/(weightEntries.length-1))*W, y=H-((e[1]-wMin)/wRange)*(H-8)-4;
              return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--copper)" opacity={0.8} />;
            })}
          </svg>
        )}

        <div style={{ display:"flex", gap:8 }}>
          <input type="number" value={weightInput} onChange={e=>setWeightInput(e.target.value)}
            placeholder="Today's weight (kg)" className="inp" style={{ flex:1 }}
            onKeyDown={e=>e.key==="Enter"&&logWeight()} />
          <button onClick={logWeight} className="btn-primary" style={{ width:"auto", padding:"0 20px", marginTop:0 }}>LOG</button>
        </div>
      </div>

      {/* Nutrition adherence */}
      <div className="card fade-up" style={{ animationDelay:"0.05s" }}>
        <SectionTitle kanji="栄">NUTRITION · 7 DAYS</SectionTitle>
        <div style={{ display:"flex", gap:5, alignItems:"flex-end", height:70 }}>
          {last7.map(({day,data},i)=>{
            const pct=data?Math.min(data.kcal/targets.kcal,1):0;
            const color=pct>0.85&&pct<1.1?"#a8c5a0":pct>0.4?"var(--copper)":"var(--ink-4)";
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                <div style={{ width:"100%", background:"var(--ink)", borderRadius:2, height:56, position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", bottom:0, width:"100%", height:`${pct*100}%`, background:color, transition:"height 0.5s ease", opacity:0.8 }} />
                </div>
                <span style={{ fontSize:8, color:"var(--text-3)", fontFamily:"JetBrains Mono", letterSpacing:1 }}>{day.slice(0,1).toUpperCase()}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          <Tag label="ON TARGET" color="#a8c5a0" />
          <Tag label="PARTIAL" color="var(--copper)" />
          <Tag label="EMPTY" color="var(--fog)" />
        </div>
      </div>

      {/* Sessions this week */}
      <div className="card fade-up" style={{ animationDelay:"0.1s" }}>
        <SectionTitle kanji="週">SESSIONS · THIS WEEK</SectionTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {SPLITS.map((s,i)=>{
            const dateKey=weekKeys[i], sess=sessionLog[dateKey]?.[s.label]||null, pct=sess?sess.done/sess.total:0;
            return (
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:80 }}>
                  <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono", letterSpacing:1 }}>{s.day.slice(0,3).toUpperCase()}</div>
                  <div style={{ fontSize:10, color:"var(--text-2)", fontFamily:"JetBrains Mono" }}>{s.label}</div>
                </div>
                <div style={{ flex:1, height:1, background:"var(--border)", position:"relative" }}>
                  <div style={{ position:"absolute", top:0, left:0, height:"100%", width:`${pct*100}%`, background: pct===1?"var(--copper-g)":"var(--copper-d)", opacity:pct===1?1:0.5, transition:"width 0.4s" }} />
                </div>
                <span style={{ fontSize:10, color:"var(--text-3)", fontFamily:"JetBrains Mono", width:32, textAlign:"right" }}>{sess?`${sess.done}/${sess.total}`:"—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────
function SettingsTab({ targets, setTargets, stats, setStats }) {
  const [tEdit, setTEdit] = useState({ ...targets });
  const [sEdit, setSEdit] = useState({ ...stats });
  const [tSaved, setTSaved] = useState(false);
  const [sSaved, setSSaved] = useState(false);

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

  const totalMacroKcal = (+tEdit.protein*4)+(+tEdit.carbs*4)+(+tEdit.fat*9);
  const macroMatch = Math.abs(totalMacroKcal-(+tEdit.kcal)) < 50;
  const bmi = (+sEdit.currentWeight/((+sEdit.height/100)**2)).toFixed(1);
  const tolose = +sEdit.currentWeight - +sEdit.goalWeight;
  const weeks = tolose > 0 ? Math.ceil(tolose/0.5) : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      <div className="card fade-up">
        <SectionTitle kanji="目">DAILY TARGETS</SectionTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { key:"kcal",    label:"Calories",  unit:"kcal", color:"var(--copper)"  },
            { key:"protein", label:"Protein",   unit:"g",    color:"#7fb3d3"        },
            { key:"carbs",   label:"Carbs",     unit:"g",    color:"#a8c5a0"        },
            { key:"fat",     label:"Fat",       unit:"g",    color:"#c9956c"        },
          ].map(f=>(
            <div key={f.key} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:60 }}>
                <div className="label" style={{ color:f.color }}>{f.label}</div>
                <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono" }}>{f.unit}</div>
              </div>
              <input type="number" value={tEdit[f.key]} onChange={e=>setTEdit(p=>({...p,[f.key]:e.target.value}))}
                className="inp" style={{ flex:1, borderColor:f.color+"33" }} />
            </div>
          ))}
        </div>

        <div style={{ marginTop:14, padding:"10px 14px", background:"var(--ink)", border:"1px solid var(--border)", borderRadius:2 }}>
          <div className="label" style={{ marginBottom:8 }}>MACRO BREAKDOWN</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            <Tag label={`P ${(+tEdit.protein*4).toFixed(0)}`} color="#7fb3d3" />
            <Tag label={`C ${(+tEdit.carbs*4).toFixed(0)}`}   color="#a8c5a0" />
            <Tag label={`F ${(+tEdit.fat*9).toFixed(0)}`}     color="#c9956c" />
            <Tag label={`= ${totalMacroKcal}kcal`} color={macroMatch?"#a8c5a0":"var(--red)"} />
          </div>
          {!macroMatch && (
            <div style={{ fontSize:10, color:"var(--red)", marginTop:8, fontFamily:"JetBrains Mono" }}>
              Δ {Math.abs(totalMacroKcal-(+tEdit.kcal))}kcal mismatch
            </div>
          )}
        </div>

        <button onClick={saveTargets} className="btn-primary"
          style={tSaved?{borderColor:"#a8c5a044",color:"#a8c5a0"}:{}}>
          {tSaved ? "✓ SAVED  /  保存済み" : "SAVE TARGETS  /  保存"}
        </button>
      </div>

      <div className="card fade-up" style={{ animationDelay:"0.05s" }}>
        <SectionTitle kanji="身">PERSONAL STATS</SectionTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { key:"currentWeight", label:"Current weight", unit:"kg" },
            { key:"goalWeight",    label:"Goal weight",    unit:"kg" },
            { key:"height",        label:"Height",         unit:"cm" },
          ].map(f=>(
            <div key={f.key} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:90 }}>
                <div className="label">{f.label}</div>
                <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono" }}>{f.unit}</div>
              </div>
              <input type="number" value={sEdit[f.key]} onChange={e=>setSEdit(p=>({...p,[f.key]:e.target.value}))} className="inp" style={{ flex:1 }} />
            </div>
          ))}
        </div>

        <div style={{ marginTop:14, padding:"10px 14px", background:"var(--ink)", border:"1px solid var(--border)", borderRadius:2 }}>
          <div className="label" style={{ marginBottom:8 }}>ESTIMATES</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            <Tag label={`BMI ${bmi}`} color="var(--copper)" />
            <Tag label={`${tolose}kg`} color="var(--ash)" />
            <Tag label={`~${weeks}w`} color="var(--mist)" />
          </div>
          <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono", marginTop:6 }}>0.5kg/week rate</div>
        </div>

        <button onClick={saveStats} className="btn-primary"
          style={sSaved?{borderColor:"#a8c5a044",color:"#a8c5a0"}:{}}>
          {sSaved ? "✓ SAVED  /  保存済み" : "SAVE STATS  /  保存"}
        </button>
      </div>

      <div className="card fade-up" style={{ animationDelay:"0.1s" }}>
        <SectionTitle kanji="健">ANTI-BLOAT GUIDE</SectionTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { label:"EAT  /  食べる",    color:"#a8c5a0", items:["Eggs","Horse meat","White rice (cooled)","Olive oil","Ginger tea","Black coffee"] },
            { label:"LIMIT  /  控える",  color:"var(--copper)", items:["Peanuts","White bread","Fekkas + Pickers"] },
            { label:"AVOID  /  避ける",  color:"var(--red)", items:["Carbonated drinks","Excess sodium","Fried food","Alcohol"] },
          ].map(g=>(
            <div key={g.label} style={{ padding:"10px 14px", background:"var(--ink)", border:`1px solid ${g.color}22`, borderRadius:2 }}>
              <div className="label" style={{ color:g.color, marginBottom:8 }}>{g.label}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {g.items.map(item=><Tag key={item} label={item} color={g.color} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── COACH TAB ─────────────────────────────────────────────────────────────
function CoachTab({ log, sessionLog, targets, stats }) {
  const [feedback, setFeedback] = useState("");
  const [loading,  setLoading]  = useState(false);

  async function generateFeedback() {
    setLoading(true); setFeedback("");
    const weights    = store.get("weight_log", {});
    const wEntries   = Object.entries(weights).sort(([a],[b])=>a.localeCompare(b));
    const latest     = wEntries[wEntries.length-1]?.[1] || "not logged";
    const nutSummary = Object.entries(log).slice(-7).map(([k,v])=>`${k}: ${v.kcal}kcal, ${v.protein}g protein`).join("; ");
    const sessSummary= Object.entries(sessionLog).slice(-5).map(([k,v])=>`${k}: ${Object.entries(v).map(([s,d])=>`${s} ${d.done}/${d.total}`).join(", ")}`).join("; ");
    const sys  = `You are a no-nonsense fitness coach. User: Khalil, ${stats.currentWeight}kg → ${stats.goalWeight}kg goal, ${stats.height}cm. Daily targets: ${targets.kcal}kcal, ${targets.protein}g protein. Trains Mon–Fri: Push/Pull/Legs/Back+Chest/Upper. Be direct, specific, motivating. No fluff.`;
    const prompt = `Week review. Current weight: ${latest}kg. Nutrition last 7 days: ${nutSummary||"no data"}. Sessions: ${sessSummary||"no data"}. Give a 3-part review: (1) What he nailed, (2) What needs fixing, (3) One specific adjustment for next week.`;
    setFeedback(await askClaude(sys, prompt));
    setLoading(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div className="card fade-up">
        <SectionTitle kanji="師">WEEKLY REVIEW</SectionTitle>
        <p style={{ fontSize:11, color:"var(--text-3)", lineHeight:1.9, marginBottom:4, fontFamily:"JetBrains Mono" }}>
          AI analysis of your logged nutrition, sessions, and weight. Run at end of week.
        </p>
        <button onClick={generateFeedback} disabled={loading} className="btn-primary">
          <span className={loading?"loading-pulse":""}>{loading?"分析中... ANALYZING":"GENERATE REVIEW  /  評価"}</span>
        </button>

        {feedback && (
          <div className="fade-up" style={{ marginTop:20 }}>
            <div className="divider" />
            <div style={{ fontSize:13, color:"var(--text-2)", fontFamily:"JetBrains Mono", lineHeight:1.9, whiteSpace:"pre-wrap" }}>
              {feedback}
            </div>
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
  const todayJP    = new Date().toLocaleDateString("ja-JP", { month:"long", day:"numeric" });
  const todaySplit = SPLITS.find(s => s.day === new Date().toLocaleDateString("en-US", { weekday:"long" }));
  const todayKcal  = nutritionLog[todayKey()]?.kcal || 0;

  const tabs = [
    { id:"nutrition", label:"食  FOOD"    },
    { id:"training",  label:"鍛  TRAIN"   },
    { id:"progress",  label:"進  TRACK"   },
    { id:"coach",     label:"師  COACH"   },
    { id:"settings",  label:"設  SET"     },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--ink)", color:"var(--text)", maxWidth:480, margin:"0 auto" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ padding:"28px 20px 18px", borderBottom:"1px solid var(--border)", position:"relative", overflow:"hidden" }}>
        {/* Background kanji watermark */}
        <div style={{ position:"absolute", right:-10, top:-10, fontSize:120, fontFamily:"Noto Serif JP, serif", color:"var(--copper)", opacity:0.03, lineHeight:1, userSelect:"none", pointerEvents:"none" }}>
          力
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"relative" }}>
          <div>
            <div style={{ fontSize:11, fontFamily:"Noto Serif JP, serif", color:"var(--copper)", letterSpacing:4, marginBottom:4, fontWeight:300 }}>
              カリルOS
            </div>
            <div style={{ fontSize:20, fontFamily:"Noto Serif JP, serif", fontWeight:300, letterSpacing:2, color:"var(--text)" }}>
              KHALIL OS
            </div>
            <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono", letterSpacing:2, marginTop:4 }}>
              {today.toUpperCase()}
            </div>
          </div>

          <div style={{ textAlign:"right" }}>
            {todaySplit ? (
              <>
                <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono", letterSpacing:2, marginBottom:4 }}>TODAY</div>
                <div style={{ fontSize:14, fontFamily:"Noto Serif JP, serif", fontWeight:300, color:"var(--copper)", letterSpacing:2 }}>
                  {todaySplit.label}
                </div>
                <div style={{ fontSize:20, fontFamily:"Noto Serif JP, serif", color:"var(--copper)", opacity:0.4 }}>
                  {SPLIT_KANJI[todaySplit.label]}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono", letterSpacing:2 }}>REST DAY</div>
                <div style={{ fontSize:20, fontFamily:"Noto Serif JP, serif", color:"var(--text-3)", opacity:0.4 }}>休</div>
              </>
            )}
          </div>
        </div>

        {/* Calorie strip */}
        <div style={{ marginTop:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"JetBrains Mono", letterSpacing:2 }}>CALORIES</span>
            <span style={{ fontSize:9, color:"var(--copper)", fontFamily:"JetBrains Mono" }}>
              {todayKcal} <span style={{ color:"var(--text-3)" }}>/ {targets.kcal}</span>
            </span>
          </div>
          <div style={{ height:1, background:"var(--border)" }}>
            <div style={{ height:"100%", width:`${Math.min(todayKcal/targets.kcal*100,100)}%`, background:"var(--copper-g)", transition:"width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`tab-btn ${tab===t.id?"active":""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:16, paddingBottom:52 }}>
        {tab==="nutrition" && <NutritionTab log={nutritionLog} setLog={setNutritionLog} targets={targets} />}
        {tab==="training"  && <TrainingTab  sessionLog={sessionLog} setSessionLog={setSessionLog} />}
        {tab==="progress"  && <ProgressTab  log={nutritionLog} sessionLog={sessionLog} stats={stats} targets={targets} />}
        {tab==="coach"     && <CoachTab     log={nutritionLog} sessionLog={sessionLog} targets={targets} stats={stats} />}
        {tab==="settings"  && <SettingsTab  targets={targets} setTargets={setTargets} stats={stats} setStats={setStats} />}
      </div>
    </div>
  );
}
