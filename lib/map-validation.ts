import {z} from 'zod';
import {migrateMap,normalizePanelSlots} from './electrical-map';
const id=z.string().min(1).max(100);
const node=z.object({id,type:z.string().max(100),name:z.string().max(500),x:z.number().min(0).max(100),y:z.number().min(0).max(100),breaker:z.string().max(100),notes:z.string().max(10000)});
const link=z.object({id,a:id,b:id});
const circuit=z.object({id,name:z.string().max(500),amps:z.number().min(1).max(200),color:z.string().regex(/^#[a-f0-9]{6}$/i),poles:z.union([z.literal(1),z.literal(2)]).optional()});
const plan=z.object({nodes:z.array(node).max(2000),links:z.array(link).max(10000),image:z.string().regex(/^\/api\/plan\?id=[a-f0-9-]+$/).nullable(),filename:z.string().max(1000),ratio:z.number().positive().finite().optional(),example:z.boolean().optional()});
const floor=plan.extend({id,name:z.string().max(100)}).superRefine((f,ctx)=>{const ids=new Set(f.nodes.map(n=>n.id));if(ids.size!==f.nodes.length||f.links.some(l=>!ids.has(l.a)||!ids.has(l.b)||l.a===l.b))ctx.addIssue({code:'custom',message:'Invalid floor components or links'})});
const house=z.object({version:z.literal(2),floors:z.array(floor).min(1).max(50),circuits:z.array(circuit).max(200)}).superRefine((h,ctx)=>{if(new Set(h.floors.map(f=>f.id)).size!==h.floors.length)ctx.addIssue({code:'custom',message:'Duplicate floor IDs'})});
export function parseMap(value:unknown){const normalized=house.safeParse(value);if(normalized.success)return normalizePanelSlots(normalized.data);const legacy=plan.extend({circuits:z.array(circuit).max(200)}).safeParse(value);if(!legacy.success)throw new Error('Invalid electrical map');return normalizePanelSlots(house.parse(migrateMap(legacy.data)))}
