// Shared by comparison and pg_net evidence without an executable-module import cycle.
export function canonical(value,key='') {
  if(Array.isArray(value)) {
    const items=value.map(v=>canonical(v));
    // Physical column ordering remains visible, never silently ignored.
    return key==='columns'?items:items.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k],k)]));
  return value;
}
