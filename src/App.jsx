import { useState, useEffect } from "react";
import MinimalClock from "./MinimalClock.jsx";
import ReceiptResume from "./ReceiptResume.jsx";
import CareerKitPanel from "./components/CareerKitPanel.jsx";
import ImportPanel from "./components/ImportPanel.jsx";
import BlockEditorPanel from "./components/BlockEditorPanel.jsx";
import { useI18n } from "./i18n/I18nProvider.jsx";
import { DATA, PRESETS } from "./cvData.js";
import { withHttps } from "./withHttps.js";
import { trackResumeView, fetchViewCount } from "./lib/trackView.js";

const linkStyle = {
  color: "#2a5cab",
  textDecoration: "none",
  borderBottom: "0.5px solid #aac",
};

const headerLinkStyle = {
  color: "#aab8d9",
  textDecoration: "none",
  borderBottom: "0.5px solid #555",
};


function useCountdowns() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const born       = new Date("2001-01-31");
  const ageYears   = Math.floor((now - born) / 31557600000);
  const echuuDays  = Math.max(0, Math.ceil((new Date("2026-08-01") - now) / 86400000));
  const retireDays = Math.max(0, Math.ceil((new Date("2031-01-31") - now) / 86400000));
  return { age: ageYears, echuuDays, retireDays };
}

function useWindowWidth() {
  const [w, setW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

/* ─────────────────────────────────────────
   LOGO MAP  (grayscale via CSS filter on render)
   ───────────────────────────────────────── */
const LOGOS = {
  "New York University":      "https://logo.clearbit.com/nyu.edu",
  "Donghua University":       "https://www.dhu.edu.cn/images/logo-bak.png",
  "Xiaohongshu (REDnote)":    "https://logo.clearbit.com/xiaohongshu.com",
  "Duolingo":                 "https://logo.clearbit.com/duolingo.com",
  "Mirror World / rct.ai":    "https://logo.clearbit.com/rct.ai",
};

/* ─────────────────────────────────────────
   RENDER ITEMS
   ───────────────────────────────────────── */
function RenderContent({ c, visible, editing }) {
  if (!visible && !editing) return null;
  const f = "'IBM Plex Mono', monospace";
  const o = visible ? 1 : 0.22;

  /* typography atoms */
  const T  = ({ children, s }) => (
    <span style={{ fontFamily:f, fontSize:9.5, fontWeight:600, color:"#0a0a0a", letterSpacing:"0.01em", ...s }}>{children}</span>
  );
  const Sub = ({ children, s }) => (
    <span style={{ fontFamily:f, fontSize:8.5, fontWeight:400, color:"#666", letterSpacing:"0.01em", ...s }}>{children}</span>
  );
  const Meta = ({ children, s }) => (
    <span style={{ fontFamily:f, fontSize:7.5, color:"#999", letterSpacing:"0.04em", whiteSpace:"nowrap", ...s }}>{children}</span>
  );
  /* bullet row: › flush-left, text indented */
  const Bullet = ({ children }) => (
    <div style={{ display:"flex", gap:6, marginTop:2 }}>
      <span style={{ fontFamily:f, fontSize:9, color:"#bbb", lineHeight:1.55, flexShrink:0, marginTop:"0.5px" }}>›</span>
      <span style={{ fontFamily:f, fontSize:8.5, color:"#444", lineHeight:1.58 }}>{children}</span>
    </div>
  );
  /* divider row below name+date */
  const EntryHead = ({ left, right, logo }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  borderBottom:"1px solid #e8e5df", paddingBottom:3, marginBottom:3 }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", flex:1 }}>
        {logo && (
          <img src={logo} alt="" height="13"
               style={{ filter:"grayscale(1) contrast(0.7) opacity(0.6)",
                        objectFit:"contain", flexShrink:0, maxWidth:36 }}
               onError={e=>{ e.target.style.display="none"; }}/>
        )}
        <div style={{ display:"flex", alignItems:"baseline", flexWrap:"wrap", gap:5 }}>{left}</div>
      </div>
      {right && <Meta s={{ marginLeft:8 }}>{right}</Meta>}
    </div>
  );

  switch (c.type) {

    case "text":
      return (
        <div style={{ opacity:o, fontFamily:f, fontSize:8.5, color:"#444", lineHeight:1.65,
                      marginBottom:6, textAlign:"justify" }}>
          {c.text}
        </div>
      );

    case "edu":
      return (
        <div style={{ opacity:o, marginBottom:9 }}>
          <EntryHead
            logo={LOGOS[c.school]}
            left={<><T>{c.school}</T><Sub s={{ color:"#777" }}> · {c.program}</Sub></>}
            right={`${c.date} · ${c.loc}`}
          />
          {c.details.map((d,i) => <Bullet key={i}>{d}</Bullet>)}
        </div>
      );

    case "work":
      return (
        <div style={{ opacity:o, marginBottom:9 }}>
          <EntryHead
            logo={LOGOS[c.co]}
            left={<><T>{c.co}</T><Sub s={{ color:"#666" }}> [{c.role}]</Sub></>}
            right={`${c.date} · ${c.loc}`}
          />
          {Array.isArray(c.links) && c.links.length > 0 && (
            <div style={{ fontFamily:f, fontSize:7.5, marginBottom:4, display:"flex", flexWrap:"wrap", gap:"6px 12px" }}>
              {c.links.map((L, i) => (
                <a key={i} href={L.url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle }}>
                  {L.label}
                </a>
              ))}
            </div>
          )}
          {c.bullets.map((b,i) => <Bullet key={i}>{b}</Bullet>)}
        </div>
      );

    case "proj":
      return (
        <div style={{ opacity:o, marginBottom:9 }}>
          <EntryHead
            left={<><T>{c.name}</T><Sub s={{ fontSize:8, color:"#888" }}> ({c.sub})</Sub></>}
            right={c.date}
          />
          {(c.url || (Array.isArray(c.links) && c.links.length > 0)) && (
            <div style={{ fontFamily:f, fontSize:7.5, marginBottom:4, letterSpacing:"0.03em", display:"flex", flexWrap:"wrap", gap:"6px 12px", alignItems:"baseline" }}>
              {c.url ? (
                <a href={withHttps(c.url)} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle }}>
                  {withHttps(c.url).replace(/^https?:\/\//i, "")}
                </a>
              ) : null}
              {Array.isArray(c.links) && c.links.map((L, i) => (
                <a key={i} href={L.url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle }}>
                  {L.label}
                </a>
              ))}
            </div>
          )}
          {c.bullets.map((b,i) => <Bullet key={i}>{b}</Bullet>)}
        </div>
      );

    case "pub":
      return (
        <div style={{ opacity:o, marginBottom:8, display:"flex", gap:9 }}>
          <div style={{ width:2, background:"#1a1a1a", flexShrink:0, borderRadius:1 }}/>
          <div>
            <div style={{ fontFamily:f, fontSize:9, fontWeight:600, color:"#0a0a0a",
                          letterSpacing:"0.005em", lineHeight:1.45 }}>
              {c.href ? (
                <a href={c.href} target="_blank" rel="noopener noreferrer"
                   style={{ color:"#0a0a0a", textDecoration:"none", borderBottom:"0.5px solid #888" }}>
                  {c.title}
                </a>
              ) : c.title}
            </div>
            <div style={{ fontFamily:f, fontSize:7.5, color:"#777", marginTop:2, lineHeight:1.5 }}>
              {c.venue} <span style={{ color:"#ccc" }}>·</span> {c.authors}
            </div>
            {Array.isArray(c.links) && c.links.length > 0 && (
              <div style={{ fontFamily:f, fontSize:7.5, marginTop:4, display:"flex", flexWrap:"wrap", gap:"6px 12px" }}>
                {c.links.map((L, i) => (
                  <a key={i} href={L.url} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle }}>
                    {L.label}
                  </a>
                ))}
              </div>
            )}
            {c.note && (
              <div style={{ fontFamily:f, fontSize:7.5, fontWeight:600, color:"#1a1a1a",
                            background:"#e8eaed", display:"inline-block", padding:"1px 5px",
                            marginTop:3, letterSpacing:"0.02em" }}>
                {c.note}
              </div>
            )}
          </div>
        </div>
      );

    case "ln":
      return (
        <div style={{ opacity:o, display:"flex", justifyContent:"space-between",
                      alignItems:"baseline", marginBottom:3, gap:8 }}>
          <span style={{ fontFamily:f, fontSize:8.5, color:"#333" }}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                 style={{ color:"#333", textDecoration:"none", borderBottom:"0.5px solid #aaa" }}>
                {c.l}
              </a>
            ) : c.l}
          </span>
          {c.r && <Meta s={{ color:"#888" }}>{c.r}</Meta>}
        </div>
      );

    case "kv":
      return (
        <div style={{ opacity:o, display:"flex", gap:12, alignItems:"baseline", marginBottom:3 }}>
          <span style={{ fontFamily:f, fontSize:7.5, fontWeight:600, color:"#0a0a0a",
                         letterSpacing:"0.07em", minWidth:98, flexShrink:0 }}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                 style={{ color:"#0a0a0a", textDecoration:"none",
                          borderBottom:"0.5px solid #aaa", paddingBottom:1 }}>
                {c.k}
              </a>
            ) : c.k}
          </span>
          <span style={{ fontFamily:f, fontSize:8.5, color:"#555" }}>{c.v}</span>
        </div>
      );

    default: return null;
  }
}

function Grip() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12"
         style={{ opacity:0.25, cursor:"grab", flexShrink:0 }}>
      {[1,4.5,8,11.5].map((y,i) =>
        <g key={i}>
          <circle cx="2"   cy={y} r=".85" fill="currentColor"/>
          <circle cx="5.5" cy={y} r=".85" fill="currentColor"/>
        </g>
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────
   APP
   ───────────────────────────────────────── */
const sidebarLabelStyle = {
  fontSize: 6.5,
  fontWeight: 600,
  letterSpacing: "0.18em",
  color: "#bbb",
  marginBottom: 6,
  display: "block",
};

const sidebarInputStyle = {
  width: "100%",
  border: "1px solid #ccc",
  background: "#fff",
  padding: "6px 8px",
  fontSize: 8,
  fontFamily: "inherit",
  borderRadius: 0,
  resize: "vertical",
  minHeight: 56,
  boxSizing: "border-box",
};

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const [data,    setData]    = useState(DATA);
  const [editing, setEditing] = useState(true);
  const [preset,  setPreset]  = useState("full");
  const [dragS,   setDragS]   = useState(null);
  const [overS,   setOverS]   = useState(null);
  const [dragI,   setDragI]   = useState(null);
  const [overI,   setOverI]   = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewCount, setViewCount] = useState(null);
  const [viewsStorage, setViewsStorage] = useState("");
  const winW = useWindowWidth();
  const isMobile = winW < 768;
  const useSidebarDock = winW >= 1080;
  const { age, echuuDays, retireDays } = useCountdowns();
  const f = "'IBM Plex Mono', monospace";

  useEffect(() => {
    if (winW >= 1080) setSidebarOpen(true);
    else if (winW >= 768) setSidebarOpen(false);
  }, [winW]);

  useEffect(() => {
    trackResumeView()
      .then((r) => {
        if (r?.count != null) {
          setViewCount(r.count);
          setViewsStorage(r.storage ?? "");
        }
      })
      .catch(() => {
        fetchViewCount()
          .then((r) => {
            if (r?.count != null) {
              setViewCount(r.count);
              setViewsStorage(r.storage ?? "");
            }
          })
          .catch(() => {});
      });
  }, []);

  /* preset */
  const applyPreset = (k) => {
    setPreset(k);
    if (k === "full") {
      setData(p => ({ ...p, sections: p.sections.map(s => ({
        ...s, visible:true, items:s.items.map(i=>({...i,visible:true}))
      }))}));
    } else {
      const order = PRESETS[k].secs;
      setData(p => {
        const sorted = [...p.sections].sort((a,b) => {
          const ia=order.indexOf(a.id), ib=order.indexOf(b.id);
          return (ia===-1?999:ia)-(ib===-1?999:ib);
        });
        return { ...p, sections: sorted.map(s=>({
          ...s, visible:order.includes(s.id),
          items:s.items.map(i=>({...i,visible:order.includes(s.id)}))
        }))};
      });
    }
  };

  const tog  = (i)     => { setData(p=>({...p,sections:p.sections.map((s,j)=>j===i?{...s,visible:!s.visible}:s)})); setPreset(null); };
  const togI = (si,ii) => { setData(p=>({...p,sections:p.sections.map((s,j)=>j===si?{...s,items:s.items.map((t,k)=>k===ii?{...t,visible:!t.visible}:t)}:s)})); setPreset(null); };
  const mv   = (i,d)   => { setData(p=>{ const a=[...p.sections],t=i+d; if(t<0||t>=a.length)return p; [a[i],a[t]]=[a[t],a[i]]; return{...p,sections:a}; }); setPreset(null); };

  const onSD  = (e,i)     => { setDragS(i); e.dataTransfer.effectAllowed="move"; };
  const onSO  = (e,i)     => { e.preventDefault(); if(dragS!==null)setOverS(i); };
  const onSP  = (e,i)     => { e.preventDefault(); if(dragS!==null&&dragS!==i){ setData(p=>{const a=[...p.sections];const[m]=a.splice(dragS,1);a.splice(i,0,m);return{...p,sections:a};}); setPreset(null); } setDragS(null); setOverS(null); };
  const onID  = (e,si,ii) => { e.stopPropagation(); setDragI({si,ii}); e.dataTransfer.effectAllowed="move"; };
  const onIO  = (e,si,ii) => { e.preventDefault(); e.stopPropagation(); if(dragI?.si===si)setOverI({si,ii}); };
  const onIPr = (e,si,ii) => { e.preventDefault(); e.stopPropagation(); if(dragI?.si===si&&dragI.ii!==ii){ setData(p=>{const ss=[...p.sections];const its=[...ss[si].items];const[m]=its.splice(dragI.ii,1);its.splice(ii,0,m);ss[si]={...ss[si],items:its};return{...p,sections:ss};}); setPreset(null); } setDragI(null); setOverI(null); };

  const handlePrint = () => { setEditing(false); setTimeout(()=>{ window.print(); setTimeout(()=>setEditing(true),400); },250); };

  /* button styles */
  const btn  = { border:"1px solid #bbb", background:"transparent", padding:"4px 9px", fontSize:7.5, fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", borderRadius:0, fontFamily:f, color:"#555", transition:"all 0.12s" };
  const btnA = { ...btn, background:"#0a0a0a", color:"#f4f5f7", borderColor:"#0a0a0a" };

  /* counters data */
  const counters = [
    { label:"AGE",              val:age,                        unit:"years old"     },
    { label:"ECHUU ↗ 2026.08", val:echuuDays.toLocaleString(), unit:"days remaining" },
    { label:"RETIREMENT",       val:retireDays.toLocaleString(),unit:"days remaining" },
  ];

  return (
    <>
      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:#c6c8cc; font-family:'IBM Plex Mono',monospace; -webkit-font-smoothing:antialiased; }

        @page { size:A4; margin:10mm 12mm; }
        @media print {
          html, body { background:#fff !important; }
          .no-print  { display:none !important; }
          .cv-page   { margin:0 !important; box-shadow:none !important; background:#fff !important;
                       width:100% !important; max-width:100% !important; min-height:auto !important;
                       border:none !important; }
          .cv-body   { padding:0 !important; }
        }

        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:#b8b5af; }
        .drop-target { border-top:2px solid #0a0a0a !important; }
        .sidebar-btn:hover { background:#0a0a0a !important; color:#f4f5f7 !important; }

        .cv-header-block {
          display:flex;
          justify-content:space-between;
          align-items:stretch;
          gap:20px;
        }
        .cv-contact-grid { border-left:1px solid #252525; padding-left:20px; }
        @media (max-width: 900px) {
          .cv-header-block {
            flex-direction:column;
            align-items:stretch;
          }
          .cv-contact-grid {
            border-left:none !important;
            padding-left:0 !important;
            padding-top:16px;
            border-top:1px solid #252525;
          }
        }
        .spec-bar-row {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .spec-bar-meta { display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
        @media (max-width: 720px) {
          .spec-bar-meta { flex-direction:column; align-items:flex-start; gap:6px; }
        }
        .metrics-wrap {
          overflow-x:auto;
          -webkit-overflow-scrolling:touch;
          margin-bottom:14px;
        }
        .metrics-panel {
          display:grid;
          grid-template-columns:1fr 1fr 1fr 1.2fr;
          min-width:520px;
        }
        .cv-body {
          padding:32px 38px 38px;
        }
        @media (max-width: 600px) {
          .cv-body { padding:18px 14px 22px; }
        }
        .mobile-receipt-root { display:none; }
        @media (max-width: 767px) {
          .desktop-shell { display:none !important; }
          .mobile-receipt-root { display:block !important; }
          html, body { background:#070707 !important; }
        }

        .desktop-layout {
          min-height: 100vh;
          width: 100%;
        }
        .desktop-layout--dock {
          display: flex;
          align-items: stretch;
        }
        .desktop-main {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-width: 0;
          width: 100%;
          padding: 40px clamp(28px, 6vw, 80px) 64px;
          box-sizing: border-box;
        }
        .desktop-shell.cv-page {
          margin: 0 auto !important;
          width: 794px;
          max-width: 100%;
          flex-shrink: 0;
        }
        @media (min-width: 768px) {
          html, body { background: #b8bcc4; }
        }
        @media (min-width: 768px) and (max-width: 1079px) {
          .desktop-main--overlay-pad {
            padding-left: calc(300px + clamp(16px, 4vw, 48px));
          }
        }
        @media (max-width: 900px) {
          .desktop-main { padding-top: 28px; padding-bottom: 48px; }
        }
      `}</style>

      {isMobile && (
        <ReceiptResume data={data} withHttps={withHttps} />
      )}

      {!isMobile && (
      <div className={`desktop-layout${editing && useSidebarDock ? " desktop-layout--dock" : ""}`}>
      {editing && !useSidebarDock && sidebarOpen && (
        <div
          className="no-print"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.38)", zIndex:280,
          }}
        />
      )}
      {editing && (useSidebarDock || sidebarOpen) && (
        <aside className="no-print" style={{
          ...(useSidebarDock
            ? {
                position: "sticky",
                top: 0,
                alignSelf: "flex-start",
                flexShrink: 0,
                height: "100vh",
                zIndex: 100,
              }
            : {
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 290,
                boxShadow: "8px 0 24px rgba(0,0,0,0.15)",
              }),
          width: 300,
          background:"#f0f2f4", borderRight:"1px solid #d6d8dc",
          padding:"16px 12px", overflowY:"auto",
          fontFamily:f,
        }}>
          {!useSidebarDock && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              style={{ ...btnA, width:"100%", padding:"6px", fontSize:7.5, marginBottom:10 }}
            >
              {t("collapse")}
            </button>
          )}
          {/* title */}
          <div style={{ fontSize:7, fontWeight:600, letterSpacing:"0.28em", color:"#aaa", marginBottom:14 }}>
            {t("controlPanel")}
          </div>

          <ImportPanel
            data={data}
            setData={setData}
            setPreset={setPreset}
            btn={btn}
            btnA={btnA}
            labelStyle={sidebarLabelStyle}
            inputStyle={sidebarInputStyle}
          />

          <BlockEditorPanel
            data={data}
            setData={setData}
            setPreset={setPreset}
            btn={btn}
            btnA={btnA}
            labelStyle={sidebarLabelStyle}
            inputStyle={sidebarInputStyle}
          />

          <div style={{ fontSize:6.5, fontWeight:600, letterSpacing:"0.18em", color:"#bbb", marginBottom:6 }}>
            {t("audience")}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:16 }}>
            {Object.entries(PRESETS).map(([k,v]) => (
              <button key={k} className="sidebar-btn" onClick={()=>applyPreset(k)}
                      style={preset===k ? btnA : btn}>
                {v.label}
              </button>
            ))}
          </div>

          {/* sections list */}
          <div style={{ fontSize:6.5, fontWeight:600, letterSpacing:"0.18em", color:"#bbb", marginBottom:6 }}>
            {t("sections")}
          </div>
          {data.sections.map((s,si) => (
            <div key={s.id}
              draggable
              onDragStart={e=>onSD(e,si)} onDragOver={e=>onSO(e,si)}
              onDrop={e=>onSP(e,si)} onDragEnd={()=>{ setDragS(null); setOverS(null); }}
              className={overS===si&&dragS!==null?"drop-target":""}
              style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 2px",
                       opacity:dragS===si?0.2:1, borderTop:"1px solid transparent" }}>
              <Grip/>
              <input type="checkbox" checked={s.visible} onChange={()=>tog(si)}
                     style={{ accentColor:"#0a0a0a", width:9, height:9 }}/>
              <span style={{ fontSize:7.5, color:s.visible?"#333":"#bbb", flex:1, letterSpacing:"0.04em" }}>
                {s.title}
              </span>
              <span onClick={()=>mv(si,-1)} style={{ cursor:"pointer", fontSize:9, color:"#bbb", padding:"0 2px", lineHeight:1 }}>↑</span>
              <span onClick={()=>mv(si, 1)} style={{ cursor:"pointer", fontSize:9, color:"#bbb", padding:"0 2px", lineHeight:1 }}>↓</span>
            </div>
          ))}

          <CareerKitPanel
            data={data}
            setData={setData}
            setPreset={setPreset}
            btn={btn}
            btnA={btnA}
            viewCount={viewCount}
            viewsStorage={viewsStorage}
          />

          {/* actions */}
          <div style={{ borderTop:"1px solid #d6d8dc", marginTop:14, paddingTop:12, display:"flex", flexDirection:"column", gap:4 }}>
            <button onClick={handlePrint}         style={{ ...btnA, width:"100%", padding:"7px", fontSize:7.5 }}>{t("exportPdf")}</button>
            <button onClick={()=>setEditing(false)} style={{ ...btn,  width:"100%", padding:"7px", fontSize:7.5 }}>{t("previewMode")}</button>
          </div>
        </aside>
      )}

      <main
        className={`desktop-main${
          editing && !useSidebarDock && sidebarOpen ? " desktop-main--overlay-pad" : ""
        }`}
      >
      <div
        className="desktop-shell cv-page"
        style={{
          background:"#f7f8fa",
          minHeight:"min(100vh, 100%)",
          boxShadow:"0 20px 70px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.06)",
          border:"1px solid #1a1a1a",
        }}
      >
        <div className="cv-body">

          {/* ── HEADER: BLACK BLOCK ── */}
          <div
            className="cv-header-block"
            style={{
            background:"#0a0a0a",
            padding:"20px 24px",
            marginBottom:0,
            borderTop:"3px solid #2a2a2a"
          }}>
            {/* left: name + ID */}
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
              <div style={{ fontFamily:f, fontSize:27, fontWeight:300, letterSpacing:"0.32em",
                            color:"#f4f5f7", lineHeight:1 }}>
                {data.meta.name}
              </div>
              <div style={{ fontFamily:f, fontSize:7.5, fontWeight:500, color:"#555",
                            letterSpacing:"0.22em", marginTop:9 }}>
                ID · {data.meta.alias} · SPEC-01
              </div>
            </div>

            {/* right: contact — clean label grid */}
            <div className="cv-contact-grid" style={{
              display:"flex",
              flexDirection:"column",
              justifyContent:"center",
              gap:3
            }}>
              {[
                ["TEL", data.meta.contact.phone, null],
                ["EML", data.meta.contact.email, `mailto:${data.meta.contact.email}`],
                ["ALT", data.meta.contact.emailAlt, `mailto:${data.meta.contact.emailAlt}`],
                ["WEB", withHttps(data.meta.contact.web).replace(/^https?:\/\//i, "").replace(/\/$/, ""), withHttps(data.meta.contact.web)],
                ["SCH", "Google Scholar", withHttps(data.meta.contact.scholar)],
                ["X", "Twitter / X", data.meta.contact.twitter],
                ["IG", "Instagram", data.meta.contact.instagram],
                ["LOC", data.meta.contact.loc, null],
              ].map(([lbl, val, href]) => (
                <div key={lbl} style={{ display:"flex", gap:8, alignItems:"baseline" }}>
                  <span style={{ fontFamily:f, fontSize:6.5, fontWeight:600,
                                 color:"#444", letterSpacing:"0.12em", minWidth:24 }}>
                    {lbl}
                  </span>
                  {href ? (
                    <a
                      href={href}
                      {...(href.startsWith("mailto") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                      style={{ fontFamily:f, fontSize:7.5, letterSpacing:"0.03em", ...headerLinkStyle }}
                    >
                      {val}
                    </a>
                  ) : (
                    <span style={{ fontFamily:f, fontSize:7.5, color:"#999", letterSpacing:"0.03em" }}>
                      {val}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── SPEC BAR ── */}
          <div className="spec-bar-row" style={{
            background:"#161616",
            padding:"5px 24px",
            marginBottom:8
          }}>
            <div style={{ fontFamily:f, fontSize:7, letterSpacing:"0.16em", color:"#555",
                          display:"flex", gap:0, alignItems:"center", flexWrap:"wrap" }}>
              {["AI CREATIVE TECHNOLOGIST","PRODUCT DESIGNER","MEDIA ARTIST"].map((t,i,arr) => (
                <span key={t}>
                  {t}
                  {i < arr.length-1 &&
                    <span style={{ margin:"0 10px", color:"#333" }}>·</span>}
                </span>
              ))}
            </div>
            <div className="spec-bar-meta" style={{ fontFamily:f, fontSize:6.5, color:"#3a3a3a", letterSpacing:"0.06em" }}>
              <span>GS: <b style={{ color:"#666" }}>65</b> cited</span>
              <span>h-index <b style={{ color:"#666" }}>3</b></span>
              {viewCount != null && (
                <span>VIEWS <b style={{ color:"#666" }}>{viewCount.toLocaleString()}</b></span>
              )}
              <span style={{ color:"#2a2a2a" }}>{new Date().getFullYear()}.{String(new Date().getMonth()+1).padStart(2,"0")} · ARCHIVE</span>
            </div>
          </div>

          <MinimalClock
            portfolioUrl={withHttps(data.meta.contact.web)}
            socialUrl={data.meta.contact.twitter}
          />

          {/* ── METRICS PANEL ── */}
          <div className="metrics-wrap">
          <div className="metrics-panel" style={{
            border:"1px solid #1a1a1a",
            background:"#eff0f2",
            overflow:"hidden"
          }}>
            {/* header row */}
            {["AGE", "ECHUU ↗ 2026.08", "RETIREMENT", "ENDGAME"].map((h,i,arr) => (
              <div key={h} style={{
                fontFamily:f, fontSize:6.5, fontWeight:600, letterSpacing:"0.14em", color:"#888",
                padding:"5px 12px 4px",
                borderRight: i<arr.length-1 ? "1px solid #d4d6d9" : "none",
                borderBottom:"1px solid #d4d6d9",
                background:"#e6e8eb"
              }}>
                {h}
              </div>
            ))}
            {/* value row */}
            {counters.map((c,i) => (
              <div key={i} style={{
                padding:"6px 12px 8px",
                borderRight:"1px solid #d4d6d9"
              }}>
                <div style={{ fontFamily:f, fontSize:19, fontWeight:300, color:"#0a0a0a",
                              lineHeight:1.15, letterSpacing:"-0.01em" }}>
                  {c.val}
                </div>
                <div style={{ fontFamily:f, fontSize:6.5, color:"#aaa", marginTop:1, letterSpacing:"0.03em" }}>
                  {c.unit}
                </div>
              </div>
            ))}
            <div style={{ padding:"6px 12px 8px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
              <div style={{ fontFamily:f, fontSize:10.5, color:"#0a0a0a", lineHeight:1.3 }}>
                隐居深山老林
              </div>
              <div style={{ fontFamily:f, fontSize:7, color:"#aaa", marginTop:2, letterSpacing:"0.02em" }}>
                hermit_in_the_mountains.exe
              </div>
            </div>
          </div>
          </div>

          {/* ── SECTIONS ── */}
          {data.sections.filter(s => s.visible || editing).map(section => {
            const si = data.sections.indexOf(section);
            if (!section.visible && !editing) return null;
            const vis = section.items.filter(it => it.visible || editing);
            if (!vis.length && !editing) return null;
            return (
              <div key={section.id} style={{ marginBottom:12, opacity:section.visible?1:0.2, transition:"opacity 0.15s" }}>
                {/* section header */}
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  borderBottom:"1px solid #0a0a0a", paddingBottom:3, marginBottom:6
                }}>
                  <span style={{ fontFamily:f, fontSize:7.5, fontWeight:600,
                                 letterSpacing:"0.38em", color:"#0a0a0a" }}>
                    {section.title}
                  </span>
                  <span style={{ fontFamily:f, fontSize:6.5, color:"#bbb",
                                 fontWeight:500, letterSpacing:"0.06em" }}>
                    _{String(si+1).padStart(2,"0")}
                  </span>
                </div>

                {/* items */}
                {vis.map(item => {
                  const ii = section.items.indexOf(item);
                  return (
                    <div key={item.id}
                      draggable={editing && section.items.length > 1}
                      onDragStart={e=>editing&&onID(e,si,ii)}
                      onDragOver ={e=>editing&&onIO(e,si,ii)}
                      onDrop     ={e=>editing&&onIPr(e,si,ii)}
                      onDragEnd  ={()=>{ setDragI(null); setOverI(null); }}
                      className  ={overI?.si===si&&overI?.ii===ii?"drop-target":""}
                      style={{ display:"flex", alignItems:"flex-start", gap:3,
                               borderTop:"1px solid transparent" }}>
                      {editing && section.items.length > 1 && (
                        <div className="no-print"
                             style={{ display:"flex", alignItems:"center", gap:2,
                                      paddingTop:2, flexShrink:0 }}>
                          <Grip/>
                          <input type="checkbox" checked={item.visible}
                                 onChange={()=>togI(si,ii)}
                                 style={{ accentColor:"#0a0a0a", width:8, height:8 }}/>
                        </div>
                      )}
                      <div style={{ flex:1 }}>
                        <RenderContent c={item.content} visible={item.visible} editing={editing}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── FOOTER ── */}
          <div style={{
            borderTop:"1.5px solid #0a0a0a", paddingTop:6, marginTop:18,
            display:"flex", justifyContent:"space-between", alignItems:"center"
          }}>
            <span style={{ fontFamily:f, fontSize:6.5, color:"#0a0a0a",
                           fontWeight:600, letterSpacing:"0.1em" }}>
              YIHUA LI (CORY) ── SPECIFICATION MATRIX · {new Date().getFullYear()}
            </span>
            <a
              href={withHttps(data.meta.contact.web)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily:f, fontSize:6.5, color:"#0a0a0a",
                     letterSpacing:"0.06em", textDecoration:"underline" }}
            >
              {withHttps(data.meta.contact.web).replace(/^https?:\/\//i, "").replace(/\/$/, "")}
            </a>
          </div>

        </div>
      </div>
      </main>
      </div>
      )}

      {!isMobile && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 320,
            display: "flex",
            gap: 4,
            fontFamily: f,
          }}
        >
          {["zh", "en"].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              style={{
                ...(locale === l ? btnA : btn),
                padding: "6px 12px",
                fontSize: 7.5,
                letterSpacing: "0.12em",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              {l === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
      )}

      {!editing && !isMobile && (
        <button className="no-print" onClick={()=>setEditing(true)}
                style={{ ...btnA, position:"fixed", bottom:16, right:16, zIndex:200,
                          padding:"6px 14px", fontSize:7.5, boxShadow:"0 2px 10px rgba(0,0,0,0.18)" }}>
          {t("enterEditor")}
        </button>
      )}

      {editing && !isMobile && !useSidebarDock && !sidebarOpen && (
        <button
          type="button"
          className="no-print"
          onClick={() => setSidebarOpen(true)}
          style={{
            ...btnA,
            position:"fixed",
            bottom:16,
            left:16,
            zIndex:200,
            padding:"6px 12px",
            fontSize:7.5,
            boxShadow:"0 2px 10px rgba(0,0,0,0.18)",
          }}
        >
          {t("openPanel")}
        </button>
      )}
    </>
  );
}
