async function r0(i,e,t,r){
/* Paralel disa aktarma (Makas, Kasim 2026).
   Zaman cizelgesi kisa bolumlere ayrilir; K "isci" ayni anda farkli bolumleri cizip
   her biri kendi VideoEncoder'i ile kodlar. Kodlanmis paketler bolum sirasiyla tek MP4'e
   eklenir (EncodedVideoPacketSource). Tarayici motoru tek kodlayiciyi kare basina
   bekleterek kullandigi icin, ayni anda birkac kodlayici calistirmak 4K'da ~2x hiz verir.
   Herhangi bir sorunda eski sirali yola (r0s) dusulur. */
let Kp=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)?2:3;
try{let o=Number(localStorage.getItem("makas.paralel"));o>=1&&o<=8&&(Kp=Math.round(o))}catch{}
if(typeof window.__makasK=="number")Kp=window.__makasK;
if(Kp<=1)return r0s(i,e,t,r);
let n=Gt(i),s=n.total;if(!(s>0))throw new Error("empty");let a=e.fps||30;
let D=Math.max(1,Math.ceil(s*a-1e-6)),SEG=Math.max(Math.round(a*2),Math.min(Math.round(a*15),Math.ceil(D/Kp))),segs=[];
for(let f0=0;f0<D;f0+=SEG)segs.push([f0,Math.min(D,f0+SEG)]);
if(segs.length<2)return r0s(i,e,t,r);
let K=Math.min(Kp,segs.length);
for(let P of Object.keys(i.media))await Qs(P);await ik(i);
let o=pd(i,e),{W:c,H:d}=an(i,o),l=ra(c,d,a,e.q||"high",e.mbps),u=new Re({bitrate:l}),f=null,h=!1,p=[[c,d],[Math.round(c/16)*16,Math.round(d/16)*16]];
if(o>1080){let P=an(i,1080);p.push([P.W,P.H])}if(o>720){let P=an(i,720);p.push([P.W,P.H])}
let m=e.codec&&e.codec!=="auto"?[e.codec]:["avc","hevc","vp9","av1"];
for(let[P,R]of p)if(f=await Pn(m,{width:P,height:R,quality:u,frameRate:a}),f){c=P,d=R;break}
if(!f&&m.length===1){h=!0;for(let[P,R]of p)if(f=await Pn(["avc","hevc","vp9","av1"],{width:P,height:R,quality:u,frameRate:a}),f){c=P,d=R;break}}
if(!f)throw new Error("no-video-encoder");
u=new Re({bitrate:ra(c,d,a,e.q||"high",e.mbps)});
let g=null;e.abr!==0&&Yl(i)&&(await Qg()?g="aac":await In("opus")&&(g="opus"));
let w=new Rf,b=new WritableStream({write(P){w.write(P.data,P.position)}}),k=new ki({format:new hr({fastStart:!1}),target:new Xa(b,{chunked:!0,chunkSize:4*1024*1024})});
let _=Ff(i,e,c,d),A=c*_,v=d*_;
let VS=new Qa(f);k.addVideoTrack(VS,{frameRate:a});
let F=null;g&&(F=new zs({codec:g,quality:new Re({bitrate:X(Number(e.abr)||192,64,320)*1e3})}),k.addAudioTrack(F));
await k.start();
let allJobs=Jy(i,n,a,D),te=Math.min(4096,Math.round(Math.max(A,v)*1.4)),he=[];
i.clips.forEach((P,R)=>{let N=i.media[P.media];N&&N.kind==="image"&&he.push({mediaId:P.media,s:n.starts[R],e:n.starts[R]+n.durs[R]})});
for(let P of i.items){let R=P.media&&i.media[P.media];P.kind==="overlay"&&R&&R.kind==="image"&&he.push({mediaId:P.media,s:P.start,e:P.start+tt(i,P)})}
let ae=10,we=performance.now(),Te=null;
try{let P=document.featurePolicy||document.permissionsPolicy;Te=(!P||!P.allowsFeature||P.allowsFeature("screen-wake-lock"))&&navigator.wakeLock?await navigator.wakeLock.request("screen"):null}catch{Te=null}
let fail=null,done=0,next=0,flushIdx=0,results=new Array(segs.length),waiters=[],dc0=null,audT=0,flushChain=Promise.resolve(),workers=[];
let notify=()=>{waiters.splice(0).forEach(P=>P())};
let abortCheck=()=>{if(r&&r.aborted)throw new Error("canceled");if(fail)throw fail};
let u8=P=>P?P instanceof Uint8Array?P:ArrayBuffer.isView(P)?new Uint8Array(P.buffer,P.byteOffset,P.byteLength):new Uint8Array(P):null;
let sameDC=(P,R)=>{if(P.codec!==R.codec)return!1;let N=u8(P.description),G=u8(R.description);if(!N&&!G)return!0;if(!N||!G||N.length!==G.length)return!1;for(let V=0;V<N.length;V++)if(N[V]!==G[V])return!1;return!0};
let ensureAudio=async P=>{if(!F)return;let R=Math.min(s,P+ae);for(;audT<R-1e-9;){let N=audT,G=Math.min(s,audT+ae);t&&t({phase:"video",p:done/D,k:done,N:D});let V=await Zy(i,n,N,G);abortCheck();await F.add(V);audT=G}};
let flushReady=()=>(flushChain=flushChain.then(async()=>{if(fail)return;for(;flushIdx<segs.length&&results[flushIdx]&&results[flushIdx]!==!0;){let P=results[flushIdx];results[flushIdx]=!0;let R=segs[flushIdx][0]/a;await ensureAudio(segs[flushIdx][1]/a);if(!P.length||P[0][0].type!=="key")throw new Error("seg-no-key");for(let[N,G]of P){let V;if(G&&G.decoderConfig){if(!dc0)dc0=G.decoderConfig,V=G;else if(!sameDC(dc0,G.decoderConfig))throw new Error("dc-mismatch")}else if(!dc0)throw new Error("no-decoder-config");await VS.add(N,V)}flushIdx++;notify()}}).catch(P=>{fail=fail||P;notify()}),flushChain);
let mkWorker=()=>{let P=document.createElement("canvas");P.width=c,P.height=d;let R=P.getContext("2d",{alpha:!1}),N=_>1?e0(A,v):null,G=N?N.getContext("2d",{alpha:!1}):null;return{x:P,T:R,C:N,M:G}};
let worker=async(W,wI)=>{let my=[];for(let j=wI;j<segs.length;j+=K)my.push(j);if(!my.length)return;
let base=segs[my[0]][0]/a,pend=new Map,doneUpTo=0,starts=my.map(j=>segs[j][0]/a);
let complete=P=>{for(;doneUpTo<P;){let R=my[doneUpTo];results[R]=pend.get(R)||[];pend.delete(R);doneUpTo++}flushReady()};
let out=new ki({format:new hr({fastStart:!1}),target:new $a}),src=new Ds(W.x,{codec:f,quality:u,keyFrameInterval:2,latencyMode:"quality",onEncodedPacket:(P,R)=>{let N=P.timestamp+base,G=doneUpTo;for(;G+1<my.length&&starts[G+1]<=N+1e-6;)G++;G>doneUpTo&&complete(G);let V=my[G];pend.has(V)||pend.set(V,[]);pend.get(V).push([P.clone({timestamp:N}),R])}});
out.addVideoTrack(src,{frameRate:a});await out.start();
let inMy=G=>{for(let V of my)if(G>=segs[V][0]&&G<segs[V][1])return!0;return!1};
let z=allJobs.map(P=>{let R=[],N=[];P.frames.forEach((G,V)=>{inMy(G)&&(R.push(G),N.push(P.times[V]))});return R.length?{key:P.key,mediaId:P.mediaId,frames:R,times:N,pos:0}:null}).filter(Boolean);
let U=new Map(z.map(P=>[P.key,P])),Q=new Map,me={get(P,R,N,G){let V=i.media[R];if(!V)return null;if(V.kind==="image"){let j=Q.get(R);return j?ed(j):null}let K2=U.get(P);return K2&&K2.cur?wg(K2.cur):null}};
try{for(let q=0;q<my.length;q++){let J=my[q],[f0,f1]=segs[J];
for(let ye=f0;ye<f1;ye++){abortCheck();
if(ye===f0+8)for(;J-flushIdx>=2*K&&doneUpTo>=q&&!fail;)await new Promise(P=>waiters.push(P));
let V=ye/a,K2=new Set;for(let j of he)V>=j.s-.5&&V<j.e&&K2.add(j.mediaId);
for(let j of K2)if(!Q.has(j)){let ne=hf(j),ce=await createImageBitmap(ne),Le=Math.min(1,te/Math.max(ce.width,ce.height));if(Le<.999){let Ye=await createImageBitmap(ce,{resizeWidth:Math.round(ce.width*Le),resizeHeight:Math.round(ce.height*Le),resizeQuality:"high"});ce.close&&ce.close(),ce=Ye}Q.set(j,ce)}
for(let[j,ne]of[...Q])K2.has(j)||(ne.close&&ne.close(),Q.delete(j));
for(let j of z)j.closed||(j.pos<j.frames.length&&j.frames[j.pos]===ye?await tk(j):j.pos>=j.frames.length&&j.frames[j.frames.length-1]<ye&&await Mf(j));
W.M?(_o(W.M,A,v,V,i,n,me),W.T.save(),W.T.setTransform(1,0,0,1,0,0),W.T.imageSmoothingEnabled=!0,W.T.imageSmoothingQuality="high",W.T.drawImage(W.C,0,0,c,d),W.T.restore()):_o(W.T,c,d,V,i,n,me);
await src.add(V-base,1/a,ye===f0?{keyFrame:!0}:void 0);done++;
if(t&&(done%3===0||done===D)){let j=(performance.now()-we)/1e3;t({phase:"video",p:done/D,k:done,N:D,fps:done/Math.max(.001,j),canvas:workers[0]?workers[0].x:W.x,eta:j/done*(D-done)})}}}
for(let j of z)j.closed||await Mf(j);src.close();await out.finalize();complete(my.length)}
catch(P){fail=fail||P;notify();for(let R of z)R.closed||await Mf(R).catch(()=>{});try{await out.cancel()}catch{}}
finally{for(let P of Q.values())P.close&&P.close()}};
try{for(let P=0;P<K;P++)workers.push(mkWorker());
await Promise.all(workers.map((P,R)=>worker(P,R)));await flushChain;
if(fail)throw fail;if(flushIdx!==segs.length)throw new Error("seg-missing");
await ensureAudio(s);VS.close(),F&&F.close(),t&&t({phase:"finalize",p:1}),await k.finalize()}
catch(P){fail=fail||P;try{await k.cancel()}catch{}
if(r&&r.aborted||String(P&&P.message)==="canceled")throw P;
console.warn("paralel disa aktarma basarisiz, sirali yola donuluyor:",P);
try{Te&&Te.release()}catch{}
let R=await r0s(i,e,t,r);R.par=0;R.parErr=String(P&&P.message||P);return R}
finally{try{Te&&Te.release()}catch{}}
return{blob:w.blob("video/mp4"),W:c,H:d,fps:a,codec:f,acodec:g,dur:s,fb:h,ss:_,secs:(performance.now()-we)/1e3,par:K}}
