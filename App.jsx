import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, Component } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import * as XLSX from "xlsx";
import { GAP_CATS, GAP_QUESTIONS, MULTI_SELECT } from "./gapData.js";
import {
  Shield, LayoutDashboard, ClipboardCheck, AlertTriangle, Server, Users,
  Bug, GraduationCap, FileSearch, Upload, ChevronRight, ChevronLeft,
  Plus, X, Download, Eye, EyeOff, Search, CheckCircle, Clock,
  XCircle, AlertCircle, Trash2, Edit3, Save, Link, FileText,
  Monitor, Wifi, Database, ArrowLeft, ArrowRight, FolderOpen,
  Target, ListChecks, Paperclip, File, Image, FileSpreadsheet, LogOut, Mail, Lock, Loader
} from "lucide-react";

// Error Boundary to prevent blank pages
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("ISMS Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (<div style={{padding:40,textAlign:"center",fontFamily:"'DM Sans',sans-serif",color:"#F8FAFC",background:"#0B1120",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div><div style={{fontSize:48,marginBottom:16}}>⚠️</div><h2 style={{color:"#F97316",marginBottom:8}}>Something went wrong</h2><p style={{color:"#94A3B8",marginBottom:16}}>{this.state.error?.message||"An unexpected error occurred"}</p>
        <button onClick={()=>{this.setState({hasError:false,error:null});}} style={{padding:"10px 24px",background:"#F97316",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit"}}>Try Again</button>
        <button onClick={()=>{localStorage.clear();window.location.reload();}} style={{padding:"10px 24px",background:"transparent",color:"#EF4444",border:"1px solid #EF4444",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",marginLeft:8}}>Reset & Reload</button>
        </div></div>);
    }
    return this.props.children;
  }
}

// =============================================
// SUPABASE CONFIG
// =============================================
const SUPA_URL = "https://azhefperkfadnbgmkdvw.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6aGVmcGVya2ZhZG5iZ21rZHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDg5ODMsImV4cCI6MjA4NTkyNDk4M30.DiPn2u0EDAxRzZSn4N1QdzIQijGXqOTB-wRXb1uK_co";

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

// =============================================
// SUPABASE API HELPERS
// =============================================
const safeFetch = async (url, options = {}) => {
  try { return await fetch(url, options); }
  catch (e) {
    if (e.message === "Failed to fetch" || e.name === "TypeError") {
      throw new Error("Cannot connect to server. This may be due to:\n• Browser security restrictions (try opening the app in a new tab)\n• Supabase project may be paused (check your Supabase dashboard)\n• Network connectivity issue");
    }
    throw e;
  }
};

const supaAuth = async (path, body) => {
  const r = await safeFetch(`${SUPA_URL}/auth/v1/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPA_KEY }, body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok && !data.access_token) throw new Error(data.error_description || data.msg || data.error?.message || `Auth error (${r.status})`);
  return data;
};

const supaDB = async (token, method, query = "", body = null, headers = {}) => {
  const h = { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...headers };
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await safeFetch(`${SUPA_URL}/rest/v1/isms_state${query}`, opts);
  if (r.status === 204 || r.status === 201) return null;
  const data = await r.json();
  if (!r.ok) { console.warn("DB error:", data); return []; }
  return data;
};

const uploadToStorage = async (token, userId, module, file) => {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${module}/${Date.now()}_${safe}`;
  const r = await safeFetch(`${SUPA_URL}/storage/v1/object/isms-files/${path}`, {
    method: "POST",
    headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!r.ok) { const err = await r.text().catch(() => "Unknown"); throw new Error(`Upload failed (${r.status}): ${err}`); }
  const ext = file.name.split(".").pop().toLowerCase();
  return { name: file.name, url: `${SUPA_URL}/storage/v1/object/public/isms-files/${path}`, type: ext, path };
};

const testConnection = async () => {
  try { const r = await fetch(`${SUPA_URL}/rest/v1/`, { method: "HEAD", headers: { "apikey": SUPA_KEY } }); return { ok: r.ok, status: r.status }; }
  catch (e) { return { ok: false, error: e.message }; }
};

// =============================================
// TRAINING SLIDES
// =============================================
// (Training content is now user-uploaded, no hardcoded slides)

// =============================================
// INITIAL DATA (v5 — no projectplan, no techEvidence)
// =============================================
const getInitialData = () => ({
  gapResponses: {},
  risks:[], assets:[], roles:[], raci:[], vapt:[], audits:[], policies:[], evidenceList:[], trainings:[],
  soaSheets:null, soaFileName:"", soaSheetNames:[],
  soaFileRef:null, vaptFileRef:null,
});

// =============================================
// THEME
// =============================================
const C = {
  bg:"#0B1120", sidebar:"#0F172A", card:"#1E293B", cardHover:"#334155",
  border:"#334155", orange:"#F97316", orangeHover:"#FB923C", orangeDark:"#C2410C",
  text:"#F8FAFC", textMuted:"#94A3B8", textDim:"#64748B",
  green:"#22C55E", yellow:"#EAB308", red:"#EF4444", blue:"#3B82F6",
  greenBg:"#052E16", yellowBg:"#422006", redBg:"#450A0A", blueBg:"#172554",
};

// =============================================
// EXCEL PARSE HELPER
// =============================================
const parseExcelToSheets = async (file) => {
  const buf = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsArrayBuffer(file); });
  const wb = XLSX.read(buf, { type: "array" });
  const all = {};
  wb.SheetNames.forEach(n => { all[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" }); });
  return { sheetNames: wb.SheetNames, allSheets: all };
};

// =============================================
// SHARED UI COMPONENTS
// =============================================
const Logo = () => (<div style={{display:"flex",alignItems:"center",gap:8}}><Shield size={28} color={C.orange} fill={C.orange} strokeWidth={1.5}/><span style={{fontSize:20,fontWeight:800,color:"#fff"}}>Sec<span style={{color:C.orange}}>Comply</span></span></div>);

const Btn = ({children,onClick,variant="primary",size="md",disabled,style:s,...p}) => {
  const base = {border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"all 0.2s",opacity:disabled?0.5:1,fontFamily:"inherit"};
  const sizes = {sm:{padding:"6px 12px",fontSize:12},md:{padding:"8px 16px",fontSize:13},lg:{padding:"12px 24px",fontSize:15}};
  const vars = {primary:{background:C.orange,color:"#fff"},secondary:{background:C.card,color:C.text,border:`1px solid ${C.border}`},danger:{background:C.red,color:"#fff"},ghost:{background:"transparent",color:C.textMuted},success:{background:C.green,color:"#fff"}};
  return <button onClick={onClick} disabled={disabled} style={{...base,...sizes[size],...vars[variant],...s}} {...p}>{children}</button>;
};

const Input = ({label,value,onChange,type="text",placeholder,textarea,style:s,select,options,...p}) => (
  <div style={{marginBottom:12,...s}}>
    {label && <label style={{display:"block",fontSize:12,color:C.textMuted,marginBottom:4,fontWeight:600}}>{label}</label>}
    {select ? <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"8px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"inherit"}} {...p}>{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select>
    : textarea ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{width:"100%",padding:"8px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,resize:"vertical",fontFamily:"inherit"}} {...p}/>
    : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"8px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"inherit"}} {...p}/>}
  </div>
);

const Badge = ({children,color=C.textMuted,bg}) => (<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,color,background:bg||`${color}22`,whiteSpace:"nowrap"}}>{children}</span>);
const Card = ({children,style:s,title,action,...p}) => (<div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,padding:20,...s}} {...p}>{(title||action)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>{title&&<h3 style={{margin:0,fontSize:16,fontWeight:700,color:C.text}}>{title}</h3>}{action}</div>}{children}</div>);
const Modal = ({open,onClose,title,children,wide}) => {
  if(!open) return null;
  return (<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:C.sidebar,borderRadius:16,border:`1px solid ${C.border}`,padding:24,width:wide?900:500,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{margin:0,fontSize:18,fontWeight:700,color:C.text}}>{title}</h2><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted}}><X size={20}/></button></div>{children}</div></div>);
};
const Stat = ({label,value,icon:Icon,color=C.orange}) => (<div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,padding:20,flex:1,minWidth:180}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:12,color:C.textMuted,fontWeight:600,marginBottom:4}}>{label}</div><div style={{fontSize:28,fontWeight:800,color}}>{value}</div></div>{Icon&&<div style={{padding:10,borderRadius:10,background:`${color}15`}}><Icon size={22} color={color}/></div>}</div></div>);
const Empty = ({msg="No data yet",action,onAction}) => (<div style={{textAlign:"center",padding:40,color:C.textDim}}><FileText size={40} style={{marginBottom:8,opacity:0.3}}/><div style={{marginBottom:action?12:0}}>{msg}</div>{action&&<Btn onClick={onAction} size="sm"><Plus size={14}/> {action}</Btn>}</div>);
const Toast = ({msg,type="success",onClose}) => {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[]);
  const colors = {success:C.green,error:C.red,info:C.blue};
  return (<div style={{position:"fixed",top:20,right:20,zIndex:2000,background:C.sidebar,border:`1px solid ${colors[type]}`,borderRadius:12,padding:"12px 20px",color:C.text,fontSize:13,fontWeight:600,boxShadow:`0 4px 20px ${colors[type]}33`,display:"flex",alignItems:"center",gap:8}}>{type==="success"?<CheckCircle size={16} color={C.green}/>:type==="error"?<XCircle size={16} color={C.red}/>:<AlertCircle size={16} color={C.blue}/>}{msg}</div>);
};
const FileUploadBtn = ({onFile,accept,label="Upload File",variant="primary",size="md"}) => {
  const ref = useRef();
  return (<><input ref={ref} type="file" accept={accept} style={{display:"none"}} onChange={async(e)=>{const f=e.target.files[0];if(f){await onFile(f);e.target.value="";}}} /><Btn variant={variant} size={size} onClick={()=>ref.current.click()}><Upload size={14}/> {label}</Btn></>);
};
const InlineUpload = ({onUpload,label}) => {
  const ref = useRef();
  return <><input ref={ref} type="file" style={{display:"none"}} onChange={async(e)=>{const f=e.target.files[0];if(f){await onUpload(f);e.target.value="";}}} /><button onClick={()=>ref.current.click()} style={{background:`${C.orange}22`,border:`1px solid ${C.orange}44`,borderRadius:6,cursor:"pointer",padding:"3px 8px",color:C.orange,fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}><Upload size={10}/> {label||"Upload"}</button></>;
};
const DataTable = ({rows,maxH=500}) => {
  if(!rows||rows.length===0) return <div style={{padding:20,color:C.textDim,textAlign:"center"}}>No data</div>;
  const cols = Object.keys(rows[0]);
  return (<div style={{overflow:"auto",maxHeight:maxH}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:C.bg,position:"sticky",top:0,zIndex:1}}>{cols.map(c=><th key={c} style={{padding:"8px 10px",textAlign:"left",color:C.orange,fontWeight:700,fontSize:11,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap"}}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.border}22`}}>{cols.map(c=><td key={c} style={{padding:"7px 10px",color:C.text,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis"}}>{String(r[c]??"")}</td>)}</tr>)}</tbody></table></div>);
};
const FilePreviewModal = ({file,onClose}) => {
  if(!file) return null;
  const ext = (file.type||file.name?.split(".").pop()||"").toLowerCase();
  const isImg = ["png","jpg","jpeg","gif","webp","svg","bmp"].includes(ext);
  const isPdf = ext==="pdf";
  const isOffice = ["pptx","ppt","docx","doc","xlsx","xls","ppsx"].includes(ext);
  const isVideo = ["mp4","webm","mov","ogg"].includes(ext);
  const isAudio = ["mp3","wav","ogg","aac","m4a"].includes(ext);
  const isTxt = ["txt","md","csv","json","xml","yaml","yml","log","html","css","js","py","sql","sh"].includes(ext);
  const officeUrl = isOffice && file.url ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}` : null;
  const gDocsUrl = isOffice && file.url ? `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true` : null;
  const [viewerMode,setViewerMode]=useState("ms"); // ms | google | download
  const [txtContent,setTxtContent]=useState(null);
  const [loading,setLoading]=useState(isOffice||isTxt);

  useEffect(()=>{
    if(isTxt && file.url) {
      fetch(file.url).then(r=>r.text()).then(t=>{setTxtContent(t);setLoading(false);}).catch(()=>{setTxtContent(null);setLoading(false);});
    }
  },[file.url]);

  const previewUrl = viewerMode === "google" ? gDocsUrl : officeUrl;

  return (<div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.sidebar,borderRadius:16,border:`1px solid ${C.border}`,width:isOffice||isPdf||isVideo?960:800,maxWidth:"96vw",maxHeight:"94vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
          <div style={{padding:8,borderRadius:8,background:`${C.orange}18`}}>
            {isImg?<Image size={18} color={C.orange}/>:isPdf?<FileText size={18} color={C.red}/>:isOffice?<FileSpreadsheet size={18} color={C.blue}/>:isVideo?<Monitor size={18} color="#A855F7"/>:<File size={18} color={C.orange}/>}
          </div>
          <div style={{minWidth:0}}>
            <div style={{color:C.text,fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</div>
            <div style={{color:C.textDim,fontSize:11}}>.{ext} file</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          {isOffice&&<>
            <button onClick={()=>{setViewerMode("ms");setLoading(true);}} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${viewerMode==="ms"?C.blue:C.border}`,background:viewerMode==="ms"?`${C.blue}22`:"transparent",color:viewerMode==="ms"?C.blue:C.textMuted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Microsoft</button>
            <button onClick={()=>{setViewerMode("google");setLoading(true);}} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${viewerMode==="google"?C.green:C.border}`,background:viewerMode==="google"?`${C.green}22`:"transparent",color:viewerMode==="google"?C.green:C.textMuted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Google</button>
          </>}
          {file.url&&<a href={file.url} target="_blank" rel="noreferrer" style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${C.orange}`,background:`${C.orange}22`,color:C.orange,fontSize:11,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}><Download size={12}/> Download</a>}
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4}}><X size={20}/></button>
        </div>
      </div>
      {/* Content */}
      <div style={{flex:1,overflow:"auto",position:"relative"}}>
        {isImg && <div style={{padding:20,display:"flex",justifyContent:"center",alignItems:"center",minHeight:400}}><img src={file.url} alt={file.name} style={{maxWidth:"100%",maxHeight:"75vh",borderRadius:8,objectFit:"contain"}}/></div>}
        {isPdf && <iframe src={file.url} style={{width:"100%",height:"80vh",border:"none"}} title={file.name}/>}
        {isOffice && previewUrl && <>
          {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.card,zIndex:1}}><div style={{textAlign:"center"}}><Loader size={28} color={C.orange} style={{animation:"spin 1s linear infinite",marginBottom:10}}/><div style={{color:C.textMuted,fontSize:13}}>Loading preview...</div><div style={{color:C.textDim,fontSize:11,marginTop:4}}>via {viewerMode==="ms"?"Microsoft Office":"Google Docs"} Viewer</div></div></div>}
          <iframe src={previewUrl} onLoad={()=>setLoading(false)} style={{width:"100%",height:"80vh",border:"none"}} title={file.name} sandbox="allow-scripts allow-same-origin allow-popups"/>
        </>}
        {isVideo && <div style={{padding:20,display:"flex",justifyContent:"center"}}><video src={file.url} controls style={{maxWidth:"100%",maxHeight:"75vh",borderRadius:8}}/></div>}
        {isAudio && <div style={{padding:40,display:"flex",justifyContent:"center"}}><audio src={file.url} controls style={{width:"100%",maxWidth:500}}/></div>}
        {isTxt && <div style={{padding:20}}>{txtContent!==null?<pre style={{background:C.bg,padding:20,borderRadius:10,border:`1px solid ${C.border}`,color:C.text,fontSize:12,lineHeight:1.6,overflow:"auto",maxHeight:"70vh",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{txtContent}</pre>:<div style={{color:C.textDim,textAlign:"center",padding:40}}>Could not load file content</div>}</div>}
        {!isImg && !isPdf && !isOffice && !isVideo && !isAudio && !isTxt && (
          <div style={{textAlign:"center",padding:60}}>
            <File size={56} color={C.textDim} style={{marginBottom:12}}/>
            <p style={{color:C.textMuted,fontSize:14,marginBottom:4}}>Preview not available for .{ext} files</p>
            <p style={{color:C.textDim,fontSize:12,marginBottom:20}}>Download to view in your preferred application</p>
            {file.url&&<a href={file.url} target="_blank" rel="noreferrer" style={{padding:"10px 24px",borderRadius:8,background:C.orange,color:"#fff",fontWeight:700,fontSize:13,textDecoration:"none"}}>Download File ↗</a>}
          </div>
        )}
      </div>
    </div>
  </div>);
};

// =============================================
// AUTH PAGE
// =============================================
const AuthPage = ({onAuth}) => {
  const [mode,setMode]=useState("signin");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [success,setSuccess]=useState("");const [loading,setLoading]=useState(false);const [showPw,setShowPw]=useState(false);const [connStatus,setConnStatus]=useState("");
  const checkConn = async()=>{setConnStatus("testing");const r=await testConnection();setConnStatus(r.ok?"ok":"fail");};
  const handleSubmit = async() => {
    setError("");setSuccess("");setLoading(true);
    try{if(mode==="signup"){const d=await supaAuth("signup",{email,password});if(d.access_token){setSuccess("Account created! Signing in...");onAuth(d.access_token,d.user);}else{setSuccess("Account created! Please sign in.");setMode("signin");}}else{const d=await supaAuth("token?grant_type=password",{email,password});if(d.access_token){onAuth(d.access_token,d.user);}else{setError("Invalid credentials");}}}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{width:420,maxWidth:"95vw"}}>
        <div style={{textAlign:"center",marginBottom:32}}><Logo/><p style={{color:C.textMuted,fontSize:14,marginTop:8}}>Information Security Management System</p></div>
        <div style={{background:C.sidebar,borderRadius:16,border:`1px solid ${C.border}`,padding:32}}>
          <div style={{display:"flex",gap:4,marginBottom:24,background:C.bg,borderRadius:10,padding:4}}>
            {["signin","signup"].map(m=><button key={m} onClick={()=>{setMode(m);setError("");setSuccess("");}} style={{flex:1,padding:"8px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,background:mode===m?C.orange:"transparent",color:mode===m?"#fff":C.textMuted,fontFamily:"inherit"}}>{m==="signin"?"Sign In":"Sign Up"}</button>)}
          </div>
          <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
            <button onClick={checkConn} disabled={connStatus==="testing"} style={{padding:"6px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,cursor:"pointer",color:C.textMuted,fontSize:11,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
              {connStatus==="testing" ? <><Loader size={10} style={{animation:"spin 1s linear infinite"}}/> Testing...</> : "🔌 Test Connection"}
            </button>
            {connStatus==="ok"&&<span style={{fontSize:11,color:C.green,fontWeight:600}}>✓ Connected</span>}
            {connStatus==="fail"&&<span style={{fontSize:11,color:C.red,fontWeight:600}}>✗ Failed</span>}
          </div>
          {error&&<div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.red}44`,borderRadius:8,color:C.red,fontSize:12,marginBottom:16,fontWeight:500,whiteSpace:"pre-wrap"}}>{error}</div>}
          {success&&<div style={{padding:"10px 14px",background:C.greenBg,border:`1px solid ${C.green}44`,borderRadius:8,color:C.green,fontSize:13,marginBottom:16,fontWeight:600}}>{success}</div>}
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:600}}>Email</label><div style={{position:"relative"}}><Mail size={16} style={{position:"absolute",left:12,top:12,color:C.textDim}}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={{width:"100%",padding:"10px 12px 10px 38px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/></div></div>
          <div style={{marginBottom:24}}><label style={{display:"block",fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:600}}>Password</label><div style={{position:"relative"}}><Lock size={16} style={{position:"absolute",left:12,top:12,color:C.textDim}}/><input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={{width:"100%",padding:"10px 40px 10px 38px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/><button onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:10,top:10,background:"none",border:"none",cursor:"pointer",color:C.textDim}}>{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>
          <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:"12px",background:loading?C.cardHover:C.orange,border:"none",borderRadius:10,color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>{loading&&<Loader size={16} style={{animation:"spin 1s linear infinite"}}/>}{mode==="signin"?"Sign In":"Create Account"}</button>
          <div style={{marginTop:20,padding:"12px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.orange,fontWeight:700,marginBottom:4}}>⚠ First-time setup required</div>
            <div style={{fontSize:11,color:C.textDim,lineHeight:1.5}}>Run the <strong style={{color:C.text}}>supabase_setup.sql</strong> script in your Supabase SQL Editor first. Disable "Email Confirmations" in Auth → Settings.</div>
          </div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
        <p style={{textAlign:"center",color:C.textDim,fontSize:12,marginTop:16}}>Powered by SecComply • Secure ISMS Management</p>
      </div>
    </div>
  );
};

// =============================================
// DASHBOARD
// =============================================
const Dashboard = ({data}) => {
  const gapStats = useMemo(()=>{
    const resp=data.gapResponses||{};
    const evalTrig=(trigger)=>{if(!trigger||trigger==="Ask all clients")return true;const m=trigger.match(/^If\s+(\w+)\s*=\s*(.+)$/);if(m){const r=resp[m[1]];if(!r||!r.resp||r.resp==="No")return false;if(m[2].trim()==="Yes")return r.resp==="Yes"||r.resp==="Partial";return(r.sel||[]).some(s=>s.toLowerCase().includes(m[2].trim().toLowerCase()));}return true;};
    const visible=GAP_QUESTIONS.filter(q=>evalTrig(q.trigger));
    let yes=0,no=0,partial=0,na=0,totalW=0,scoreW=0;
    visible.forEach(q=>{const r=resp[q.id];const w=q.sev==="MAJOR"?2:1;if(!r||!r.resp)return;if(r.resp==="Yes"){yes++;const evN=(q.ev||"").split("\n").filter(l=>l.trim().startsWith("•")).length;const evC=(r.evChecked||[]).length;const s=evN>0&&evC>=evN?100:evC>0?70:60;totalW+=w;scoreW+=s*w;}else if(r.resp==="No"){no++;totalW+=w;}else if(r.resp==="Partial"){partial++;const evC=(r.evChecked||[]).length;totalW+=w;scoreW+=(evC>0?50:30)*w;}else if(r.resp==="N/A"){na++;}});
    const pct=totalW>0?Math.round(scoreW/totalW):0;
    return{total:visible.length,yes,no,partial,na,pct};
  },[data.gapResponses]);
  const riskData = useMemo(()=>{const r=(data.risks||[]).filter(x=>!x.disabled);return{total:r.length,high:r.filter(x=>x.impact*x.likelihood>=15).length,med:r.filter(x=>{const l=x.impact*x.likelihood;return l>=8&&l<15;}).length,low:r.filter(x=>x.impact*x.likelihood<8).length};},[data.risks]);
  const pieData=[{name:"Yes",value:gapStats.yes,color:C.green},{name:"Partial",value:gapStats.partial,color:C.yellow},{name:"No (Gap)",value:gapStats.no,color:C.red},{name:"N/A",value:gapStats.na,color:C.textDim}].filter(d=>d.value>0);
  const riskPie=[{name:"High",value:riskData.high,color:C.red},{name:"Medium",value:riskData.med,color:C.yellow},{name:"Low",value:riskData.low,color:C.green}].filter(d=>d.value>0);
  return (<div>
    <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:C.text}}>ISMS Dashboard</h2>
    <p style={{color:C.textMuted,margin:"0 0 24px",fontSize:14}}>Your information security management at a glance</p>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
      <Stat label="Gap Compliance" value={`${gapStats.pct}%`} icon={ClipboardCheck} color={gapStats.pct>=70?C.green:gapStats.pct>=40?C.yellow:C.red}/>
      <Stat label="Active Risks" value={riskData.total} icon={AlertTriangle} color={C.yellow}/>
      <Stat label="Assets" value={(data.assets||[]).length} icon={Server} color={C.blue}/>
      <Stat label="Policies" value={(data.policies||[]).length} icon={FileText} color={C.orange}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Gap Assessment">{pieData.length>0?<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>{pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Legend formatter={v=><span style={{color:C.textMuted,fontSize:12}}>{v}</span>}/></PieChart></ResponsiveContainer>:<Empty msg="Start your Gap Assessment to see progress"/>}</Card>
      <Card title="Risk Heatmap">{riskPie.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={riskPie}><XAxis dataKey="name" tick={{fill:C.textMuted,fontSize:12}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.textMuted,fontSize:12}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:C.sidebar,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}}/><Bar dataKey="value" radius={[6,6,0,0]}>{riskPie.map((d,i)=><Cell key={i} fill={d.color}/>)}</Bar></BarChart></ResponsiveContainer>:<Empty msg="Add risks to see the heatmap"/>}</Card>
    </div>
  </div>);
};

// =============================================
// SOA MODULE (unchanged)
// =============================================
const SOAModule = ({data,setData}) => {
  const [toast,setToast]=useState(null);const [activeSheet,setActiveSheet]=useState("");const [uploading,setUploading]=useState(false);
  const {token,user} = useAuth();
  const handleUpload = async(file) => {
    setUploading(true);
    try {
      const {sheetNames,allSheets} = await parseExcelToSheets(file);
      let fileRef = null;
      try { fileRef = await uploadToStorage(token,user.id,"soa",file); } catch(e) { console.warn("Storage upload failed",e); }
      setData(d=>({...d, soaSheets:allSheets, soaFileName:file.name, soaSheetNames:sheetNames, soaFileRef:fileRef}));
      setActiveSheet(sheetNames[0]||"");
      setToast({msg:`SOA uploaded — ${sheetNames.length} sheet(s)`,type:"success"});
    } catch(e) { setToast({msg:"Error reading file: "+e.message,type:"error"}); }
    setUploading(false);
  };
  const sheets = data.soaSheets||{};const sheetNames = data.soaSheetNames||[];const current = activeSheet||sheetNames[0]||"";const rows = sheets[current]||[];
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Statement of Applicability</h2><p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>Upload your SOA spreadsheet</p></div>
      <div style={{display:"flex",gap:8}}>
        {data.soaFileName&&<Btn variant="danger" size="sm" onClick={()=>{setData(d=>({...d,soaSheets:null,soaFileName:"",soaSheetNames:[],soaFileRef:null}));setActiveSheet("");}}><Trash2 size={12}/> Remove</Btn>}
        <FileUploadBtn onFile={handleUpload} accept=".xlsx,.xls,.csv" label={uploading?"Uploading...":"Upload SOA"}/>
      </div>
    </div>
    {data.soaFileName ? (<Card>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><FileSpreadsheet size={18} color={C.green}/><span style={{color:C.text,fontWeight:600}}>{data.soaFileName}</span><Badge color={C.green}>{rows.length} rows</Badge>{data.soaFileRef?.url&&<a href={data.soaFileRef.url} target="_blank" rel="noreferrer" style={{color:C.orange,fontSize:12,fontWeight:600,textDecoration:"none"}}>Download ↗</a>}</div>
      {sheetNames.length>1&&<div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto"}}>{sheetNames.map(s=><button key={s} onClick={()=>setActiveSheet(s)} style={{padding:"6px 14px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12,background:current===s?C.orange:C.bg,color:current===s?"#fff":C.textMuted,fontFamily:"inherit",whiteSpace:"nowrap"}}>{s}</button>)}</div>}
      <DataTable rows={rows} maxH={550}/>
    </Card>) : (<Card><Empty msg="Upload your SOA spreadsheet (.xlsx) to view controls here"/></Card>)}
  </div>);
};


// Conditional trigger evaluator
const evalTrigger = (trigger, resp) => {
  if(!trigger || trigger === "Ask all clients") return {visible:true,reason:""};
  const m = trigger.match(/^If\s+(\w+)\s*=\s*(.+)$/);
  if(m) {
    const pid = m[1], val = m[2].trim();
    const r = resp[pid];
    if(!r || !r.resp || r.resp === "No" || r.resp === "N/A") return {visible:false,reason:`Requires ${pid} = ${val}`};
    if(val === "Yes") return {visible: r.resp === "Yes" || r.resp === "Partial", reason:`Requires ${pid} = Yes`};
    const match = (r.sel||[]).some(s => s.toLowerCase().includes(val.toLowerCase()));
    return {visible:match, reason:`Requires ${pid} includes ${val}`};
  }
  const ctx = {
    "If on-prem or hybrid":  () => (resp.N1?.sel||[]).some(s=>/on.?prem|hybrid/i.test(s)),
    "If multi-site":         () => (resp.N1?.sel||[]).some(s=>/multi/i.test(s)),
    "If hosting web apps":   () => true,
    "If using WiFi":         () => true,
    "If managing critical infra": () => true,
    "If handling sensitive data":  () => true,
    "If using containers":   () => true,
    "If hosting APIs":       () => true,
    "If SOC exists":         () => resp.L5?.resp === "Yes" || resp.L5?.resp === "Partial",
    "If using cloud":        () => resp.C1?.resp === "Yes" || resp.C1?.resp === "Partial",
    "If critical vendors":   () => resp.T1?.resp === "Yes" || resp.T1?.resp === "Partial",
  };
  const fn = ctx[trigger];
  return {visible: fn ? fn() : true, reason: trigger};
};

// Scoring per question
const scoreQ = (r, q) => {
  if(!r || !r.resp || r.resp === "N/A") return null; // excluded
  if(r.resp === "No") return 0;
  const evItems = (q.ev||"").split("\n").filter(l=>l.trim().startsWith("•")).length;
  const evChecked = (r.evChecked||[]).length;
  const evPct = evItems > 0 ? evChecked / evItems : 0;
  if(r.resp === "Yes" && evPct >= 1) return 100;
  if(r.resp === "Yes" && evPct > 0) return 70;
  if(r.resp === "Yes" && evPct === 0) return 60;
  if(r.resp === "Partial" && evPct > 0) return 50;
  if(r.resp === "Partial") return 30;
  return 0;
};

const GapAssessment = ({data,setData}) => {
  const [activeCat,setActiveCat]=useState(0);
  const [view,setView]=useState("assess"); // assess | dashboard | export
  const [detailQ,setDetailQ]=useState(null);
  const [search,setSearch]=useState("");
  const [toast,setToast]=useState(null);
  const [uploading,setUploading]=useState(false);
  const {token,user} = useAuth();

  const resp = data.gapResponses || {};
  const setResp = (qId, updates) => {
    setData(d => ({...d, gapResponses: {...(d.gapResponses||{}), [qId]: {...((d.gapResponses||{})[qId]||{resp:"",sel:[],evChecked:[],notes:"",driveLink:""}), ...updates}}}));
  };

  // Get visible questions for a category
  const getVisibleQs = (catIdx) => {
    return GAP_QUESTIONS.filter(q => q.catIdx === catIdx).filter(q => {
      const {visible} = evalTrigger(q.trigger, resp);
      return visible;
    });
  };

  // Get ALL visible questions across all categories
  const allVisibleQs = useMemo(() => {
    return GAP_QUESTIONS.filter(q => evalTrigger(q.trigger, resp).visible);
  }, [resp]);

  // Current category questions
  const catQs = useMemo(() => {
    let qs = GAP_QUESTIONS.filter(q => q.catIdx === activeCat);
    if(search) {
      const s = search.toLowerCase();
      qs = qs.filter(q => q.q.toLowerCase().includes(s) || q.id.toLowerCase().includes(s) || q.iso.toLowerCase().includes(s));
    }
    return qs;
  }, [activeCat, search]);

  // Category scores
  const catScores = useMemo(() => {
    return GAP_CATS.map((cat, idx) => {
      const qs = getVisibleQs(idx);
      let totalWeight = 0, weightedScore = 0, answered = 0, total = qs.length;
      qs.forEach(q => {
        const r = resp[q.id];
        const w = q.sev === "MAJOR" ? 2 : 1;
        const s = scoreQ(r, q);
        if(s !== null) { totalWeight += w; weightedScore += s * w; answered++; }
        else { total--; } // N/A excluded from total
      });
      const pct = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
      return {name: cat.name, icon: cat.icon, total, answered, pct, visible: qs.length, allQs: GAP_QUESTIONS.filter(q=>q.catIdx===idx).length};
    });
  }, [resp]);

  // Overall stats
  const overallStats = useMemo(() => {
    let totalW = 0, scoreW = 0, answered = 0, yesCount = 0, noCount = 0, partialCount = 0, naCount = 0;
    let majorGaps = 0, modGaps = 0;
    allVisibleQs.forEach(q => {
      const r = resp[q.id];
      const w = q.sev === "MAJOR" ? 2 : 1;
      if(r?.resp === "Yes") yesCount++;
      else if(r?.resp === "No") { noCount++; if(q.sev==="MAJOR") majorGaps++; else modGaps++; }
      else if(r?.resp === "Partial") partialCount++;
      else if(r?.resp === "N/A") naCount++;
      const s = scoreQ(r, q);
      if(s !== null) { totalW += w; scoreW += s * w; answered++; }
    });
    const pct = totalW > 0 ? Math.round(scoreW / totalW) : 0;
    return {total: allVisibleQs.length, answered, yesCount, noCount, partialCount, naCount, majorGaps, modGaps, pct};
  }, [resp, allVisibleQs]);

  // Evidence items parser
  const parseEvItems = (ev) => (ev||"").split("\n").filter(l=>l.trim().startsWith("•")).map(l=>l.trim().replace(/^•\s*/,""));

  // Evidence upload
  const handleEvUpload = async(qId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async(e) => {
      const file = e.target.files[0];
      if(!file) return;
      try {
        const ref = await uploadToStorage(token,user.id,"gap-evidence",file);
        const curr = resp[qId] || {};
        const files = [...(curr.evFiles||[]), ref];
        setResp(qId, {evFiles: files});
        setToast({msg:"Evidence uploaded!",type:"success"});
      } catch(err) { setToast({msg:"Upload failed: "+err.message,type:"error"}); }
    };
    input.click();
  };

  // Export assessment to Excel
  const exportAssessment = () => {
    const rows = allVisibleQs.map(q => {
      const r = resp[q.id] || {};
      const evItems = parseEvItems(q.ev);
      const evChecked = (r.evChecked||[]).length;
      const s = scoreQ(r, q);
      return {
        "Q#": q.id,
        "Category": GAP_CATS[q.catIdx]?.name || "",
        "Type": q.type,
        "Question": q.q,
        "ISO Ref": q.iso,
        "Severity": q.sev,
        "Response": r.resp || "Not Assessed",
        "Selections": (r.sel||[]).join(", "),
        "Evidence Items": evItems.length,
        "Evidence Collected": evChecked,
        "Evidence %": evItems.length > 0 ? Math.round((evChecked/evItems.length)*100)+"%" : "N/A",
        "Score": s !== null ? s+"%" : "N/A",
        "Drive Link": r.driveLink || "",
        "Notes": r.notes || "",
        "Recommended Action": q.act,
        "Trigger": q.trigger,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gap Assessment");
    ws["!cols"] = [{wch:5},{wch:28},{wch:10},{wch:55},{wch:14},{wch:10},{wch:14},{wch:20},{wch:6},{wch:6},{wch:8},{wch:6},{wch:25},{wch:25},{wch:35},{wch:18}];
    XLSX.writeFile(wb, "Gap_Assessment_Report.xlsx");
    setToast({msg:"Assessment exported!",type:"success"});
  };

  // Type badge colors
  const typeBg = {DISCOVERY:"#3B82F622",["DRILL-DOWN"]:"#A855F722",GAP:"#EF444422"};
  const typeColor = {DISCOVERY:C.blue,["DRILL-DOWN"]:"#A855F7",GAP:C.red};
  const sevColor = s => s === "MAJOR" ? C.red : C.orange;
  const respColor = r => ({Yes:C.green,No:C.red,Partial:C.yellow,"N/A":C.textDim}[r]||C.border);

  // Score color
  const scoreBg = (pct) => pct >= 80 ? C.green : pct >= 60 ? C.yellow : pct >= 40 ? C.orange : C.red;

  // ─── DASHBOARD VIEW ───
  if(view === "dashboard") {
    const radarData = catScores.map(c=>({domain:c.icon+" "+c.name.split(" ")[0],score:c.pct,full:100}));
    const sevData = [{name:"MAJOR Gaps",value:overallStats.majorGaps,color:C.red},{name:"MODERATE Gaps",value:overallStats.modGaps,color:C.orange}].filter(d=>d.value>0);
    const respData = [{name:"Yes",value:overallStats.yesCount,color:C.green},{name:"Partial",value:overallStats.partialCount,color:C.yellow},{name:"No",value:overallStats.noCount,color:C.red},{name:"N/A",value:overallStats.naCount,color:C.textDim}].filter(d=>d.value>0);
    return (<div>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Gap Assessment Dashboard</h2>
        <p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>Overall Score: <span style={{color:scoreBg(overallStats.pct),fontWeight:800,fontSize:18}}>{overallStats.pct}%</span> • {overallStats.answered}/{overallStats.total} questions assessed</p></div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="secondary" size="sm" onClick={()=>setView("assess")}><ArrowLeft size={14}/> Back to Assessment</Btn>
          <Btn onClick={exportAssessment}><Download size={14}/> Export Report</Btn>
        </div>
      </div>
      {/* Stats Row */}
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}>
        <Stat label="Overall Score" value={`${overallStats.pct}%`} icon={Target} color={scoreBg(overallStats.pct)}/>
        <Stat label="Questions Assessed" value={`${overallStats.answered}/${overallStats.total}`} icon={ClipboardCheck} color={C.blue}/>
        <Stat label="Compliant (Yes)" value={overallStats.yesCount} icon={CheckCircle} color={C.green}/>
        <Stat label="Gaps Found (No)" value={overallStats.noCount} icon={AlertTriangle} color={C.red}/>
      </div>
      {/* Progress bar */}
      <div style={{height:8,background:C.bg,borderRadius:4,marginBottom:24,overflow:"hidden"}}><div style={{height:"100%",width:`${overallStats.pct}%`,background:`linear-gradient(90deg,${scoreBg(overallStats.pct)},${C.orange})`,borderRadius:4,transition:"width 0.6s"}}/></div>
      {/* Charts Row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Card title="Response Distribution">{respData.length>0?<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={respData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>{respData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Legend formatter={v=><span style={{color:C.textMuted,fontSize:12}}>{v}</span>}/></PieChart></ResponsiveContainer>:<Empty msg="No responses yet"/>}</Card>
        <Card title="Gap Severity">{sevData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={sevData}><XAxis dataKey="name" tick={{fill:C.textMuted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.textMuted,fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:C.sidebar,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}}/><Bar dataKey="value" radius={[6,6,0,0]}>{sevData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Bar></BarChart></ResponsiveContainer>:<Empty msg="No gaps found yet"/>}</Card>
      </div>
      {/* Domain Scores */}
      <Card title="Domain-wise Compliance">
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {catScores.map((c,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:18,width:28}}>{c.icon}</span>
              <span style={{color:C.text,fontSize:13,fontWeight:600,width:220,flexShrink:0}}>{c.name}</span>
              <div style={{flex:1,height:8,background:C.bg,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${c.pct}%`,background:scoreBg(c.pct),borderRadius:4,transition:"width 0.4s"}}/></div>
              <span style={{color:scoreBg(c.pct),fontWeight:800,fontSize:14,width:45,textAlign:"right"}}>{c.pct}%</span>
              <span style={{color:C.textDim,fontSize:11,width:60}}>{c.answered}/{c.total}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>);
  }

  // ─── ASSESSMENT VIEW ───
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Gap Assessment</h2>
        <p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>102 questions across 11 security domains • Smart conditional flow</p>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="secondary" size="sm" onClick={()=>setView("dashboard")}><Target size={14}/> Dashboard</Btn>
        <Btn variant="secondary" size="sm" onClick={exportAssessment}><Download size={14}/> Export</Btn>
        <Btn variant="danger" size="sm" onClick={()=>{if(confirm("Clear all responses?"))setData(d=>({...d,gapResponses:{}}));}}><Trash2 size={12}/> Reset</Btn>
      </div>
    </div>

    {/* Overall progress */}
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:160}}>
        <Target size={18} color={scoreBg(overallStats.pct)}/>
        <div><div style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Overall Score</div><div style={{fontSize:20,fontWeight:800,color:scoreBg(overallStats.pct)}}>{overallStats.pct}%</div></div>
      </div>
      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:160}}>
        <ClipboardCheck size={18} color={C.blue}/>
        <div><div style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Assessed</div><div style={{fontSize:20,fontWeight:800,color:C.blue}}>{overallStats.answered}<span style={{fontSize:13,color:C.textDim,fontWeight:500}}>/{overallStats.total}</span></div></div>
      </div>
      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
        <CheckCircle size={18} color={C.green}/><div><div style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Yes</div><div style={{fontSize:20,fontWeight:800,color:C.green}}>{overallStats.yesCount}</div></div>
      </div>
      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
        <XCircle size={18} color={C.red}/><div><div style={{fontSize:11,color:C.textMuted,fontWeight:600}}>No</div><div style={{fontSize:20,fontWeight:800,color:C.red}}>{overallStats.noCount}</div></div>
      </div>
      <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
        <AlertCircle size={18} color={C.yellow}/><div><div style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Partial</div><div style={{fontSize:20,fontWeight:800,color:C.yellow}}>{overallStats.partialCount}</div></div>
      </div>
    </div>

    {/* Category tabs */}
    <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",paddingBottom:4,background:C.card,borderRadius:10,padding:4}}>
      {GAP_CATS.map((cat,i) => {
        const sc = catScores[i];
        const active = activeCat === i;
        return <button key={i} onClick={()=>setActiveCat(i)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:active?700:500,fontSize:12,whiteSpace:"nowrap",background:active?C.orange:"transparent",color:active?"#fff":C.textMuted,fontFamily:"inherit",transition:"all 0.15s"}}>
          <span style={{fontSize:15}}>{cat.icon}</span>
          <span>{cat.name.split(" ")[0]}</span>
          {sc.answered>0&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:active?"rgba(255,255,255,0.2)":`${scoreBg(sc.pct)}22`,color:active?"#fff":scoreBg(sc.pct),fontWeight:700}}>{sc.pct}%</span>}
        </button>;
      })}
    </div>

    {/* Category info bar */}
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 16px",background:C.card,borderRadius:10,border:`1px solid ${C.border}`}}>
      <span style={{fontSize:24}}>{GAP_CATS[activeCat]?.icon}</span>
      <div style={{flex:1}}>
        <div style={{color:C.text,fontWeight:700,fontSize:15}}>{GAP_CATS[activeCat]?.name}</div>
        <div style={{color:C.textDim,fontSize:12}}>{GAP_CATS[activeCat]?.desc}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:80,height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${catScores[activeCat]?.pct||0}%`,background:scoreBg(catScores[activeCat]?.pct||0),borderRadius:3}}/></div>
        <span style={{color:scoreBg(catScores[activeCat]?.pct||0),fontWeight:700,fontSize:13}}>{catScores[activeCat]?.pct||0}%</span>
        <Badge color={C.textMuted}>{catScores[activeCat]?.answered||0}/{catScores[activeCat]?.total||0}</Badge>
      </div>
    </div>

    {/* Search */}
    <div style={{position:"relative",marginBottom:16}}>
      <Search size={16} style={{position:"absolute",left:12,top:10,color:C.textDim}}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions, Q#, ISO ref..." style={{width:"100%",padding:"8px 12px 8px 36px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"inherit"}}/>
    </div>

    {/* Question List */}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {catQs.map(q => {
        const {visible, reason} = evalTrigger(q.trigger, resp);
        const r = resp[q.id] || {};
        const evItems = parseEvItems(q.ev);
        const evCheckedCount = (r.evChecked||[]).length;
        const hasMultiSel = MULTI_SELECT[q.id];
        const qScore = scoreQ(r, q);

        if(!visible) {
          // Show hidden drill-downs as dimmed placeholder
          if(q.type === "DRILL-DOWN") return (
            <div key={q.id} style={{padding:"10px 16px",background:`${C.card}66`,borderRadius:10,border:`1px dashed ${C.border}44`,opacity:0.4,display:"flex",alignItems:"center",gap:10}}>
              <Badge color={typeColor[q.type]} bg={typeBg[q.type]}>{q.id}</Badge>
              <span style={{color:C.textDim,fontSize:12,fontStyle:"italic"}}>{reason} — {q.q.substring(0,60)}...</span>
            </div>
          );
          return null;
        }

        return (
          <div key={q.id} style={{background:C.card,borderRadius:12,border:`1px solid ${r.resp?`${respColor(r.resp)}44`:C.border}`,padding:16,transition:"all 0.2s"}}>
            {/* Question Header */}
            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
              <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center",minWidth:44}}>
                <Badge color={typeColor[q.type]} bg={typeBg[q.type]}>{q.id}</Badge>
                <span style={{fontSize:9,color:typeColor[q.type],fontWeight:700}}>{q.type}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:14,fontWeight:600,lineHeight:1.5,marginBottom:6}}>{q.q}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <Badge color={sevColor(q.sev)} bg={`${sevColor(q.sev)}18`}>{q.sev}</Badge>
                  <span style={{color:C.textDim,fontSize:11,fontFamily:"monospace"}}>{q.iso}</span>
                  {q.trigger !== "Ask all clients" && <span style={{color:C.textDim,fontSize:10,fontStyle:"italic"}}>⚡ {q.trigger}</span>}
                  {qScore !== null && <span style={{marginLeft:"auto",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,background:`${scoreBg(qScore)}22`,color:scoreBg(qScore)}}>{qScore}%</span>}
                </div>
              </div>
            </div>

            {/* Response Buttons */}
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{color:C.textDim,fontSize:11,fontWeight:600,marginRight:4}}>Response:</span>
              {["Yes","No","Partial","N/A"].map(opt => (
                <button key={opt} onClick={()=>setResp(q.id, {resp: r.resp===opt?"":opt})} style={{padding:"5px 14px",borderRadius:8,border:`1px solid ${r.resp===opt?respColor(opt):C.border}`,background:r.resp===opt?`${respColor(opt)}22`:"transparent",color:r.resp===opt?respColor(opt):C.textMuted,fontSize:12,fontWeight:r.resp===opt?700:500,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{opt}</button>
              ))}
            </div>

            {/* Multi-select chips for DISCOVERY questions */}
            {hasMultiSel && r.resp && r.resp !== "No" && r.resp !== "N/A" && (
              <div style={{marginBottom:10}}>
                <span style={{color:C.textDim,fontSize:11,fontWeight:600,display:"block",marginBottom:6}}>Select applicable options:</span>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {hasMultiSel.map(opt => {
                    const selected = (r.sel||[]).includes(opt);
                    return <button key={opt} onClick={()=>{
                      const curr = r.sel||[];
                      const next = selected ? curr.filter(s=>s!==opt) : [...curr, opt];
                      setResp(q.id, {sel: next});
                    }} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${selected?C.orange:C.border}`,background:selected?`${C.orange}22`:"transparent",color:selected?C.orange:C.textMuted,fontSize:12,fontWeight:selected?700:500,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{selected?"✓ ":""}{opt}</button>;
                  })}
                </div>
              </div>
            )}

            {/* Evidence & Details — expandable on click */}
            {r.resp && r.resp !== "N/A" && (
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setDetailQ(detailQ===q.id?null:q.id)} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,fontSize:12,fontFamily:"inherit"}}>
                  <Paperclip size={13}/>
                  <span>Evidence: {evCheckedCount}/{evItems.length} items</span>
                  {evItems.length > 0 && <div style={{width:60,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${evItems.length>0?(evCheckedCount/evItems.length)*100:0}%`,background:evCheckedCount===evItems.length?C.green:C.yellow,borderRadius:2}}/></div>}
                  {(r.evFiles||[]).length > 0 && <Badge color={C.green}>{(r.evFiles||[]).length} files</Badge>}
                  <span style={{marginLeft:"auto",color:C.textDim}}>{detailQ===q.id?"▲":"▼"}</span>
                </button>
                <button onClick={()=>handleEvUpload(q.id)} style={{padding:"8px 12px",background:`${C.orange}22`,border:`1px solid ${C.orange}44`,borderRadius:8,cursor:"pointer",color:C.orange,fontSize:12,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}><Upload size={12}/> Upload</button>
              </div>
            )}

            {/* Expanded Evidence Panel */}
            {detailQ===q.id && r.resp && r.resp !== "N/A" && (
              <div style={{marginTop:10,padding:14,background:C.bg,borderRadius:10,border:`1px solid ${C.border}`}}>
                {/* Evidence Checklist */}
                <div style={{marginBottom:12}}>
                  <div style={{color:C.textMuted,fontSize:11,fontWeight:700,marginBottom:8,textTransform:"uppercase"}}>Evidence Required</div>
                  {evItems.map((item, idx) => {
                    const checked = (r.evChecked||[]).includes(idx);
                    return <div key={idx} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0",borderBottom:idx<evItems.length-1?`1px solid ${C.border}22`:"none"}}>
                      <button onClick={()=>{
                        const curr = r.evChecked||[];
                        const next = checked ? curr.filter(i=>i!==idx) : [...curr, idx];
                        setResp(q.id, {evChecked: next});
                      }} style={{width:20,height:20,borderRadius:6,border:`2px solid ${checked?C.green:C.border}`,background:checked?`${C.green}22`:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                        {checked&&<CheckCircle size={12} color={C.green}/>}
                      </button>
                      <span style={{color:checked?C.text:C.textMuted,fontSize:12,lineHeight:1.5,textDecoration:checked?"none":"none"}}>{item}</span>
                    </div>;
                  })}
                </div>
                {/* Uploaded Files */}
                {(r.evFiles||[]).length > 0 && (
                  <div style={{marginBottom:12}}>
                    <div style={{color:C.textMuted,fontSize:11,fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>Uploaded Files</div>
                    {(r.evFiles||[]).map((f,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                        <File size={12} color={C.green}/>
                        <a href={f.url} target="_blank" rel="noreferrer" style={{color:C.orange,fontSize:12,fontWeight:600,textDecoration:"none"}}>{f.name}</a>
                        <button onClick={()=>{const files=(r.evFiles||[]).filter((_,j)=>j!==i);setResp(q.id,{evFiles:files});}} style={{background:"none",border:"none",cursor:"pointer",color:C.red,padding:2}}><X size={10}/></button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Drive Link */}
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                  <Link size={13} color={C.textDim}/>
                  <input value={r.driveLink||""} onChange={e=>setResp(q.id,{driveLink:e.target.value})} placeholder="Google Drive / OneDrive link..." style={{flex:1,padding:"6px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontFamily:"inherit"}}/>
                </div>
                {/* Notes */}
                <textarea value={r.notes||""} onChange={e=>setResp(q.id,{notes:e.target.value})} placeholder="Assessor notes..." rows={2} style={{width:"100%",padding:"8px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontFamily:"inherit",resize:"vertical"}}/>
                {/* Recommended Action */}
                {r.resp === "No" && q.act && (
                  <div style={{marginTop:10,padding:10,background:`${C.red}11`,borderRadius:8,border:`1px solid ${C.red}33`}}>
                    <div style={{color:C.red,fontSize:11,fontWeight:700,marginBottom:4}}>⚠️ RECOMMENDED ACTION</div>
                    <div style={{color:C.text,fontSize:12,lineHeight:1.5}}>{q.act}</div>
                  </div>
                )}
                {r.resp === "Partial" && q.act && (
                  <div style={{marginTop:10,padding:10,background:`${C.yellow}11`,borderRadius:8,border:`1px solid ${C.yellow}33`}}>
                    <div style={{color:C.yellow,fontSize:11,fontWeight:700,marginBottom:4}}>⚡ RECOMMENDED ACTION</div>
                    <div style={{color:C.text,fontSize:12,lineHeight:1.5}}>{q.act}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>);
};
// =============================================
// RISK REGISTER — with Import/Export
// =============================================
const RiskRegister = ({data,setData}) => {
  const [tab,setTab]=useState("register");
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState(null);
  const [importing,setImporting]=useState(false);
  const blank = {id:"",risk_name:"",description:"",impact:3,likelihood:3,mitigations:"",owner:"",linked_control:"",remarks:"",disabled:false,treatment:"Mitigate",mitigation_steps:"",transfer_to:""};
  const rl = (i,l)=>{const v=i*l;if(v>=15)return{label:"Critical",color:C.red};if(v>=10)return{label:"High",color:C.orange};if(v>=5)return{label:"Medium",color:C.yellow};return{label:"Low",color:C.green};};
  const saveRisk=(r)=>{if(r.id){setData(d=>({...d,risks:d.risks.map(x=>x.id===r.id?r:x)}));}else{setData(d=>({...d,risks:[...d.risks,{...r,id:`r${Date.now()}`}]}));}setToast({msg:"Saved!",type:"success"});setModal(null);};
  const toggle=(r)=>{setData(d=>({...d,risks:d.risks.map(x=>x.id===r.id?{...x,disabled:!x.disabled}:x)}));};
  const del=(id)=>{setData(d=>({...d,risks:d.risks.filter(r=>r.id!==id)}));};
  const upd=(id,f,v)=>{setData(d=>({...d,risks:d.risks.map(r=>r.id===id?{...r,[f]:v}:r)}));};
  
  // Export Risk Register
  const expReg=()=>{const rows=(data.risks||[]).map(r=>({"Risk Name":r.risk_name,Description:r.description,Impact:r.impact,Likelihood:r.likelihood,"Risk Level":rl(r.impact,r.likelihood).label,Score:r.impact*r.likelihood,Owner:r.owner,"Linked Control":r.linked_control,Mitigations:r.mitigations,Status:r.disabled?"Disabled":"Active"}));const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Risk Register");ws["!cols"]=[{wch:25},{wch:35},{wch:8},{wch:10},{wch:10},{wch:6},{wch:15},{wch:15},{wch:30},{wch:10}];XLSX.writeFile(wb,"Risk_Register.xlsx");};
  
  // Export Risk Treatment Plan
  const expRTP=()=>{const rows=(data.risks||[]).filter(r=>!r.disabled).map(r=>({"Risk Name":r.risk_name,"Risk Level":rl(r.impact,r.likelihood).label,Treatment:r.treatment||"Mitigate","Mitigation Steps":r.treatment==="Mitigate"?(r.mitigation_steps||""):"","Transfer To":r.treatment==="Transfer"?(r.transfer_to||""):"",Owner:r.owner}));const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Risk Treatment Plan");ws["!cols"]=[{wch:25},{wch:10},{wch:12},{wch:35},{wch:20},{wch:15}];XLSX.writeFile(wb,"Risk_Treatment_Plan.xlsx");};

  // Import Risk Register from Excel
  const importRisks = async(file) => {
    setImporting(true);
    try {
      const {sheetNames,allSheets} = await parseExcelToSheets(file);
      const rows = allSheets[sheetNames[0]]||[];
      const imported = rows.map((r,i) => {
        // Smart column detection
        const name = r["Risk Name"]||r["Risk"]||r["Name"]||r["risk_name"]||r["Title"]||Object.values(r)[0]||`Risk ${i+1}`;
        const desc = r["Description"]||r["description"]||r["Details"]||r["Detail"]||"";
        const impact = parseInt(r["Impact"]||r["impact"]||3)||3;
        const likelihood = parseInt(r["Likelihood"]||r["likelihood"]||r["Probability"]||r["probability"]||3)||3;
        const owner = r["Owner"]||r["owner"]||r["Risk Owner"]||"";
        const linked = r["Linked Control"]||r["linked_control"]||r["ISO Control"]||r["Control"]||"";
        const mits = r["Mitigations"]||r["mitigations"]||r["Mitigation"]||r["Controls"]||"";
        const treatment = r["Treatment"]||r["treatment"]||"Mitigate";
        const mitSteps = r["Mitigation Steps"]||r["mitigation_steps"]||"";
        const transferTo = r["Transfer To"]||r["transfer_to"]||"";
        const status = r["Status"]||r["status"]||"Active";
        return {
          id:`r${Date.now()}_${i}`, risk_name:String(name), description:String(desc),
          impact:Math.min(5,Math.max(1,impact)), likelihood:Math.min(5,Math.max(1,likelihood)),
          owner:String(owner), linked_control:String(linked), mitigations:String(mits),
          treatment:String(treatment), mitigation_steps:String(mitSteps), transfer_to:String(transferTo),
          disabled:String(status).toLowerCase()==="disabled", remarks:""
        };
      });
      setData(d=>({...d,risks:[...d.risks,...imported]}));
      setToast({msg:`${imported.length} risks imported!`,type:"success"});
    } catch(e) { setToast({msg:"Import failed: "+e.message,type:"error"}); }
    setImporting(false);
  };

  // Import Risk Treatment Plan
  const importRTP = async(file) => {
    setImporting(true);
    try {
      const {sheetNames,allSheets} = await parseExcelToSheets(file);
      const rows = allSheets[sheetNames[0]]||[];
      // Update existing risks treatment info or add new
      const updates = {};
      rows.forEach(r => {
        const name = r["Risk Name"]||r["Risk"]||r["Name"]||"";
        if(!name) return;
        updates[String(name).toLowerCase()] = {
          treatment: r["Treatment"]||r["treatment"]||"Mitigate",
          mitigation_steps: r["Mitigation Steps"]||r["mitigation_steps"]||"",
          transfer_to: r["Transfer To"]||r["transfer_to"]||"",
          owner: r["Owner"]||r["owner"]||""
        };
      });
      setData(d => {
        const newRisks = d.risks.map(risk => {
          const key = risk.risk_name.toLowerCase();
          if(updates[key]) {
            return {...risk,...updates[key]};
          }
          return risk;
        });
        return {...d,risks:newRisks};
      });
      setToast({msg:`Treatment plan applied to ${Object.keys(updates).length} risks!`,type:"success"});
    } catch(e) { setToast({msg:"Import failed: "+e.message,type:"error"}); }
    setImporting(false);
  };

  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Risk Management</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {tab==="register"&&<>
          <FileUploadBtn onFile={importRisks} accept=".xlsx,.xls,.csv" label={importing?"Importing...":"Import Risks"} variant="secondary" size="sm"/>
          {data.risks.length>0&&<Btn variant="secondary" size="sm" onClick={expReg}><Download size={14}/> Export Register</Btn>}
        </>}
        {tab==="rtp"&&<>
          <FileUploadBtn onFile={importRTP} accept=".xlsx,.xls,.csv" label={importing?"Importing...":"Import RTP"} variant="secondary" size="sm"/>
          {data.risks.filter(r=>!r.disabled).length>0&&<Btn variant="secondary" size="sm" onClick={expRTP}><Download size={14}/> Export RTP</Btn>}
        </>}
        <Btn onClick={()=>setModal({...blank})}><Plus size={14}/> Add Risk</Btn>
      </div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:16,background:C.card,borderRadius:10,padding:4,width:"fit-content"}}>
      {["register","rtp"].map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"8px 20px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,background:tab===t?C.orange:"transparent",color:tab===t?"#fff":C.textMuted,fontFamily:"inherit"}}>{t==="register"?"Risk Register":"Risk Treatment Plan"}</button>)}
    </div>
    {tab==="register"?(<Card>
      {data.risks.length===0?<Empty msg="No risks yet — add manually or import from Excel" action="Add Risk" onAction={()=>setModal({...blank})}/>:(
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.bg}}>{["Risk","Impact","Likelihood","Level","Owner","Enabled","Actions"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.textMuted,fontWeight:700,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>
          {data.risks.map(r=>{const rv=rl(r.impact,r.likelihood);return(<tr key={r.id} style={{borderBottom:`1px solid ${C.border}22`,opacity:r.disabled?0.4:1}}>
            <td style={{padding:"10px 12px",color:C.text,maxWidth:200}}><div style={{fontWeight:600}}>{r.risk_name}</div><div style={{fontSize:11,color:C.textMuted}}>{r.description?.substring(0,60)}</div></td>
            <td style={{padding:"10px 12px",color:C.text,textAlign:"center"}}>{r.impact}</td>
            <td style={{padding:"10px 12px",color:C.text,textAlign:"center"}}>{r.likelihood}</td>
            <td style={{padding:"10px 12px"}}><Badge color={rv.color}>{rv.label} ({r.impact*r.likelihood})</Badge></td>
            <td style={{padding:"10px 12px",color:C.textMuted}}>{r.owner||"—"}</td>
            <td style={{padding:"10px 12px"}}><button onClick={()=>toggle(r)} style={{background:r.disabled?`${C.red}22`:`${C.green}22`,border:`1px solid ${r.disabled?C.red:C.green}44`,borderRadius:6,cursor:"pointer",padding:"4px 10px",color:r.disabled?C.red:C.green,fontSize:11,fontWeight:700,fontFamily:"inherit"}}>{r.disabled?"Disabled":"Enabled"}</button></td>
            <td style={{padding:"10px 12px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setModal({...r})} style={{background:"none",border:"none",cursor:"pointer",color:C.orange}}><Edit3 size={15}/></button><button onClick={()=>del(r.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><Trash2 size={15}/></button></div></td>
          </tr>);})}
        </tbody></table></div>)}
    </Card>):(<Card title="Risk Treatment Plan">
      {data.risks.length===0?<Empty msg="No risks yet"/>:(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {data.risks.map(r=>{const rv=rl(r.impact,r.likelihood);return(<div key={r.id} style={{background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,padding:16,opacity:r.disabled?0.4:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontWeight:700,color:C.text}}>{r.risk_name}</span><Badge color={rv.color}>{rv.label}</Badge>{r.disabled&&<Badge color={C.red}>Disabled</Badge>}</div>
              <button onClick={()=>toggle(r)} style={{background:"none",border:"none",cursor:"pointer",color:r.disabled?C.green:C.red,fontSize:11,fontWeight:600}}>{r.disabled?"Enable":"Disable"}</button>
            </div>
            {!r.disabled&&<div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12}}>
              <div><label style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Treatment</label><select value={r.treatment||"Mitigate"} onChange={e=>upd(r.id,"treatment",e.target.value)} style={{width:"100%",padding:"6px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,marginTop:4,fontFamily:"inherit"}}>{["Accept","Transfer","Mitigate","Avoid"].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
              <div>
                {r.treatment==="Mitigate"&&<div><label style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Mitigation Steps</label><textarea value={r.mitigation_steps||""} rows={2} onChange={e=>upd(r.id,"mitigation_steps",e.target.value)} style={{width:"100%",padding:"6px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,marginTop:4,resize:"vertical",fontFamily:"inherit"}} placeholder="Describe mitigation..."/></div>}
                {r.treatment==="Transfer"&&<div><label style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Transfer To</label><input value={r.transfer_to||""} onChange={e=>upd(r.id,"transfer_to",e.target.value)} style={{width:"100%",padding:"6px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,marginTop:4,fontFamily:"inherit"}}/></div>}
                {r.treatment==="Accept"&&<div style={{fontSize:12,color:C.textMuted,marginTop:16}}>Risk accepted — no further action.</div>}
                {r.treatment==="Avoid"&&<div style={{fontSize:12,color:C.textMuted,marginTop:16}}>Risk to be avoided — activity eliminated.</div>}
              </div>
            </div>}
          </div>);})}
        </div>)}
    </Card>)}
    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.id?"Edit Risk":"Add New Risk"} wide>
      {modal&&(()=>{const u=(f,v)=>setModal(p=>({...p,[f]:v}));return(<div>
        <Input label="Risk Name" value={modal.risk_name} onChange={v=>u("risk_name",v)} placeholder="e.g., Data breach via phishing"/>
        <Input label="Description" value={modal.description} onChange={v=>u("description",v)} textarea/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Input label="Impact (1-5)" value={modal.impact} onChange={v=>u("impact",parseInt(v)||1)} select options={[1,2,3,4,5].map(n=>({value:n,label:`${n}`}))}/>
          <Input label="Likelihood (1-5)" value={modal.likelihood} onChange={v=>u("likelihood",parseInt(v)||1)} select options={[1,2,3,4,5].map(n=>({value:n,label:`${n}`}))}/>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:C.textMuted,marginBottom:4,fontWeight:600}}>Risk Level</label><div style={{padding:"8px 12px"}}><Badge color={rl(modal.impact,modal.likelihood).color}>{rl(modal.impact,modal.likelihood).label} ({modal.impact*modal.likelihood})</Badge></div></div>
        </div>
        <Input label="Mitigations" value={modal.mitigations} onChange={v=>u("mitigations",v)} textarea/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Input label="Owner" value={modal.owner} onChange={v=>u("owner",v)}/><Input label="Linked ISO Control" value={modal.linked_control} onChange={v=>u("linked_control",v)} placeholder="e.g., A.8.7"/></div>
        <Input label="Remarks" value={modal.remarks} onChange={v=>u("remarks",v)} textarea/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={()=>saveRisk(modal)}><Save size={14}/> Save Risk</Btn></div>
      </div>);})()}
    </Modal>
  </div>);
};

// =============================================
// ASSET REGISTER — with Import/Export (separate sheets per category)
// =============================================
const AssetRegister = ({data,setData}) => {
  const cats=["Informational","Physical","People","Software","Service"];
  const [tab,setTab]=useState(cats[0]);const [modal,setModal]=useState(null);const [toast,setToast]=useState(null);const [importing,setImporting]=useState(false);
  const blank = {id:"",asset_name:"",description:"",owner:"",custodian:"",c_rating:1,i_rating:1,a_rating:1};
  const save=(a)=>{if(a.id){setData(d=>({...d,assets:d.assets.map(x=>x.id===a.id?{...a,category:tab}:x)}));}else{setData(d=>({...d,assets:[...d.assets,{...a,id:`a${Date.now()}`,category:tab}]}));}setToast({msg:"Saved!",type:"success"});setModal(null);};
  
  // Export with separate sheets per category
  const exp=()=>{
    const wb=XLSX.utils.book_new();
    cats.forEach(c=>{
      const rows=data.assets.filter(a=>a.category===c).map(a=>({"Asset Name":a.asset_name,Description:a.description,Owner:a.owner,Custodian:a.custodian||"","Confidentiality":a.c_rating,"Integrity":a.i_rating,"Availability":a.a_rating}));
      const ws=XLSX.utils.json_to_sheet(rows.length>0?rows:[{"Asset Name":"","Description":"","Owner":"","Custodian":"","Confidentiality":"","Integrity":"","Availability":""}]);
      ws["!cols"]=[{wch:25},{wch:35},{wch:15},{wch:15},{wch:14},{wch:10},{wch:12}];
      XLSX.utils.book_append_sheet(wb,ws,c);
    });
    XLSX.writeFile(wb,"Asset_Register.xlsx");
  };

  // Import from Excel — detect category from sheet names or Category column
  const importAssets = async(file) => {
    setImporting(true);
    try {
      const {sheetNames,allSheets} = await parseExcelToSheets(file);
      const imported = [];
      
      sheetNames.forEach(sheetName => {
        const rows = allSheets[sheetName]||[];
        // Try to match sheet name to a category
        const matchedCat = cats.find(c => sheetName.toLowerCase().includes(c.toLowerCase())) || null;
        
        rows.forEach((r,i) => {
          const name = r["Asset Name"]||r["asset_name"]||r["Name"]||r["Asset"]||Object.values(r)[0]||"";
          if(!name) return;
          const desc = r["Description"]||r["description"]||r["Details"]||"";
          const owner = r["Owner"]||r["owner"]||r["Asset Owner"]||"";
          const custodian = r["Custodian"]||r["custodian"]||"";
          const cRat = parseInt(r["Confidentiality"]||r["C"]||r["c_rating"]||1)||1;
          const iRat = parseInt(r["Integrity"]||r["I"]||r["i_rating"]||1)||1;
          const aRat = parseInt(r["Availability"]||r["A"]||r["a_rating"]||1)||1;
          // Category from column or sheet name
          const catCol = r["Category"]||r["category"]||r["Type"]||"";
          const category = cats.find(c => c.toLowerCase()===String(catCol).toLowerCase()) || matchedCat || tab;
          
          imported.push({
            id:`a${Date.now()}_${sheetName}_${i}`,
            asset_name:String(name), description:String(desc), owner:String(owner),
            custodian:String(custodian), c_rating:Math.min(5,Math.max(1,cRat)),
            i_rating:Math.min(5,Math.max(1,iRat)), a_rating:Math.min(5,Math.max(1,aRat)),
            category
          });
        });
      });
      
      setData(d=>({...d,assets:[...d.assets,...imported]}));
      setToast({msg:`${imported.length} assets imported from ${sheetNames.length} sheet(s)!`,type:"success"});
    } catch(e) { setToast({msg:"Import failed: "+e.message,type:"error"}); }
    setImporting(false);
  };

  const filtered = data.assets.filter(a=>a.category===tab);
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Asset Register</h2>
      <div style={{display:"flex",gap:8}}>
        <FileUploadBtn onFile={importAssets} accept=".xlsx,.xls,.csv" label={importing?"Importing...":"Import"} variant="secondary" size="sm"/>
        {data.assets.length>0&&<Btn variant="secondary" size="sm" onClick={exp}><Download size={14}/> Export</Btn>}
        <Btn onClick={()=>setModal({...blank})}><Plus size={14}/> Add Asset</Btn>
      </div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:16,background:C.card,borderRadius:10,padding:4,overflowX:"auto"}}>{cats.map(c=><button key={c} onClick={()=>setTab(c)} style={{padding:"8px 16px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,whiteSpace:"nowrap",background:tab===c?C.orange:"transparent",color:tab===c?"#fff":C.textMuted,fontFamily:"inherit"}}>{c} <span style={{opacity:0.6}}>({data.assets.filter(a=>a.category===c).length})</span></button>)}</div>
    <Card>
      {filtered.length===0?<Empty msg={`No ${tab} assets`} action="Add Asset" onAction={()=>setModal({...blank})}/>:(
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.bg}}>{["Asset Name","Description","Owner","Custodian","C","I","A",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.textMuted,fontWeight:700,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>{filtered.map(a=><tr key={a.id} style={{borderBottom:`1px solid ${C.border}22`}}>
          <td style={{padding:"10px 12px",color:C.text,fontWeight:600}}>{a.asset_name}</td>
          <td style={{padding:"10px 12px",color:C.textMuted,maxWidth:180,fontSize:12}}>{a.description}</td>
          <td style={{padding:"10px 12px",color:C.textMuted}}>{a.owner}</td>
          <td style={{padding:"10px 12px",color:C.textMuted}}>{a.custodian||"—"}</td>
          {["c_rating","i_rating","a_rating"].map(f=><td key={f} style={{padding:"10px 12px",textAlign:"center"}}><Badge color={a[f]>=4?C.red:a[f]>=3?C.yellow:C.green}>{a[f]}</Badge></td>)}
          <td style={{padding:"10px 12px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setModal({...a})} style={{background:"none",border:"none",cursor:"pointer",color:C.orange}}><Edit3 size={15}/></button><button onClick={()=>setData(d=>({...d,assets:d.assets.filter(x=>x.id!==a.id)}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><Trash2 size={15}/></button></div></td>
        </tr>)}</tbody></table></div>)}
    </Card>
    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.id?"Edit Asset":`Add ${tab} Asset`}>
      {modal&&(()=>{const u=(f,v)=>setModal(p=>({...p,[f]:v}));return(<div>
        <Input label="Asset Name" value={modal.asset_name} onChange={v=>u("asset_name",v)}/>
        <Input label="Description" value={modal.description} onChange={v=>u("description",v)} textarea/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Input label="Owner" value={modal.owner} onChange={v=>u("owner",v)}/><Input label="Custodian" value={modal.custodian||""} onChange={v=>u("custodian",v)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Input label="Confidentiality (1-5)" value={modal.c_rating} onChange={v=>u("c_rating",parseInt(v)||1)} select options={[1,2,3,4,5].map(n=>({value:n,label:`${n}`}))}/>
          <Input label="Integrity (1-5)" value={modal.i_rating} onChange={v=>u("i_rating",parseInt(v)||1)} select options={[1,2,3,4,5].map(n=>({value:n,label:`${n}`}))}/>
          <Input label="Availability (1-5)" value={modal.a_rating} onChange={v=>u("a_rating",parseInt(v)||1)} select options={[1,2,3,4,5].map(n=>({value:n,label:`${n}`}))}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={()=>save(modal)}><Save size={14}/> Save</Btn></div>
      </div>);})()}
    </Modal>
  </div>);
};

// =============================================
// POLICIES (unchanged)
// =============================================
const PoliciesModule = ({data,setData}) => {
  const [toast,setToast]=useState(null);const [preview,setPreview]=useState(null);const [nameModal,setNameModal]=useState(null);const [uploading,setUploading]=useState(false);
  const {token,user}=useAuth();
  const handleUpload = async(file)=>{
    setUploading(true);
    try { const ref = await uploadToStorage(token,user.id,"policies",file); setNameModal({name:file.name.replace(/\.[^.]+$/,""),file:ref}); }
    catch(e) { setToast({msg:"Upload failed: "+e.message,type:"error"}); }
    setUploading(false);
  };
  const savePolicy=()=>{if(!nameModal?.name)return;setData(d=>({...d,policies:[...d.policies,{id:`pol${Date.now()}`,name:nameModal.name,file:nameModal.file}]}));setNameModal(null);setToast({msg:"Policy added!",type:"success"});};
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {preview&&<FilePreviewModal file={preview} onClose={()=>setPreview(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Policies</h2><p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>Upload and manage ISMS policies</p></div>
      <FileUploadBtn onFile={handleUpload} accept="*" label={uploading?"Uploading...":"Add Policy"}/>
    </div>
    <Card>
      {data.policies.length===0?<Empty msg="No policies uploaded yet"/>:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>{data.policies.map(p=>(
          <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:16,background:C.bg,borderRadius:10,border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flex:1}}>
              <FileText size={20} color={C.orange}/>
              <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{p.name}</div>
              {p.file&&<button onClick={()=>setPreview(p.file)} style={{background:"none",border:"none",cursor:"pointer",color:C.blue,fontSize:12,padding:0,textDecoration:"underline"}}>{p.file.name} — View</button>}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              {p.file&&<button onClick={()=>setPreview(p.file)} style={{background:"none",border:"none",cursor:"pointer",color:C.blue}}><Eye size={16}/></button>}
              <button onClick={()=>setData(d=>({...d,policies:d.policies.filter(x=>x.id!==p.id)}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><Trash2 size={16}/></button>
            </div>
          </div>
        ))}</div>)}
    </Card>
    <Modal open={!!nameModal} onClose={()=>setNameModal(null)} title="Name this Policy">
      {nameModal&&<div><Input label="Policy Name" value={nameModal.name} onChange={v=>setNameModal(p=>({...p,name:v}))}/><div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>File: {nameModal.file?.name}</div><div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn variant="secondary" onClick={()=>setNameModal(null)}>Cancel</Btn><Btn onClick={savePolicy}><Save size={14}/> Save</Btn></div></div>}
    </Modal>
  </div>);
};

// =============================================
// EVIDENCE (unchanged)
// =============================================
const EvidenceModule = ({data,setData}) => {
  const [toast,setToast]=useState(null);const [preview,setPreview]=useState(null);
  const {token,user}=useAuth();
  const evList = data.evidenceList||[];
  const handleUploadList = async(file)=>{
    try{const{sheetNames,allSheets}=await parseExcelToSheets(file);const rows=allSheets[sheetNames[0]]||[];const items=rows.map((r,i)=>({...r,_id:`ev${Date.now()}_${i}`,_evidenceFile:null}));setData(d=>({...d,evidenceList:items}));setToast({msg:`${items.length} evidence items loaded!`,type:"success"});}catch{setToast({msg:"Error reading file",type:"error"});}
  };
  const handleEvUpload = async(id,file)=>{
    try{const ref=await uploadToStorage(token,user.id,"evidence",file);setData(d=>({...d,evidenceList:d.evidenceList.map(e=>e._id===id?{...e,_evidenceFile:ref}:e)}));setToast({msg:"Evidence uploaded!",type:"success"});}catch(e){setToast({msg:"Upload failed",type:"error"});}
  };
  const cols = evList.length>0?Object.keys(evList[0]).filter(k=>!k.startsWith("_")):[];
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {preview&&<FilePreviewModal file={preview} onClose={()=>setPreview(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Evidence</h2><p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>Upload evidence list and attach evidence for each item</p></div>
      <FileUploadBtn onFile={handleUploadList} accept=".xlsx,.xls,.csv" label="Upload Evidence List"/>
    </div>
    {evList.length>0?(<Card><div style={{overflow:"auto",maxHeight:600}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:C.bg,position:"sticky",top:0,zIndex:1}}>
        {cols.map(c=><th key={c} style={{padding:"8px 10px",textAlign:"left",color:C.orange,fontWeight:700,fontSize:11,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap"}}>{c}</th>)}
        <th style={{padding:"8px 10px",textAlign:"left",color:C.orange,fontWeight:700,fontSize:11,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`}}>Evidence</th>
      </tr></thead><tbody>{evList.map(e=><tr key={e._id} style={{borderBottom:`1px solid ${C.border}22`}}>
        {cols.map(c=><td key={c} style={{padding:"7px 10px",color:C.text,maxWidth:250,overflow:"hidden",textOverflow:"ellipsis"}}>{String(e[c]??"")}</td>)}
        <td style={{padding:"7px 10px"}}>{e._evidenceFile?<button onClick={()=>setPreview(e._evidenceFile)} style={{background:`${C.green}22`,border:`1px solid ${C.green}44`,borderRadius:6,cursor:"pointer",padding:"3px 8px",color:C.green,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}><CheckCircle size={10}/> {e._evidenceFile.name}</button>:<InlineUpload onUpload={(f)=>handleEvUpload(e._id,f)}/>}</td>
      </tr>)}</tbody></table>
    </div></Card>):<Card><Empty msg="Upload an Excel file with your evidence list"/></Card>}
  </div>);
};

// =============================================
// ROLES & RACI — with Export
// =============================================
const RolesRaci = ({data,setData}) => {
  const [tab,setTab]=useState("roles");const [modal,setModal]=useState(null);const [deptInput,setDeptInput]=useState("");const [selectedDept,setSelectedDept]=useState(null);const [toast,setToast]=useState(null);
  const depts=[...new Set(data.roles.map(r=>r.department))];
  const saveRole=(r)=>{if(r.id){setData(d=>({...d,roles:d.roles.map(x=>x.id===r.id?{...r,department:selectedDept}:x)}));}else{setData(d=>({...d,roles:[...d.roles,{...r,id:`ro${Date.now()}`,department:selectedDept}]}));}setToast({msg:"Saved!",type:"success"});setModal(null);};
  const saveRaci=(item)=>{if(item.id){setData(d=>({...d,raci:d.raci.map(r=>r.id===item.id?item:r)}));}else{setData(d=>({...d,raci:[...d.raci,{...item,id:`rc${Date.now()}`}]}));}setToast({msg:"Saved!",type:"success"});setModal(null);};
  const expRoles=()=>{const wb=XLSX.utils.book_new();depts.forEach(d=>{const rows=data.roles.filter(r=>r.department===d).map(r=>({Role:r.role_name,KRA:r.kra,KPI:r.kpi}));if(rows.length>0){const ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=[{wch:25},{wch:40},{wch:40}];XLSX.utils.book_append_sheet(wb,ws,d.substring(0,31));}});if(wb.SheetNames.length===0)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{Role:"",KRA:"",KPI:""}]),"Empty");XLSX.writeFile(wb,"Roles.xlsx");};
  const expRaci=()=>{const rows=data.raci.map(r=>({Process:r.process_name,Responsible:r.responsible,Accountable:r.accountable,Consulted:r.consulted,Informed:r.informed}));const ws=XLSX.utils.json_to_sheet(rows.length>0?rows:[{Process:"",Responsible:"",Accountable:"",Consulted:"",Informed:""}]);const wb=XLSX.utils.book_new();ws["!cols"]=[{wch:30},{wch:20},{wch:20},{wch:20},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,"RACI Matrix");XLSX.writeFile(wb,"RACI_Matrix.xlsx");};
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Roles & RACI</h2>
      <div style={{display:"flex",gap:8}}>
        {tab==="roles"&&data.roles.length>0&&<Btn variant="secondary" size="sm" onClick={expRoles}><Download size={14}/> Export Roles</Btn>}
        {tab==="raci"&&data.raci.length>0&&<Btn variant="secondary" size="sm" onClick={expRaci}><Download size={14}/> Export RACI</Btn>}
        <Btn onClick={()=>setModal(tab==="roles"?{role_name:"",kra:"",kpi:""}:{process_name:"",responsible:"",accountable:"",consulted:"",informed:"",_type:"raci"})}><Plus size={14}/> Add {tab==="roles"?"Role":"RACI"}</Btn>
      </div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:16,background:C.card,borderRadius:10,padding:4,width:"fit-content"}}>
      {["roles","raci"].map(t=><button key={t} onClick={()=>{setTab(t);setSelectedDept(null);}} style={{padding:"8px 20px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,background:tab===t?C.orange:"transparent",color:tab===t?"#fff":C.textMuted,fontFamily:"inherit"}}>{t==="roles"?"Roles & KRA/KPI":"RACI Matrix"}</button>)}
    </div>
    {tab==="roles"?(!selectedDept?(<Card title="Select or Create Department">
      <div style={{display:"flex",gap:8,marginBottom:16}}><input value={deptInput} onChange={e=>setDeptInput(e.target.value)} placeholder="New department name..." style={{flex:1,padding:"8px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"inherit"}}/><Btn onClick={()=>{if(deptInput.trim()){setSelectedDept(deptInput.trim());setDeptInput("");}}}>Create</Btn></div>
      {depts.length>0?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{depts.map(d=><button key={d} onClick={()=>setSelectedDept(d)} style={{padding:"10px 18px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit"}}>{d} <span style={{color:C.textDim,marginLeft:6}}>({data.roles.filter(r=>r.department===d).length})</span></button>)}</div>:<Empty msg="No departments yet"/>}
    </Card>):(<div>
      <Btn variant="ghost" onClick={()=>setSelectedDept(null)} style={{marginBottom:12}}><ArrowLeft size={14}/> Back</Btn>
      <Card title={`${selectedDept} — Roles`}>
        {data.roles.filter(r=>r.department===selectedDept).length===0?<Empty msg="No roles yet" action="Add Role" onAction={()=>setModal({role_name:"",kra:"",kpi:""})}/>:(
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.bg}}>{["Role","KRA","KPI",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.textMuted,fontWeight:700,fontSize:11,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>{data.roles.filter(r=>r.department===selectedDept).map(r=><tr key={r.id} style={{borderBottom:`1px solid ${C.border}22`}}>
            <td style={{padding:"10px 12px",color:C.text,fontWeight:600}}>{r.role_name}</td>
            <td style={{padding:"10px 12px",color:C.textMuted,fontSize:12}}>{r.kra}</td>
            <td style={{padding:"10px 12px",color:C.textMuted,fontSize:12}}>{r.kpi}</td>
            <td style={{padding:"10px 12px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setModal({...r})} style={{background:"none",border:"none",cursor:"pointer",color:C.orange}}><Edit3 size={15}/></button><button onClick={()=>setData(d=>({...d,roles:d.roles.filter(x=>x.id!==r.id)}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><Trash2 size={15}/></button></div></td>
          </tr>)}</tbody></table></div>)}
      </Card>
    </div>)):(
      <Card>{data.raci.length===0?<Empty msg="No RACI entries" action="Add RACI" onAction={()=>setModal({process_name:"",responsible:"",accountable:"",consulted:"",informed:"",_type:"raci"})}/>:(
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.bg}}>{["Process","R","A","C","I",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.textMuted,fontWeight:700,fontSize:11,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>{data.raci.map(r=><tr key={r.id} style={{borderBottom:`1px solid ${C.border}22`}}>
          <td style={{padding:"10px 12px",color:C.text,fontWeight:600}}>{r.process_name}</td>
          {["responsible","accountable","consulted","informed"].map(f=><td key={f} style={{padding:"10px 12px",color:C.textMuted,fontSize:12}}>{r[f]||"—"}</td>)}
          <td style={{padding:"10px 12px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setModal({...r,_type:"raci"})} style={{background:"none",border:"none",cursor:"pointer",color:C.orange}}><Edit3 size={15}/></button><button onClick={()=>setData(d=>({...d,raci:d.raci.filter(x=>x.id!==r.id)}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><Trash2 size={15}/></button></div></td>
        </tr>)}</tbody></table></div>)}</Card>
    )}
    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?._type==="raci"?"RACI Entry":"Role"}>
      {modal&&(modal._type==="raci"?(<div>
        <Input label="Process" value={modal.process_name||""} onChange={v=>setModal(p=>({...p,process_name:v}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Input label="Responsible" value={modal.responsible||""} onChange={v=>setModal(p=>({...p,responsible:v}))}/><Input label="Accountable" value={modal.accountable||""} onChange={v=>setModal(p=>({...p,accountable:v}))}/><Input label="Consulted" value={modal.consulted||""} onChange={v=>setModal(p=>({...p,consulted:v}))}/><Input label="Informed" value={modal.informed||""} onChange={v=>setModal(p=>({...p,informed:v}))}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={()=>saveRaci(modal)}><Save size={14}/> Save</Btn></div>
      </div>):(<div>
        <Input label="Role Name" value={modal.role_name||""} onChange={v=>setModal(p=>({...p,role_name:v}))}/>
        <Input label="KRA" value={modal.kra||""} onChange={v=>setModal(p=>({...p,kra:v}))} textarea/>
        <Input label="KPI" value={modal.kpi||""} onChange={v=>setModal(p=>({...p,kpi:v}))} textarea/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={()=>saveRole(modal)}><Save size={14}/> Save</Btn></div>
      </div>))}
    </Modal>
  </div>);
};

// =============================================
// VAPT (unchanged)
// =============================================
const VAPTManagement = ({data,setData}) => {
  const [toast,setToast]=useState(null);const [modal,setModal]=useState(null);const [preview,setPreview]=useState(null);
  const {token,user}=useAuth();
  const vapt = data.vapt||[];
  const handleUpload = async(file)=>{
    try {
      const {sheetNames,allSheets}=await parseExcelToSheets(file);const rows=allSheets[sheetNames[0]]||[];
      const findings = rows.map((r,i)=>{
        const name=r["Finding"]||r["Vulnerability"]||r["finding_name"]||r["Name"]||r["Title"]||r["Issue"]||Object.values(r)[0]||`Finding ${i+1}`;
        const sev=r["Severity"]||r["Risk"]||r["severity"]||r["Priority"]||"Medium";
        const desc=r["Description"]||r["description"]||r["Details"]||"";
        const rem=r["Remediation"]||r["remediation"]||r["Fix"]||r["Recommendation"]||"";
        return {id:`v${Date.now()}_${i}`,finding_name:String(name),severity:String(sev),description:String(desc),remediation:String(rem),status:"Open"};
      });
      let fileRef=null;
      try{fileRef=await uploadToStorage(token,user.id,"vapt",file);}catch(e){}
      setData(d=>({...d,vapt:findings,vaptFileRef:fileRef,vaptFileName:file.name}));
      setToast({msg:`${findings.length} vulnerabilities identified!`,type:"success"});
    } catch{setToast({msg:"Error reading file",type:"error"});}
  };
  const sevCol={Critical:C.red,High:C.orange,Medium:C.yellow,Low:C.green,Info:C.blue};
  const statCol={Open:C.red,Patched:C.yellow,Closed:C.green};
  const saveFinding=(f)=>{if(f.id&&vapt.find(v=>v.id===f.id)){setData(d=>({...d,vapt:d.vapt.map(v=>v.id===f.id?f:v)}));}else{setData(d=>({...d,vapt:[...(d.vapt||[]),{...f,id:`v${Date.now()}`}]}));}setToast({msg:"Saved!",type:"success"});setModal(null);};
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {preview&&<FilePreviewModal file={preview} onClose={()=>setPreview(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>VAPT</h2><p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>Upload report to auto-identify vulnerabilities</p></div>
      <div style={{display:"flex",gap:8}}><FileUploadBtn onFile={handleUpload} accept=".xlsx,.xls,.csv" label="Upload Report"/><Btn variant="secondary" onClick={()=>setModal({id:"",finding_name:"",severity:"Medium",description:"",status:"Open",remediation:""})}><Plus size={14}/> Add Manual</Btn></div>
    </div>
    {data.vaptFileName&&<div style={{marginBottom:12,padding:"8px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}><FileSpreadsheet size={14} color={C.green}/><span style={{color:C.text,fontSize:13}}>{data.vaptFileName}</span><Badge color={C.green}>{vapt.length} findings</Badge>{data.vaptFileRef?.url&&<a href={data.vaptFileRef.url} target="_blank" rel="noreferrer" style={{color:C.orange,fontSize:12,fontWeight:600,textDecoration:"none",marginLeft:"auto"}}>Download ↗</a>}</div>}
    <Card>
      {vapt.length===0?<Empty msg="Upload a VAPT report to identify vulnerabilities"/>:(
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.bg}}>{["Finding","Severity","Status",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.textMuted,fontWeight:700,fontSize:11,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>{vapt.map(f=><tr key={f.id} style={{borderBottom:`1px solid ${C.border}22`}}>
          <td style={{padding:"10px 12px"}}><div style={{color:C.text,fontWeight:600}}>{f.finding_name}</div>{f.description&&<div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{f.description.substring(0,80)}</div>}</td>
          <td style={{padding:"10px 12px"}}><Badge color={sevCol[f.severity]||C.textMuted}>{f.severity}</Badge></td>
          <td style={{padding:"10px 12px"}}><select value={f.status} onChange={e=>setData(d=>({...d,vapt:d.vapt.map(v=>v.id===f.id?{...v,status:e.target.value}:v)}))} style={{padding:"4px 8px",background:"transparent",border:`1px solid ${(statCol[f.status]||C.textMuted)}44`,borderRadius:6,color:statCol[f.status]||C.textMuted,fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{["Open","Patched","Closed"].map(s=><option key={s} value={s} style={{background:C.bg,color:C.text}}>{s}</option>)}</select></td>
          <td style={{padding:"10px 12px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>setModal({...f})} style={{background:"none",border:"none",cursor:"pointer",color:C.orange}}><Edit3 size={15}/></button><button onClick={()=>setData(d=>({...d,vapt:d.vapt.filter(v=>v.id!==f.id)}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><Trash2 size={15}/></button></div></td>
        </tr>)}</tbody></table></div>)}
    </Card>
    <Modal open={!!modal} onClose={()=>setModal(null)} title="Finding" wide>
      {modal&&<div>
        <Input label="Finding Name" value={modal.finding_name} onChange={v=>setModal(m=>({...m,finding_name:v}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Input label="Severity" value={modal.severity} onChange={v=>setModal(m=>({...m,severity:v}))} select options={["Critical","High","Medium","Low","Info"]}/><Input label="Status" value={modal.status} onChange={v=>setModal(m=>({...m,status:v}))} select options={["Open","Patched","Closed"]}/></div>
        <Input label="Description" value={modal.description} onChange={v=>setModal(m=>({...m,description:v}))} textarea/><Input label="Remediation" value={modal.remediation} onChange={v=>setModal(m=>({...m,remediation:v}))} textarea/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={()=>saveFinding(modal)}><Save size={14}/> Save</Btn></div>
      </div>}
    </Modal>
  </div>);
};

// =============================================
// TRAINING — Upload & Preview
// =============================================
const TrainingModule = ({data,setData}) => {
  const [toast,setToast]=useState(null);const [preview,setPreview]=useState(null);const [uploading,setUploading]=useState(false);
  const [editId,setEditId]=useState(null);const [editName,setEditName]=useState("");const [editDesc,setEditDesc]=useState("");
  const {token,user}=useAuth();
  const trainings = data.trainings||[];

  const handleUpload = async(file) => {
    setUploading(true);
    try {
      const ref = await uploadToStorage(token,user.id,"training",file);
      const ext = file.name.split(".").pop().toLowerCase();
      const typeLabel = {pptx:"Presentation",ppt:"Presentation",pdf:"PDF Document",docx:"Word Document",doc:"Word Document",xlsx:"Spreadsheet",mp4:"Video",png:"Image",jpg:"Image",jpeg:"Image"}[ext]||"File";
      const item = {id:`tr${Date.now()}`,name:file.name.replace(/\.[^.]+$/,""),description:"",file:ref,typeLabel,date:new Date().toISOString().slice(0,10),status:"Active"};
      setData(d=>({...d,trainings:[...(d.trainings||[]),item]}));
      setToast({msg:`Training "${item.name}" uploaded!`,type:"success"});
    } catch(e) { setToast({msg:"Upload failed: "+e.message,type:"error"}); }
    setUploading(false);
  };

  const remove = (id) => { setData(d=>({...d,trainings:(d.trainings||[]).filter(t=>t.id!==id)})); setToast({msg:"Removed",type:"success"}); };

  const saveEdit = () => {
    setData(d=>({...d,trainings:(d.trainings||[]).map(t=>t.id===editId?{...t,name:editName,description:editDesc}:t)}));
    setEditId(null); setToast({msg:"Updated!",type:"success"});
  };

  const iconForExt = (ext) => {
    if(["pptx","ppt","ppsx"].includes(ext)) return {icon:Monitor,color:"#A855F7"};
    if(["pdf"].includes(ext)) return {icon:FileText,color:C.red};
    if(["docx","doc"].includes(ext)) return {icon:FileText,color:C.blue};
    if(["xlsx","xls","csv"].includes(ext)) return {icon:FileSpreadsheet,color:C.green};
    if(["mp4","webm","mov"].includes(ext)) return {icon:Monitor,color:C.yellow};
    if(["png","jpg","jpeg","gif","svg"].includes(ext)) return {icon:Image,color:C.orange};
    return {icon:File,color:C.textMuted};
  };

  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {preview&&<FilePreviewModal file={preview} onClose={()=>setPreview(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div>
        <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Training</h2>
        <p style={{color:C.textMuted,margin:"4px 0 0",fontSize:13}}>Upload training materials — PPT, PDF, DOCX, videos, and more</p>
      </div>
      <FileUploadBtn onFile={handleUpload} accept="*" label={uploading?"Uploading...":"Upload Material"}/>
    </div>

    {trainings.length===0 ? (
      <Card>
        <Empty msg="No training materials yet — upload PPT, PDF, DOCX, or video files"/>
        <div style={{textAlign:"center",marginTop:8,fontSize:12,color:C.textDim}}>
          Supported: PPTX, PDF, DOCX, XLSX, MP4, images, and more. All files can be previewed in-app.
        </div>
      </Card>
    ) : (
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
        {trainings.map(t => {
          const ext = (t.file?.type||t.file?.name?.split(".").pop()||"").toLowerCase();
          const {icon:Icon,color} = iconForExt(ext);
          return (
            <div key={t.id} style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden",transition:"all 0.2s",cursor:"pointer"}} onClick={()=>t.file&&setPreview(t.file)}>
              {/* Preview thumbnail area */}
              <div style={{height:140,background:`linear-gradient(135deg,${color}15,${C.bg})`,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${C.border}`,position:"relative"}}>
                <Icon size={48} color={color} strokeWidth={1.5}/>
                <div style={{position:"absolute",top:10,right:10}}><Badge color={color} bg={`${color}22`}>{ext.toUpperCase()}</Badge></div>
                {t.file?.url&&<div style={{position:"absolute",bottom:10,right:10,padding:"4px 10px",borderRadius:6,background:`${C.orange}cc`,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><Eye size={11}/> Preview</div>}
              </div>
              {/* Info */}
              <div style={{padding:14}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{color:C.text,fontSize:14,fontWeight:700,flex:1,lineHeight:1.3}}>{t.name}</div>
                  <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8}}>
                    <button onClick={()=>{setEditId(t.id);setEditName(t.name);setEditDesc(t.description||"");}} style={{background:"none",border:"none",cursor:"pointer",color:C.orange,padding:2}}><Edit3 size={13}/></button>
                    <button onClick={()=>remove(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.red,padding:2}}><Trash2 size={13}/></button>
                  </div>
                </div>
                {t.description&&<div style={{color:C.textMuted,fontSize:12,lineHeight:1.4,marginBottom:6}}>{t.description}</div>}
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{color:C.textDim,fontSize:11}}>{t.date}</span>
                  <span style={{color:C.textDim,fontSize:11}}>•</span>
                  <span style={{color,fontSize:11,fontWeight:600}}>{t.typeLabel||ext.toUpperCase()}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <button onClick={()=>t.file&&setPreview(t.file)} style={{flex:1,padding:"6px 0",borderRadius:6,border:`1px solid ${C.orange}44`,background:`${C.orange}11`,color:C.orange,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Eye size={12}/> View</button>
                  {t.file?.url&&<a href={t.file.url} target="_blank" rel="noreferrer" style={{flex:1,padding:"6px 0",borderRadius:6,border:`1px solid ${C.blue}44`,background:`${C.blue}11`,color:C.blue,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:4,textDecoration:"none"}}><Download size={12}/> Download</a>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* Edit Name/Description Modal */}
    <Modal open={!!editId} onClose={()=>setEditId(null)} title="Edit Training Material">
      {editId&&<div>
        <Input label="Name" value={editName} onChange={v=>setEditName(v)} placeholder="Training name..."/>
        <Input label="Description" value={editDesc} onChange={v=>setEditDesc(v)} textarea placeholder="Brief description..."/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setEditId(null)}>Cancel</Btn><Btn onClick={saveEdit}><Save size={14}/> Save</Btn></div>
      </div>}
    </Modal>
  </div>);
};

// =============================================
// INTERNAL AUDIT (unchanged)
// =============================================
const InternalAudit = ({data,setData}) => {
  const [modal,setModal]=useState(null);const [toast,setToast]=useState(null);const [preview,setPreview]=useState(null);const [uploading,setUploading]=useState("");
  const {token,user}=useAuth();
  const blank = {id:"",audit_name:"",start_date:"",end_date:"",nc_report_file:null,final_report_file:null,status:"Open",remarks:""};
  const save=(a)=>{if(a.id){setData(d=>({...d,audits:d.audits.map(x=>x.id===a.id?a:x)}));}else{setData(d=>({...d,audits:[...d.audits,{...a,id:`au${Date.now()}`}]}));}setToast({msg:"Saved!",type:"success"});setModal(null);};
  const handleFile=async(field,file)=>{
    setUploading(field);
    try{const ref=await uploadToStorage(token,user.id,"audit",file);setModal(m=>({...m,[field]:ref}));}catch(e){setToast({msg:"Upload failed",type:"error"});}
    setUploading("");
  };
  return (<div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {preview&&<FilePreviewModal file={preview} onClose={()=>setPreview(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Internal Audit</h2>
      <Btn onClick={()=>setModal({...blank})}><Plus size={14}/> New Audit</Btn>
    </div>
    {data.audits.length===0?<Card><Empty msg="No audits yet" action="New Audit" onAction={()=>setModal({...blank})}/></Card>:(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {data.audits.map(a=><Card key={a.id}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>{a.audit_name||"Untitled"}</div><div style={{fontSize:12,color:C.textMuted}}>{a.start_date&&`${a.start_date} → ${a.end_date||"Ongoing"}`}</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}><Badge color={a.status==="Closed"?C.green:a.status==="In Progress"?C.yellow:C.blue}>{a.status}</Badge><button onClick={()=>setModal({...a})} style={{background:"none",border:"none",cursor:"pointer",color:C.orange}}><Edit3 size={16}/></button></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
            <div style={{padding:12,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}><div style={{fontSize:11,color:C.textDim,fontWeight:600,marginBottom:6}}>NC Report</div>{a.nc_report_file?<button onClick={()=>setPreview(a.nc_report_file)} style={{background:"none",border:"none",cursor:"pointer",color:C.orange,fontSize:12,display:"flex",alignItems:"center",gap:4}}><Eye size={12}/> {a.nc_report_file.name}</button>:<span style={{color:C.textDim,fontSize:12}}>Not uploaded</span>}</div>
            <div style={{padding:12,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}><div style={{fontSize:11,color:C.textDim,fontWeight:600,marginBottom:6}}>Final Report</div>{a.final_report_file?<button onClick={()=>setPreview(a.final_report_file)} style={{background:"none",border:"none",cursor:"pointer",color:C.orange,fontSize:12,display:"flex",alignItems:"center",gap:4}}><Eye size={12}/> {a.final_report_file.name}</button>:<span style={{color:C.textDim,fontSize:12}}>Not uploaded</span>}</div>
          </div>
        </Card>)}
      </div>)}
    <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.id?"Edit Audit":"New Audit"} wide>
      {modal&&<div>
        <Input label="Audit Name" value={modal.audit_name} onChange={v=>setModal(m=>({...m,audit_name:v}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Input label="Start Date" type="date" value={modal.start_date} onChange={v=>setModal(m=>({...m,start_date:v}))}/>
          <Input label="End Date" type="date" value={modal.end_date} onChange={v=>setModal(m=>({...m,end_date:v}))}/>
          <Input label="Status" value={modal.status} onChange={v=>setModal(m=>({...m,status:v}))} select options={["Open","In Progress","Closed"]}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:8}}>
          <div><label style={{display:"block",fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:600}}>NC Report</label>{modal.nc_report_file?<div style={{display:"flex",alignItems:"center",gap:6}}><CheckCircle size={14} color={C.green}/><span style={{color:C.text,fontSize:12}}>{modal.nc_report_file.name}</span><button onClick={()=>setModal(m=>({...m,nc_report_file:null}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><X size={12}/></button></div>:<FileUploadBtn onFile={f=>handleFile("nc_report_file",f)} accept="*" label={uploading==="nc_report_file"?"Uploading...":"Upload NC Report"} size="sm" variant="secondary"/>}</div>
          <div><label style={{display:"block",fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:600}}>Final Report</label>{modal.final_report_file?<div style={{display:"flex",alignItems:"center",gap:6}}><CheckCircle size={14} color={C.green}/><span style={{color:C.text,fontSize:12}}>{modal.final_report_file.name}</span><button onClick={()=>setModal(m=>({...m,final_report_file:null}))} style={{background:"none",border:"none",cursor:"pointer",color:C.red}}><X size={12}/></button></div>:<FileUploadBtn onFile={f=>handleFile("final_report_file",f)} accept="*" label={uploading==="final_report_file"?"Uploading...":"Upload Final Report"} size="sm" variant="secondary"/>}</div>
        </div>
        <Input label="Remarks" value={modal.remarks} onChange={v=>setModal(m=>({...m,remarks:v}))} textarea style={{marginTop:12}}/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>{modal.id&&modal.status!=="Closed"&&<Btn variant="success" onClick={()=>save({...modal,status:"Closed"})}><CheckCircle size={14}/> Close</Btn>}<Btn onClick={()=>save(modal)}><Save size={14}/> Save</Btn></div>
      </div>}
    </Modal>
  </div>);
};

// =============================================
// NAVIGATION (v5 — removed Project Plan & Technical Controls)
// =============================================
const NAV = [
  {id:"dashboard",label:"Dashboard",icon:LayoutDashboard},
  {id:"soa",label:"SOA",icon:ListChecks},
  {id:"gap",label:"Gap Assessment",icon:ClipboardCheck},
  {id:"risk",label:"Risk Register",icon:AlertTriangle},
  {id:"assets",label:"Asset Register",icon:Server},
  {id:"policies",label:"Policies",icon:FileText},
  {id:"evidence",label:"Evidence",icon:FolderOpen},
  {id:"roles",label:"Roles & RACI",icon:Users},
  {id:"vapt",label:"VAPT",icon:Bug},
  {id:"training",label:"Training",icon:GraduationCap},
  {id:"audit",label:"Internal Audit",icon:FileSearch},
];

// =============================================
// MAIN APP
// =============================================
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const saveRef = useRef(null);
  const isInitialLoad = useRef(true);

  const loadData = async (tok, usr) => {
    setLoading(true);
    try {
      const rows = await supaDB(tok, "GET", `?user_id=eq.${usr.id}&select=state`);
      if (rows && Array.isArray(rows) && rows.length > 0 && rows[0].state) {
        const saved = rows[0].state;
        const merged = { ...getInitialData(), ...saved };
        // Sanitize: ensure all arrays exist and are arrays
        ["risks","assets","roles","raci","vapt","audits","policies","evidenceList","soaSheetNames","trainings"].forEach(k=>{
          if(!Array.isArray(merged[k])) merged[k]=[];
        });
        ["soaFileName"].forEach(k=>{if(typeof merged[k]!=="string") merged[k]="";});
        // Ensure gapResponses is an object (v6 format)
        if(!merged.gapResponses || typeof merged.gapResponses !== "object" || Array.isArray(merged.gapResponses)) merged.gapResponses = {};
        // Clean up old v5 gap fields if present
        delete merged.gaps; delete merged.gapFileName; delete merged.gapSections;
        setData(merged);
      } else {
        setData(getInitialData());
      }
    } catch (e) {
      console.error("Load failed:", e);
      setData(getInitialData());
    }
    setLoading(false);
    isInitialLoad.current = true;
  };

  useEffect(() => {
    if (!user || !token || !data) return;
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    clearTimeout(saveRef.current);
    setSaveStatus("saving");
    saveRef.current = setTimeout(async () => {
      try {
        const r = await safeFetch(`${SUPA_URL}/rest/v1/isms_state`, {
          method: "POST",
          headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
          body: JSON.stringify({ user_id: user.id, state: data, updated_at: new Date().toISOString() }),
        });
        if (r.ok || r.status === 201 || r.status === 204) { setSaveStatus("saved"); }
        else { console.warn("Save:", r.status); setSaveStatus("error"); }
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (e) { console.error("Save failed:", e); setSaveStatus("error"); setTimeout(() => setSaveStatus(""), 3000); }
    }, 2000);
  }, [data]);

  const handleAuth = (tok, usr) => { setToken(tok); setUser(usr); loadData(tok, usr); };
  const handleLogout = () => { setUser(null); setToken(null); setData(null); setPage("dashboard"); };

  if (!user) return <AuthPage onAuth={handleAuth} />;
  if (loading || !data) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{textAlign:"center"}}><Loader size={32} color={C.orange} style={{animation:"spin 1s linear infinite",marginBottom:16}}/><div style={{color:C.textMuted,fontSize:14}}>Loading your ISMS data...</div><style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style></div>
    </div>
  );

  const renderPage = () => {
    switch(page) {
      case "dashboard": return <Dashboard data={data}/>;
      case "soa": return <SOAModule data={data} setData={setData}/>;
      case "gap": return <GapAssessment data={data} setData={setData}/>;
      case "risk": return <RiskRegister data={data} setData={setData}/>;
      case "assets": return <AssetRegister data={data} setData={setData}/>;
      case "policies": return <PoliciesModule data={data} setData={setData}/>;
      case "evidence": return <EvidenceModule data={data} setData={setData}/>;
      case "roles": return <RolesRaci data={data} setData={setData}/>;
      case "vapt": return <VAPTManagement data={data} setData={setData}/>;
      case "training": return <TrainingModule data={data} setData={setData}/>;
      case "audit": return <InternalAudit data={data} setData={setData}/>;
      default: return <Dashboard data={data}/>;
    }
  };

  return (
    <AuthCtx.Provider value={{user,token}}>
      <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',sans-serif",color:C.text}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        {/* Sidebar */}
        <div style={{width:sidebarOpen?220:68,minHeight:"100vh",background:C.sidebar,borderRight:`1px solid ${C.border}`,transition:"width 0.2s",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:sidebarOpen?"20px 16px":"20px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            {sidebarOpen?<Logo/>:<Shield size={24} color={C.orange} fill={C.orange}/>}
            <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4}}>{sidebarOpen?<ChevronLeft size={18}/>:<ChevronRight size={18}/>}</button>
          </div>
          <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
            {NAV.map(item=>{const active=page===item.id;const Icon=item.icon;return<button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:12,padding:sidebarOpen?"10px 14px":"10px 14px",border:"none",borderRadius:10,cursor:"pointer",width:"100%",textAlign:"left",background:active?`${C.orange}18`:"transparent",color:active?C.orange:C.textMuted,fontWeight:active?700:500,fontSize:13,fontFamily:"inherit"}}><Icon size={18}/>{sidebarOpen&&<span>{item.label}</span>}</button>;})}
          </nav>
          <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
            {sidebarOpen&&<button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:`${C.red}15`,border:`1px solid ${C.red}33`,borderRadius:8,cursor:"pointer",color:C.red,fontSize:12,fontWeight:600,fontFamily:"inherit"}}><LogOut size={14}/> Sign Out</button>}
          </div>
        </div>
        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          <div style={{padding:"14px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.sidebar}}>
            <div style={{fontSize:13,color:C.textMuted}}>SecComply ISMS Platform <span style={{color:C.textDim,fontSize:11}}>v5</span></div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {saveStatus==="saving"&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.yellow}}><Loader size={12} style={{animation:"spin 1s linear infinite"}}/> Saving...</div>}
              {saveStatus==="saved"&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.green}}><CheckCircle size={12}/> Saved</div>}
              {saveStatus==="error"&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.red}}><AlertCircle size={12}/> Save failed</div>}
              <Badge color={C.textMuted}>{user.email}</Badge>
              <Badge color={C.green} bg={C.greenBg}>Active ✓</Badge>
            </div>
          </div>
          <div style={{flex:1,padding:24,overflowY:"auto"}}><ErrorBoundary>{renderPage()}</ErrorBoundary></div>
        </div>
      </div>
    </AuthCtx.Provider>
  );
}
