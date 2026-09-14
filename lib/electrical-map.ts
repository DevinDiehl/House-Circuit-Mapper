export type MapNode={id:string;type:string;name:string;x:number;y:number;breaker:string;notes:string};
export type Circuit={id:string;name:string;amps:number;color:string};
export type Floor={id:string;name:string;nodes:MapNode[];links:{id:string;a:string;b:string}[];image:string|null;filename:string;ratio?:number;example?:boolean};
export type MapData=Omit<Floor,'id'|'name'>&{circuits:Circuit[]};
export type HouseMap={version:2;floors:Floor[];circuits:Circuit[]};
export function migrateMap(value:HouseMap|MapData):HouseMap {
 if('floors' in value)return value;
 const {circuits,...floor}=value;
 return {version:2,circuits,floors:[{...floor,id:'main-floor',name:'Main floor',example:!floor.image&&floor.filename==='Example floor plan'}]};
}
export function updateFloor(house:HouseMap,id:string,update:(data:MapData)=>MapData):HouseMap {
 const floor=house.floors.find(f=>f.id===id);if(!floor)return house;
 const {circuits,...updated}=update({...floor,circuits:house.circuits});
 return {...house,circuits,floors:house.floors.map(f=>f.id===id?{...updated,id:f.id,name:f.name}:f)};
}
export function removeBreaker(house:HouseMap,id:string):HouseMap {
 if(!house.circuits.some(c=>c.id===id))return house;
 return {...house,circuits:house.circuits.filter(c=>c.id!==id),floors:house.floors.map(f=>({...f,nodes:f.nodes.map(n=>n.breaker===id?{...n,breaker:''}:n)}))};
}
