"use client";
import {useEffect,useRef,useState} from 'react';
import {Zap,Plug,Lightbulb,ToggleLeft,Refrigerator,Microwave,WashingMachine,Fan,Tv,Flame,MousePointer2,Link2,Upload,Download,Plus,Minus,Maximize,Trash2,Check,Layers,ChevronRight,PanelTop,Undo2} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {migrateMap,updateFloor,removeBreaker,type MapNode as Node,type MapData,type HouseMap} from '@/lib/electrical-map';
const library=[['outlet','Outlet',Plug],['gfci','GFCI outlet',Plug],['switch','Switch',ToggleLeft],['light','Light',Lightbulb],['fridge','Refrigerator',Refrigerator],['microwave','Microwave',Microwave],['washer','Washer',WashingMachine],['dryer','Dryer',WashingMachine],['oven','Oven',Flame],['dishwasher','Dishwasher',PanelTop],['tv','Television',Tv],['fan','Ceiling fan',Fan]] as const;
const initial:MapData={image:null,filename:'Example floor plan',circuits:[{id:'1',name:'Living room',amps:15,color:'#ea8050'},{id:'2',name:'Kitchen outlets',amps:20,color:'#5188ce'},{id:'3',name:'Bedroom & lighting',amps:15,color:'#9a79c5'},{id:'4',name:'Kitchen appliances',amps:20,color:'#58a58d'}],nodes:[{id:'a',type:'outlet',name:'Living room outlet',x:18,y:23,breaker:'1',notes:''},{id:'b',type:'outlet',name:'Sofa outlet',x:18,y:66,breaker:'1',notes:''},{id:'c',type:'tv',name:'Living room TV',x:39,y:23,breaker:'1',notes:''},{id:'d',type:'gfci',name:'Kitchen counter',x:64,y:23,breaker:'2',notes:''},{id:'e',type:'fridge',name:'Refrigerator',x:81,y:23,breaker:'4',notes:''},{id:'f',type:'light',name:'Bedroom light',x:73,y:66,breaker:'3',notes:''}],links:[{id:'ab',a:'a',b:'b'},{id:'ac',a:'a',b:'c'}]};
export default function Home(){const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');const [house,setHouse]=useState<HouseMap>(()=>migrateMap(initial)),[activeFloor,setActiveFloor]=useState('main-floor'),[selected,setSelected]=useState('a'),[tool,setTool]=useState('select'),[pending,setPending]=useState<string|null>(null),[filter,setFilter]=useState('all'),[editingBreaker,setEditingBreaker]=useState<string|null>(null),[editingComponent,setEditingComponent]=useState<string|null>(null),[zoom,setZoom]=useState(1),[status,setStatus]=useState('Loading saved map…'),[ready,setReady]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState<HouseMap[]>([]),[showLinks,setShowLinks]=useState(true);const [viewportSize,setViewportSize]=useState({width:0,height:0});const viewport=useRef<HTMLDivElement>(null);const saveQueue=useRef(Promise.resolve());const board=useRef<HTMLDivElement>(null),file=useRef<HTMLInputElement>(null),drag=useRef<string|null>(null),moved=useRef(false),latest=useRef(house);
const floor=house.floors.find(f=>f.id===activeFloor)||house.floors[0];
const data:MapData={...floor,circuits:house.circuits};
const breaker=house.circuits.find(c=>c.id===editingBreaker);
const component=data.nodes.find(n=>n.id===editingComponent);
const setData=(value:MapData|((d:MapData)=>MapData))=>setHouse(h=>updateFloor(h,floor.id,d=>typeof value==='function'?value(d):value));
const selectFloor=(id:string)=>{setActiveFloor(id);setSelected('');setEditingComponent(null);setPending(null);setTool('select');drag.current=null;setFilter('all');};
const addFloor=()=>{const id=crypto.randomUUID();setHistory(h=>[...h.slice(-29),house]);setHouse(h=>({...h,floors:[...h.floors,{id,name:`Floor ${h.floors.length+1}`,image:null,filename:'No schematic uploaded',nodes:[],links:[]}]}));selectFloor(id)};
const planRatio=typeof data.ratio==='number'&&Number.isFinite(data.ratio)&&data.ratio>0?data.ratio:4/3;
const fitWidth=Math.max(1,Math.min(viewportSize.width-48,(viewportSize.height-48)*planRatio));
const planWidth=fitWidth*zoom;
const fitPlan=()=>{setZoom(1);viewport.current?.scrollTo({left:0,top:0});};
useEffect(()=>{const element=viewport.current;if(!element)return;const measure=()=>setViewportSize({width:element.clientWidth,height:element.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect()},[]);
useEffect(()=>{latest.current=house},[house]);
useEffect(()=>{const frame=requestAnimationFrame(fitPlan);return()=>cancelAnimationFrame(frame)},[data.image,floor.id]);
const edit=(fn:(d:MapData)=>MapData)=>{setHistory(h=>[...h.slice(-29),latest.current]);setData(fn)};
useEffect(()=>{fetch('/api/map').then(r=>{if(!r.ok)throw Error();return r.json() as Promise<HouseMap|MapData|null>}).then(d=>{if(d)setHouse(migrateMap(d));setReady(true);setStatus('All changes saved')}).catch(()=>{setError('Could not load your map. Reload to retry.');setStatus('Save unavailable')})},[]);
useEffect(()=>{if(!ready)return;const t=setTimeout(()=>{setStatus('Saving…');saveQueue.current=saveQueue.current.then(()=>fetch('/api/map',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(house)}).then(r=>{if(!r.ok)throw Error();setStatus('All changes saved');setError('')}).catch(()=>{setStatus('Not saved');setError('Your changes could not be saved. Export a backup or try saving again.')}))},700);return()=>clearTimeout(t)},[house,ready]);
const color=(n:Node)=>data.circuits.find(c=>c.id===n.breaker)?.color||'#8b95a5';const patch=(p:Partial<Node>)=>edit(d=>({...d,nodes:d.nodes.map(n=>n.id===editingComponent?{...n,...p}:n)}));
function position(e:React.PointerEvent){const r=board.current!.getBoundingClientRect();return{x:Math.max(2,Math.min(98,(e.clientX-r.left)/r.width*100)),y:Math.max(3,Math.min(97,(e.clientY-r.top)/r.height*100))}}
function add(type:string,x=50,y=50){const id=crypto.randomUUID();edit(d=>({...d,nodes:[...d.nodes,{id,type,name:library.find(v=>v[0]===type)?.[1]||type,x,y,breaker:filter==='all'?'':filter,notes:''}]}));setSelected(id);setEditingComponent(id);setTool('select')}
async function upload(f:File){if(!['image/png','image/jpeg','image/webp'].includes(f.type)){setError('Choose a PNG, JPG, or WebP image.');return}if(f.size>15*1024*1024){setError('Choose an image smaller than 15 MB.');return}setStatus('Uploading plan…');try{const r=await fetch('/api/plan',{method:'POST',body:f,headers:{'Content-Type':f.type}});if(!r.ok)throw Error();const {url}=await r.json() as {url:string};const bitmap=await createImageBitmap(f);const ratio=bitmap.width/bitmap.height;bitmap.close();edit(d=>({...d,image:url,filename:f.name,ratio,nodes:d.example?[]:d.nodes,links:d.example?[]:d.links,example:false}));setSelected('');setError('')}catch{setError('Upload failed. Please try again.')}}
return <main><header className="topbar"><div className="brand"><span className="brandmark"><Zap size={23} fill="currentColor"/></span>circuit<span className="brand-divider"/><span className="project">My home <ChevronRight size={14}/> Electrical map</span></div><div className="topactions"><button disabled={!ready||exporting} onClick={async()=>{setExporting(true);setExportError('');try{const {downloadElectricalPdf}=await import('@/lib/export-pdf');await downloadElectricalPdf(house)}catch(e){setExportError(e instanceof Error?e.message:'PDF export failed. Please try again.')}finally{setExporting(false)}}}><Download size={16}/>{exporting?'Preparing PDF…':'Export PDF'}</button><span className="save"><Check size={14}/>{status}</span><button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(house,null,2)],{type:'application/json'}));a.download='home-electrical-map.json';a.click();URL.revokeObjectURL(a.href)}}><Download size={16}/>Export map</button></div></header>{exportError&&<div className="error" role="alert">PDF export failed: {exportError} Please try again.</div>}<span className="sr-only" role="status">{exporting?'Preparing PDF for all floors':''}</span>
<div className="workspace"><aside className="library"><div className="sectionhead">WORKSPACE</div><div className="floorcontrols"><label htmlFor="floor-select">Floor</label><Select value={floor.id} onValueChange={selectFloor}><SelectTrigger id="floor-select" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{house.floors.map(f=><SelectItem key={f.id} value={f.id}>{f.name||'Unnamed floor'}</SelectItem>)}</SelectContent></Select><button className="addbreaker" disabled={!ready||house.floors.length>=50} onClick={addFloor}><Plus size={16}/>Add floor</button><label>Floor name<input maxLength={100} value={floor.name} onChange={e=>{const name=e.target.value;setHouse(h=>({...h,floors:h.floors.map(f=>f.id===floor.id?{...f,name}:f)}))}}/></label></div><div className="currentplan"><Layers size={18}/><div>{floor.name||'Unnamed floor'}<small>{data.filename}</small></div></div><button className="upload" disabled={!ready} onClick={()=>file.current?.click()}><Upload size={16}/>Upload schematic</button><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);e.target.value=''}}/><p className="hint">PNG, JPG or WebP · up to 15 MB</p><div className="sectionhead spaced">COMPONENTS <span>{data.nodes.length}</span></div><p className="subtle">Choose a component, then place it.</p><div className="sectionlabel">Electrical</div><div className="componentgrid">{library.map(([type,label,Icon],i)=><button key={type} className={`${tool===type?'active':''} ${i===4?'appliance-start':''}`} onClick={()=>{setTool(type);setPending(null)}}><Icon size={22}/><span>{label}</span></button>)}</div><div className="libraryfoot"><span className="littlebolt"><Zap size={17}/></span><p>A clearer picture of<br/>your home&apos;s connections.</p></div></aside>
<section className="center"><div className="canvashead"><div><h1>Home electrical map</h1><p>{floor.name||'Unnamed floor'} · {house.floors.length} {house.floors.length===1?'floor':'floors'}</p></div><span className="example">{data.image?'YOUR SCHEMATIC':data.example?'EXAMPLE PLAN':'EMPTY FLOOR'}</span></div><div className="toolbar"><div className="tools"><button title="Select and move" className={tool==='select'?'active':''} onClick={()=>{setTool('select');setPending(null)}}><MousePointer2 size={17}/>Select</button><button className={tool==='connect'?'active':''} onClick={()=>{setTool('connect');setPending(null)}}><Link2 size={17}/>Connect</button><i/><button title="Undo" disabled={!history.length} onClick={()=>{setHouse(history[history.length-1]);setHistory(h=>h.slice(0,-1))}}><Undo2 size={17}/></button></div><button className={showLinks?'links-on':''} onClick={()=>setShowLinks(!showLinks)}><Layers size={16}/>{showLinks?'Hide links':'Show links'}</button></div>
{error&&<div className="error" role="alert">{error}<button onClick={()=>{if(!ready)location.reload();else setData({...data})}}>Retry</button></div>}
<div className="canvasviewport" ref={viewport}><div className="planstage" style={{width:Math.max(viewportSize.width,planWidth+48),height:Math.max(viewportSize.height,planWidth/planRatio+48)}}><div className="planwrap" style={{width:planWidth}}><div className="plan" style={{aspectRatio:planRatio}} ref={board} onPointerDown={e=>{if(e.target===e.currentTarget&&tool!=='select'&&tool!=='connect'){const p=position(e);add(tool,p.x,p.y)}}} onPointerMove={e=>{if(drag.current){moved.current=true;const p=position(e);setData(d=>({...d,nodes:d.nodes.map(n=>n.id===drag.current?{...n,...p}:n)}))}}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
{data.image?<img className="uploadedplan" src={data.image} alt={`${floor.name} schematic`} key={floor.id+data.image} onLoad={e=>{const image=e.currentTarget;const ratio=image.naturalWidth/image.naturalHeight;if(Number.isFinite(ratio)&&ratio>0&&ratio!==data.ratio)setData(d=>({...d,ratio}))}}/>:data.example?<img className="floorplan" src="/example-floor-plan.svg" alt="Example floor plan"/>:<div className="emptyfloor"><Layers size={28}/><span>Upload a schematic for {floor.name||'this floor'}</span><small>Then place outlets and appliances on the plan.</small></div>}
<svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="none">{showLinks&&data.links.map(l=>{const a=data.nodes.find(n=>n.id===l.a),b=data.nodes.find(n=>n.id===l.b);return a&&b?<line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color(a)} strokeWidth=".32" strokeDasharray=".8 .65" opacity={filter==='all'||a.breaker===filter?'.75':'.12'}/>:null})}</svg>
{data.nodes.map(n=>{const Icon=library.find(t=>t[0]===n.type)?.[2]||Plug;return <button key={n.id} title={n.name} aria-label={n.name} className={`mapnode ${selected===n.id?'selected':''} ${pending===n.id?'pending':''}`} style={{left:n.x+'%',top:n.y+'%',color:color(n),opacity:filter==='all'||n.breaker===filter?1:.22}} onPointerDown={e=>{e.stopPropagation();moved.current=false;if(tool==='select'){setHistory(h=>[...h.slice(-29),house]);drag.current=n.id;e.currentTarget.setPointerCapture(e.pointerId);setSelected(n.id)}}} onClick={e=>{e.stopPropagation();if(moved.current)return;if(tool==='connect'){if(pending&&pending!==n.id){if(!data.links.some(l=>(l.a===pending&&l.b===n.id)||(l.b===pending&&l.a===n.id)))edit(d=>({...d,links:[...d.links,{id:crypto.randomUUID(),a:pending,b:n.id}]}));setPending(null)}else setPending(n.id)}else{setSelected(n.id);setEditingComponent(n.id)}}} onKeyDown={e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();edit(d=>({...d,nodes:d.nodes.map(v=>v.id===n.id?{...v,x:Math.max(2,Math.min(98,v.x+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0))),y:Math.max(3,Math.min(97,v.y+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)))}:v)}))}}}><Icon size={21}/><span className="nodebadge">{n.breaker||'?'}</span></button>})}
</div></div></div></div><div className="canvasbottom"><span>{tool==='connect'?(pending?'Select the second component to link.':'Select two components to create a link.'):tool==='select'?'Drag to move · Select to edit':`Click the plan to place a ${library.find(l=>l[0]===tool)?.[1].toLowerCase()}`}</span><div><button title="Zoom out" onClick={()=>setZoom(z=>Math.max(.6,z-.2))}><Minus size={16}/></button><span>{Math.round(zoom*100)}%</span><button title="Zoom in" onClick={()=>setZoom(z=>Math.min(2.4,z+.2))}><Plus size={16}/></button><button title="Fit plan" onClick={fitPlan}><Maximize size={16}/></button></div></div><div className="legend">{data.circuits.map(c=><button key={c.id} onClick={()=>setFilter(filter===c.id?'all':c.id)} style={{opacity:filter==='all'||filter===c.id?1:.4}}><b style={{background:c.color}}/> {c.name}</button>)}</div></section>
<aside className="details">
  <div className="sectionhead">BREAKER BOX <Zap size={15}/></div>
  <div className="panel-heading"><div><h2>Main panel <span>{data.circuits.length}</span></h2><p>Select a switch to view or edit its circuit.</p></div><span className="panel-voltage">120/240V</span></div>
  <div className="breaker-box" aria-label="House breaker box">
    <div className="panel-main"><span>MAIN</span><strong>200A</strong></div>
    <div className="panel-bus" aria-hidden="true" />
    <div className="breaker-grid">
      {data.circuits.map((c,index)=>{
        const componentCount=house.floors.reduce((count,f)=>count+f.nodes.filter(n=>n.breaker===c.id).length,0);
        return <button key={c.id} className={`breaker-switch ${filter===c.id?'active':''} ${index%2?'right-switch':'left-switch'}`} style={{'--breaker-color':c.color} as React.CSSProperties} aria-label={`Breaker ${c.id}, ${c.name}, ${c.amps} amps, ${componentCount} components`} onClick={()=>{setFilter(c.id);setEditingBreaker(c.id)}}>
          <span className="breaker-number">{c.id.padStart(2,'0')}</span>
          <span className="breaker-toggle" aria-hidden="true"><i /></span>
          <strong className="breaker-amps">{c.amps}A</strong>
          <span className="breaker-name" title={c.name}>{c.name}</span>
        </button>
      })}
    </div>
    {!data.circuits.length&&<div className="empty-panel">No breakers yet.</div>}
    <div className="panel-footer"><span>HOUSE PANEL</span><span>{house.floors.reduce((count,f)=>count+f.nodes.length,0)} mapped components</span></div>
  </div>
  <button className="addbreaker panel-add" onClick={()=>{const id=String(Math.max(0,...data.circuits.map(c=>Number(c.id)))+1);edit(d=>({...d,circuits:[...d.circuits,{id,name:`Circuit ${id}`,amps:20,color:['#d3a43d','#c86f92','#5aa6b0'][d.circuits.length%3]}]}));setFilter(id);setEditingBreaker(id)}}><Plus size={16}/>Add breaker</button>
<div className="unassigned">{data.nodes.filter(n=>!n.breaker).length} components without a breaker</div></aside></div>
<Dialog open={Boolean(breaker)} onOpenChange={open=>{if(!open)setEditingBreaker(null)}}>
  <DialogContent className="breaker-dialog">
    {breaker&&<>
      <DialogHeader>
        <div className="dialog-breaker-id" style={{background:breaker.color}}>{breaker.id.padStart(2,'0')}</div>
        <div><DialogTitle>Breaker {breaker.id}</DialogTitle><DialogDescription>Edit the circuit label and rating. Changes apply to every floor.</DialogDescription></div>
      </DialogHeader>
      <div className="breaker-form">
        <label>Circuit name<input autoFocus maxLength={500} value={breaker.name} onChange={e=>edit(d=>({...d,circuits:d.circuits.map(c=>c.id===breaker.id?{...c,name:e.target.value}:c)}))}/></label>
        <label>Breaker rating (A)<input type="number" min="1" max="200" value={breaker.amps} onChange={e=>edit(d=>({...d,circuits:d.circuits.map(c=>c.id===breaker.id?{...c,amps:Math.max(1,Math.min(200,Number(e.target.value)||1))}:c)}))}/></label>
        <div className="breaker-assignment-summary">
          <span>Assigned components</span><strong>{house.floors.reduce((count,f)=>count+f.nodes.filter(n=>n.breaker===breaker.id).length,0)}</strong>
          {house.floors.map(f=>{const count=f.nodes.filter(n=>n.breaker===breaker.id).length;return count?<small key={f.id}>{f.name||'Unnamed floor'}: {count}</small>:null})}
        </div>
      </div>
      <DialogFooter>
        <button className="removebreaker" disabled={!ready} onClick={()=>{setHistory(h=>[...h.slice(-29),latest.current]);setHouse(h=>removeBreaker(h,breaker.id));setFilter('all');setEditingBreaker(null)}}><Trash2 size={15}/>Remove breaker</button>
        <button className="dialog-done" onClick={()=>setEditingBreaker(null)}>Done</button>
      </DialogFooter>
    </>}
  </DialogContent>
</Dialog>
<Dialog open={Boolean(component)} onOpenChange={open=>{if(!open)setEditingComponent(null)}}>
  <DialogContent className="component-dialog">
    {component&&<>
      <DialogHeader>
        <div className="dialog-component-icon" style={{color:color(component)}}><Plug size={25}/></div>
        <div><DialogTitle>{library.find(l=>l[0]===component.type)?.[1]||'Component'}</DialogTitle><DialogDescription>Configure this component and its circuit assignment.</DialogDescription></div>
      </DialogHeader>
      <div className="component-form">
        <label>Component name<input autoFocus maxLength={500} value={component.name} onChange={e=>patch({name:e.target.value})}/></label>
        <label>Connected breaker</label>
        <Select value={component.breaker||'none'} onValueChange={v=>patch({breaker:v==='none'?'':v})}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{data.circuits.map(c=><SelectItem key={c.id} value={c.id}>{c.id} · {c.name}</SelectItem>)}</SelectContent></Select>
        <label className="notes">Notes<textarea placeholder="Location, labels, or anything useful…" value={component.notes} onChange={e=>patch({notes:e.target.value})}/></label>
        <div className="component-links"><div className="sectionlabel">VISUAL CONNECTIONS</div>{data.links.filter(l=>l.a===component.id||l.b===component.id).map(l=><div className="linkrow" key={l.id}><Link2 size={14}/><span>{data.nodes.find(n=>n.id===(l.a===component.id?l.b:l.a))?.name}</span><button title="Remove connection" onClick={()=>edit(d=>({...d,links:d.links.filter(x=>x.id!==l.id)}))}><Trash2 size={14}/></button></div>)}<button className="addbreaker" onClick={()=>{setTool('connect');setPending(component.id);setEditingComponent(null)}}><Plus size={15}/>Link a component</button></div>
      </div>
      <DialogFooter>
        <button className="remove-component" onClick={()=>{edit(d=>({...d,nodes:d.nodes.filter(n=>n.id!==component.id),links:d.links.filter(l=>l.a!==component.id&&l.b!==component.id)}));setSelected('');setEditingComponent(null)}}><Trash2 size={15}/>Remove component</button>
        <button className="dialog-done" onClick={()=>setEditingComponent(null)}>Done</button>
      </DialogFooter>
    </>}
  </DialogContent>
</Dialog>
</main>}
