// Independent implementation: own coordinates, adjacency traversal, no engine imports.
export function oracleStatus(p, board, cycles=true) {
  const width=p.width,height=p.height, n=(width+1)*(height+1), degree=Array(n).fill(0), free=Array(n).fill(0), network=Array.from({length:n},()=>[]);
  if(!Array.isArray(board)||board.length!==width*height||board.some(v=>!['','/','\\'].includes(v)))return {valid:false,complete:false};
  for(let row=0;row<height;row++)for(let col=0;col<width;col++){
    const cell=row*width+col,value=board[cell];
    if(value===''){for(const yy of [row,row+1])for(const xx of [col,col+1])free[yy*(width+1)+xx]++;continue;}
    const from=row*(width+1)+col+(value==='/'?1:0),to=(row+1)*(width+1)+col+(value==='\\'?1:0);
    degree[from]++;degree[to]++;network[from].push([to,cell]);network[to].push([from,cell]);
  }
  let cyclic=false;const seen=new Set();
  function walk(at,prior){seen.add(at);for(const [to,edge] of network[at])if(edge!==prior){if(seen.has(to)){cyclic=true;}else walk(to,edge);}}
  for(let v=0;v<n;v++)if(!seen.has(v))walk(v,-1);
  const bad=p.clues.some((v,i)=>v!==null&&(degree[i]>v||degree[i]+free[i]<v));
  const valid=!bad&&(!cycles||!cyclic);
  return {valid,cyclic,degree,free,numericBad:bad,complete:valid&&board.every(Boolean)&&p.clues.every((v,i)=>v===null||degree[i]===v)};
}
export function oracleSolve(p, options={}) {
  const maxNodes=options.maxNodes||1000000, limit=options.limit||2, board=Array(p.width*p.height).fill(''), solutions=[];
  let nodes=0,truncated=false;
  function search(){
    if(solutions.length>=limit||truncated)return;
    if(++nodes>maxNodes){truncated=true;return;}
    const forced=[];let best=-1,choices=null;
    while(true){
      let force=-1, forcedValue=''; best=-1;choices=null;
      for(let i=0;i<board.length;i++)if(!board[i]){
        const candidates=[];
        for(const value of ['\\','/']){board[i]=value;if(oracleStatus(p,board,options.cycles!==false).valid)candidates.push(value);board[i]='';}
        if(!candidates.length){forced.forEach(j=>board[j]='');return;}
        if(candidates.length===1){force=i;forcedValue=candidates[0];break;}
        if(best<0){best=i;choices=candidates;}
      }
      if(force<0)break;
      board[force]=forcedValue;forced.push(force);
    }
    if(best<0){if(oracleStatus(p,board,options.cycles!==false).complete)solutions.push(board.slice());}
    else for(const v of choices){board[best]=v;search();board[best]='';if(solutions.length>=limit||truncated)break;}
    forced.forEach(j=>board[j]='');
  }
  search();return {count:solutions.length,solutions,nodes,truncated,exhausted:!truncated&&solutions.length<limit};
}
