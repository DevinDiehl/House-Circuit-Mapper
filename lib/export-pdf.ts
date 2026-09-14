import {PDFDocument,rgb,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {HouseMap,Floor} from './electrical-map';

const PAGE=[792,612] as const;
const ink=rgb(.15,.20,.23),muted=rgb(.43,.49,.52),line=rgb(.85,.89,.9),white=rgb(1,1,1);
const unassigned='#8b95a5';
const types:Record<string,string>={outlet:'Outlet',gfci:'GFCI outlet',switch:'Switch',light:'Light',fridge:'Refrigerator',microwave:'Microwave',washer:'Washer',dryer:'Dryer',oven:'Oven',dishwasher:'Dishwasher',tv:'Television',fan:'Ceiling fan'};
function color(hex:string){const h=/^#[a-f0-9]{6}$/i.test(hex)?hex:unassigned;return rgb(parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255)}
// Normalize multiline labels for table wrapping.
function printable(value:string,font:PDFFont){return Array.from(value.replace(/[\r\n\t]+/g,' ').replace(/[–—]/g,'-')).map(c=>{try{font.encodeText(c);return c}catch{return '?'}}).join('')}
function wrap(value:string,width:number,font:PDFFont,size:number):string[]{const text=printable(value,font);const lines:string[]=[];let current='';for(const word of text.split(' ')){const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue}if(current)lines.push(current);current='';for(const c of word){if(font.widthOfTextAtSize(current+c,size)>width&&current){lines.push(current);current=''}current+=c}}if(current||!lines.length)lines.push(current);return lines}
export type PdfImage={bytes:Uint8Array;format:'png'|'jpg'};
export async function createElectricalPdf(house:HouseMap,loadImage:(floor:Floor)=>Promise<PdfImage|null>,fonts:{regular:Uint8Array;bold:Uint8Array}):Promise<Uint8Array>{
 const doc=await PDFDocument.create();doc.setTitle('Home electrical map');doc.setAuthor('Circuit');
 doc.registerFontkit(fontkit);const font=await doc.embedFont(fonts.regular,{subset:true}),bold=await doc.embedFont(fonts.bold,{subset:true});
 const text=(page:PDFPage,value:string,x:number,y:number,size=10,strong=false,c=ink)=>page.drawText(printable(value,strong?bold:font),{x,y,size,font:strong?bold:font,color:c});
 const header=(title:string,subtitle:string)=>{const page=doc.addPage([...PAGE]);text(page,'CIRCUIT / HOME ELECTRICAL MAP',32,580,9,true,muted);let y=552;for(const l of wrap(title,728,bold,18)){text(page,l,32,y,18,true);y-=22}for(const l of wrap(subtitle,728,font,9)){text(page,l,32,y-1,9,false,muted);y-=12}page.drawLine({start:{x:32,y:y-7},end:{x:760,y:y-7},thickness:1,color:line});return {page,top:y-23}};
 const drawLines=(page:PDFPage,lines:string[],x:number,y:number,size=10,strong=false)=>lines.forEach((l,i)=>text(page,l,x,y-i*(size+4),size,strong));
 const table=(title:string,subtitle:string,headings:string[],widths:number[],rows:{cells:string[];color?:string}[])=>{
  let page!:PDFPage,y=0;
  const start=()=>{const h=header(title,subtitle);page=h.page;y=h.top;page.drawRectangle({x:32,y:y-24,width:728,height:28,color:rgb(.93,.96,.95)});let x=40;headings.forEach((v,i)=>{text(page,v,x,y-14,9,true);x+=widths[i]});y-=40};start();
  for(const row of rows){const cells=row.cells.map((v,i)=>wrap(v,widths[i]-20,font,10));
   // Long notes are split over page boundaries with the same table heading.
   let offset=0;const count=Math.max(...cells.map(c=>c.length));while(offset<count){if(y<80)start();const available=Math.max(1,Math.floor((y-65)/14));const take=Math.min(count-offset,available);let x=40;cells.forEach((lines,i)=>{const left=i===0&&row.color?x+14:x;if(i===0&&row.color)page.drawCircle({x:x+4,y:y-1,size:4,color:color(row.color)});drawLines(page,lines.slice(offset,offset+take),left,y,10);x+=widths[i]});y-=take*14+14;page.drawLine({start:{x:32,y:y+10},end:{x:760,y:y+10},thickness:.5,color:line});offset+=take;if(offset<count)start()}
  }
  if(!rows.length)text(page!,'No components on this floor.',40,y,11,false,muted);
 };
 for(const floor of house.floors){
  const label=floor.name||'Unnamed floor';
  const {page,top}=header(label,`${floor.example?'Example plan':floor.filename} | ${floor.nodes.length} components | ${floor.links.length} visual connections`);
  const map={x:42,y:70,width:500,height:Math.max(60,top-82)};
  page.drawRectangle({x:32,y:60,width:520,height:top-62,borderColor:line,borderWidth:.75,color:rgb(.985,.99,.99)});
  const source=await loadImage(floor);const image=source?await(source.format==='jpg'?doc.embedJpg(source.bytes):doc.embedPng(source.bytes)):null;
  const ratio=image?image.width/image.height:(floor.ratio||4/3);
  const w=Math.min(map.width,map.height*ratio),h=w/ratio;
  const bounds={x:map.x+(map.width-w)/2,y:map.y+(map.height-h)/2,w,h};
  if(image)page.drawImage(image,{x:bounds.x,y:bounds.y,width:w,height:h});else text(page,'No schematic uploaded',bounds.x+10,bounds.y+h/2,12,false,muted);
  const byId=new Map(floor.nodes.map(n=>[n.id,n]));
  const position=(n:{x:number;y:number})=>({x:bounds.x+n.x/100*w,y:bounds.y+(1-n.y/100)*h});
  const breakerColor=(id:string)=>house.circuits.find(c=>c.id===id)?.color||unassigned;
  for(const link of floor.links){const a=byId.get(link.a),b=byId.get(link.b);if(a&&b)page.drawLine({start:position(a),end:position(b),thickness:1,color:color(breakerColor(a.breaker)),dashArray:[3,3]})}
  floor.nodes.forEach((n,i)=>{const p=position(n),number=String(i+1),size=number.length>3?6:8,radius=Math.max(8,font.widthOfTextAtSize(number,size)/2+3);page.drawCircle({x:p.x,y:p.y,size:radius,color:white,borderColor:color(breakerColor(n.breaker)),borderWidth:2.5});text(page,number,p.x-bold.widthOfTextAtSize(number,size)/2,p.y-size*.34,size,true)});
  text(page,'BREAKER COLORS',573,top-5,10,true);let y=top-27;
  const used=new Set(floor.nodes.map(n=>n.breaker));const legends=house.circuits.filter(c=>used.has(c.id)).map(c=>({label:`${c.id} - ${c.name} (${c.amps}A${c.poles===2?', 2-pole':''})`,color:c.color}));if(floor.nodes.some(n=>!house.circuits.some(c=>c.id===n.breaker)))legends.push({label:'Unassigned',color:unassigned});
  for(const item of legends){const lines=wrap(item.label,168,font,10);const height=lines.length*14+12;if(y-height<115){text(page,'More colors in breaker chart.',573,y,9,false,muted);break}page.drawCircle({x:578,y:y+2,size:4,color:color(item.color)});drawLines(page,lines,590,y);y-=height}
  if(!legends.length)text(page,'No assigned components.',573,y,9,false,muted);
  drawLines(page,wrap('Numbers identify components in the following chart. Dashed lines show visual connections.',180,font,9),573,99,9);
  table(`${label} - component chart`,'Marker numbers correspond to this floor only. Breakers are shared across floors.',['No.','Component / type','Breaker','Notes'],[44,240,174,270],floor.nodes.map((n,i)=>({color:breakerColor(n.breaker),cells:[String(i+1),`${n.name} / ${types[n.type]||n.type}`,house.circuits.find(c=>c.id===n.breaker)?`${n.breaker} - ${house.circuits.find(c=>c.id===n.breaker)!.name}`:'Unassigned',n.notes||'-']})));
 }
 table('House breaker chart','Colors match component markers and connections on every floor.',['Breaker','Circuit','Rating','Components / floors'],[80,235,80,333],house.circuits.map(c=>({color:c.color,cells:[c.id,c.name,`${c.amps}A / ${c.poles===2?'2-pole':'1-pole'}`,house.floors.map(f=>({f,count:f.nodes.filter(n=>n.breaker===c.id).length})).filter(v=>v.count).map(({f,count})=>`${f.name||'Unnamed floor'}: ${count}`).join('; ')||'No assigned components']})));
 const pages=doc.getPages();pages.forEach((page,i)=>{text(page,'Circuit | Home electrical map',32,28,8,false,muted);text(page,`${i+1} / ${pages.length}`,725,28,8,false,muted)});
 return doc.save();
}

async function rasterizeFloor(floor:Floor):Promise<PdfImage|null>{
 const url=floor.image||(floor.example?'/example-floor-plan.svg':null);if(!url)return null;
 const response=await fetch(url);if(!response.ok)throw new Error(`Could not load the schematic for ${floor.name}.`);
 const blob=await response.blob(),objectUrl=URL.createObjectURL(blob);
 try{const image=new Image();image.src=objectUrl;await image.decode();const scale=Math.min(1,3000/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable.');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare schematic.')),'image/png'));return {bytes:new Uint8Array(await png.arrayBuffer()),format:'png'}}finally{URL.revokeObjectURL(objectUrl)}
}
export async function downloadElectricalPdf(house:HouseMap){const loadFont=async(url:string)=>{const r=await fetch(url);if(!r.ok)throw new Error('Could not load PDF fonts.');return new Uint8Array(await r.arrayBuffer())};const [regular,bold]=await Promise.all([loadFont('/fonts/DejaVuSans.ttf'),loadFont('/fonts/DejaVuSans-Bold.ttf')]);const bytes=await createElectricalPdf(house,rasterizeFloor,{regular,bold});const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='home-electrical-map.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
