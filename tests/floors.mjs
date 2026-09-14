import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const directory=await mkdtemp(join(tmpdir(),'circuit-floors-'));
try {
 for(const name of ['electrical-map','map-validation']){
  let source=await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
  source=source.replace("'./electrical-map'","'./electrical-map.mjs'").replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href));
  await writeFile(join(directory,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 const {migrateMap,updateFloor,removeBreaker}=await import(pathToFileURL(join(directory,'electrical-map.mjs')));
 const {parseMap}=await import(pathToFileURL(join(directory,'map-validation.mjs')));
 const legacy={image:'/api/plan?id=abcdef',filename:'my-plan.png',ratio:.5,circuits:[{id:'1',name:'Living room',amps:15,color:'#abcdef'}],nodes:[{id:'a',name:'Outlet',type:'outlet',x:10,y:20,breaker:'1',notes:'Keep this'}],links:[]};
 const migrated=parseMap(legacy);
 assert.equal(migrated.floors[0].name,'Main floor');
 assert.deepEqual(migrated.floors[0].nodes,legacy.nodes);
 assert.equal(migrated.floors[0].image,legacy.image);
 const upstairs={id:'upstairs',name:'Upstairs',image:null,filename:'No schematic uploaded',nodes:[],links:[]};
 const house={...migrated,floors:[...migrated.floors,upstairs]};
 const changed=updateFloor(house,'upstairs',d=>({...d,image:'/api/plan?id=123456',ratio:2,nodes:[{...legacy.nodes[0],id:'b'}]}));
 assert.deepEqual(changed.floors[0],house.floors[0]);
 assert.equal(changed.floors[1].nodes[0].id,'b');
	 assert.deepEqual(parseMap(JSON.parse(JSON.stringify(changed))),changed);
	 const doublePole={...changed,circuits:changed.circuits.map(c=>({...c,amps:50,poles:2}))};
	 assert.equal(parseMap(doublePole).circuits[0].poles,2);
	 assert.throws(()=>parseMap({...doublePole,circuits:doublePole.circuits.map(c=>({...c,poles:3}))}));
 const rated=updateFloor(changed,'upstairs',d=>({...d,circuits:d.circuits.map(c=>({...c,name:'Shared circuit'}))}));
 assert.equal(rated.circuits[0].name,'Shared circuit');
 assert.equal(updateFloor(changed,'missing',d=>d),changed);
 assert.throws(()=>parseMap({...changed,floors:[]}));
 assert.throws(()=>parseMap({...changed,floors:[changed.floors[0],changed.floors[0]]}));
 assert.throws(()=>parseMap({...changed,floors:[{...changed.floors[0],links:[{id:'bad',a:'a',b:'b'}]}]}));
 assert.deepEqual(migrateMap(changed),changed);
 const removed=removeBreaker(changed,'1');
 assert.equal(removed.circuits.length,0);
 assert.ok(removed.floors.every(f=>f.nodes.every(n=>n.breaker==='')));
 assert.deepEqual(removed.floors.map(f=>f.links),changed.floors.map(f=>f.links));
 assert.equal(changed.floors[0].nodes[0].breaker,'1');
 assert.equal(changed.floors[1].nodes[0].breaker,'1');
 assert.deepEqual(parseMap(JSON.parse(JSON.stringify(removed))),removed);
 assert.equal(removeBreaker(changed,'missing'),changed);
 console.log('Passed: breaker removal across floors and preservation of undo snapshots.');
 console.log('Passed: legacy migration, floor isolation, shared breakers, save/reload, missing floor, and invalid floor/link rejection.');
}finally{await rm(directory,{recursive:true,force:true})}
