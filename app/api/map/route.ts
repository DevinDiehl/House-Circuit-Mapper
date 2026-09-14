import {env} from 'cloudflare:workers';
import {parseMap} from '@/lib/map-validation';
const bucket=()=> (env as unknown as {BUCKET:R2Bucket}).BUCKET;
export async function GET(){try{const obj=await bucket().get('home/map.json');return Response.json(obj?parseMap(await obj.json()):null,{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('Map load failed',e);return Response.json({error:'Storage unavailable'},{status:503})}}
export async function PUT(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 const text=await request.text();if(text.length>2_000_000)return new Response(null,{status:413});
 let data;try{data=parseMap(JSON.parse(text))}catch{return Response.json({error:'Invalid electrical map'},{status:400})}
 try{await bucket().put('home/map.json',JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});return Response.json({saved:true})}catch(e){console.error('Map save failed',e);return Response.json({error:'Could not save'},{status:503})}
}
