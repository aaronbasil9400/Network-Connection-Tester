'use strict';
const metrics=window.NetVitalsMetrics;
if(!metrics)throw new Error('NetVitals metrics module failed to load.');
const {PROBE_PROFILE,SPEED_PROFILE,hasInternetAccess,runProbeSequence,steadyStateThroughput,aggregateThroughput}=metrics;
const STORAGE_KEY='phone-status-app-v3', HISTORY_KEY='phone-status-history-v4';
const defaults={timeoutMs:6000,intervalSec:0,services:[{name:'Cloudflare',url:'https://www.cloudflare.com/'},{name:'Google',url:'https://www.google.com/'},{name:'Microsoft',url:'https://www.microsoft.com/'}]};
const state={settings:loadJson(STORAGE_KEY,defaults),history:loadJson(HISTORY_KEY,[]),timer:null,checking:false,results:[],lastResult:null,securityResult:null};
const $=id=>document.getElementById(id);
const ids=['hero','overallDot','overallStatus','qualityScore','qualityLabel','lastCheck','testDuration','runProgress','progressText','fullBtn','quickBtn','shareBtn','settingsBtn','internetPill','internetMetric','internetDetail','latencyPill','latencyMetric','latencyDetail','latencyDelta','jitterPill','jitterMetric','jitterDetail','lossPill','lossMetric','lossDetail','downloadPill','downloadMetric','downloadDetail','downloadDelta','uploadPill','uploadMetric','uploadDetail','uploadDelta','networkPill','networkMetric','networkDetail','batteryPill','batteryMetric','batteryBar','batteryDetail','verdictPill','verdictSummary','gamingVerdict','callsVerdict','streamVerdict','browseVerdict','deviceMetric','deviceGrid','securityPill','securityScore','securitySummary','securityBar','securityList','serviceList','serviceSummary','latencyChart','downloadChart','uploadChart','latencyLatest','downloadLatest','uploadLatest','settingsPanel','closeSettingsBtn','timeoutInput','intervalInput','serviceEditors','addServiceBtn','resetBtn','saveBtn'];
const els=Object.fromEntries(ids.map(id=>[id,$(id)]));
function clone(v){return JSON.parse(JSON.stringify(v))} function loadJson(k,f){try{return JSON.parse(localStorage.getItem(k))??clone(f)}catch{return clone(f)}} function saveJson(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function classForStatus(s){return s==='good'?'good':s==='bad'?'bad':s==='warn'?'warn':''} function setPill(el,text,status=''){el.textContent=text;el.className=`pill ${classForStatus(status)}`.trim()} function nowLabel(){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium'}).format(new Date())}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))} function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function browserName(){const ua=navigator.userAgent;if(/CriOS/i.test(ua))return'Chrome';if(/FxiOS/i.test(ua))return'Firefox';if(/EdgiOS/i.test(ua))return'Edge';if(/Safari/i.test(ua)&&/Version/i.test(ua))return'Safari';if(/Chrome/i.test(ua))return'Chrome';return'Browser'}
function osName(){const ua=navigator.userAgent;const p=navigator.userAgentData?.platform||navigator.platform||'';if(/iPhone|iPad|iPod/i.test(ua)||(/Mac/i.test(p)&&navigator.maxTouchPoints>1))return'iOS / iPadOS';if(/Android/i.test(ua))return'Android';if(/Win/i.test(p))return'Windows';if(/Mac/i.test(p))return'macOS';if(/Linux/i.test(p))return'Linux';return p||'Unknown'}
function detectDevice(){const ua=navigator.userAgent;const mobile=navigator.userAgentData?.mobile??/Android|iPhone|iPad|iPod|Mobile/i.test(ua);const platform=/iPhone/i.test(ua)?'iPhone':/iPad/i.test(ua)?'iPad':mobile?'Mobile device':'Desktop / tablet';els.deviceMetric.textContent=platform;const rows=[['OS / platform',osName()],['Browser',browserName()],['CPU',`${navigator.hardwareConcurrency||'Unknown'} logical cores`],['Memory',navigator.deviceMemory?`${navigator.deviceMemory} GB approx.`:'Not exposed'],['Screen',`${screen.width} × ${screen.height}`],['Viewport',`${window.innerWidth} × ${window.innerHeight}`],['Pixel ratio',`${window.devicePixelRatio||1}×`],['Orientation',screen.orientation?.type||((window.innerWidth>window.innerHeight)?'Landscape':'Portrait')]];els.deviceGrid.innerHTML=rows.map(([k,v])=>`<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('')}
function updateNetworkInfo(){const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(!c){els.networkMetric.textContent=navigator.onLine?'Connected':'Offline';els.networkDetail.textContent='Detailed Wi-Fi/cellular information is not exposed by this browser.';setPill(els.networkPill,'Limited',navigator.onLine?'warn':'bad');return}const type=c.type||c.effectiveType||'Unknown';const bits=[];if(c.downlink)bits.push(`${c.downlink} Mbps estimated`);if(Number.isFinite(c.rtt))bits.push(`${c.rtt} ms RTT estimated`);if(c.saveData)bits.push('Data Saver on');els.networkMetric.textContent=String(type).toUpperCase();els.networkDetail.textContent=bits.join(' · ')||'Connection API available.';setPill(els.networkPill,c.saveData?'Data Saver':'Detected',c.saveData?'warn':'good')}
async function updateBattery(){if(!navigator.getBattery){els.batteryMetric.textContent='Unavailable';els.batteryDetail.textContent='This browser does not expose battery status.';setPill(els.batteryPill,'Restricted','warn');return}try{const b=await navigator.getBattery();const render=()=>{const pct=Math.round(b.level*100);els.batteryMetric.textContent=`${pct}%`;els.batteryBar.style.width=`${pct}%`;els.batteryDetail.textContent=b.charging?'Charging':'On battery';setPill(els.batteryPill,b.charging?'Charging':pct<20?'Low':'Normal',b.charging||pct>=20?'good':'warn')};render();b.addEventListener('levelchange',render,{passive:true});b.addEventListener('chargingchange',render,{passive:true})}catch{els.batteryMetric.textContent='Unavailable';setPill(els.batteryPill,'Error','warn')}}
function renderSecurityAssessment(){
  const checks=[];
  const add=(name,detail,status,points,earned)=>checks.push({name,detail,status,points,earned});
  const protocol=location.protocol,localhost=['localhost','127.0.0.1','::1'].includes(location.hostname),https=protocol==='https:'||localhost;
  add('Encrypted page transport',https?(protocol==='https:'?'Dashboard loaded over HTTPS.':'Localhost trusted development context.'):`Loaded over ${protocol||'unknown transport'}; HTTPS protection is not confirmed.`,https?'good':'bad',30,https?30:0);
  const secure=window.isSecureContext===true;
  add('Secure browser context',secure?'Sensitive browser APIs are running in a secure context.':'Browser does not consider this a secure context.',secure?'good':'bad',20,secure?20:0);
  const resources=performance.getEntriesByType?.('resource')||[],insecure=resources.filter(r=>/^http:\/\//i.test(r.name)),mixedSafe=insecure.length===0;
  add('Mixed-content exposure',mixedSafe?'No HTTP subresources observed.':`${insecure.length} HTTP subresource(s) observed.`,mixedSafe?'good':'bad',15,mixedSafe?15:0);
  const eps=state.settings.services||[],badEps=eps.filter(s=>!/^https:\/\//i.test(s.url)),epsSafe=eps.length>0&&badEps.length===0;
  add('Configured endpoint transport',epsSafe?`All ${eps.length} endpoints use HTTPS.`:badEps.length?`${badEps.length} endpoint(s) do not use HTTPS.`:'No endpoints configured.',epsSafe?'good':'warn',15,epsSafe?15:7);
  let embedded=false;
  try{embedded=window.self!==window.top}catch{embedded=true}
  add('Page embedding',embedded?'Dashboard is embedded in another page/frame.':'Dashboard is running as a top-level page.',embedded?'warn':'good',10,embedded?4:10);
  const crypto=!!(window.crypto&&window.crypto.subtle);
  add('Web cryptography support',crypto?'Modern Web Crypto API available.':'Web Crypto is unavailable or restricted.',crypto?'good':'warn',10,crypto?10:4);
  const total=checks.reduce((n,c)=>n+c.points,0),earned=checks.reduce((n,c)=>n+c.earned,0),score=clamp(Math.round(earned/total*100),0,100);
  let label='Low visible risk',status='good';
  if(score<55){label='High visible risk';status='bad'}else if(score<80){label='Review advised';status='warn'}
  els.securityScore.innerHTML=`${score}<small>/100</small>`;
  els.securityBar.style.width=`${score}%`;
  els.securitySummary.textContent=`${label}. This score covers only signals a web page can observe.`;
  setPill(els.securityPill,label,status);
  els.securityList.innerHTML='';
  checks.forEach(c=>{
    const row=document.createElement('div');
    row.className='security-item';
    row.innerHTML=`<span class="security-icon ${c.status}"></span><div><div class="security-name"></div><div class="security-detail"></div></div><div class="security-weight"></div>`;
    row.querySelector('.security-name').textContent=c.name;
    row.querySelector('.security-detail').textContent=c.detail;
    row.querySelector('.security-weight').textContent=`${c.earned}/${c.points}`;
    els.securityList.appendChild(row);
  });
  state.securityResult={score,label,status,checks};
  return state.securityResult;
}
function renderServices(results=null){els.serviceList.innerHTML='';state.settings.services.forEach((s,i)=>{const r=results?.[i],item=document.createElement('div');item.className='service-item';const statusClass=r?classForStatus(r.ok?'good':r.timeout?'warn':'bad'):'',text=r?(r.offline?'Offline':r.ok?`${Math.round(r.ms)} ms`:r.timeout?'Timed out':'Failed'):'Waiting';item.innerHTML=`<span class="service-light ${statusClass}"></span><div style="min-width:0"><div class="service-name"></div><div class="service-url"></div></div><div class="service-result">${text}</div>`;item.querySelector('.service-name').textContent=s.name||`Endpoint ${i+1}`;item.querySelector('.service-url').textContent=s.url;els.serviceList.appendChild(item)})}
async function serviceProbe(url,timeoutMs){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs),start=performance.now();try{const sep=url.includes('?')?'&':'?';await fetch(`${url}${sep}_status_check=${Date.now()}_${Math.random()}`,{method:'GET',mode:'no-cors',cache:'no-store',signal:c.signal,credentials:'omit',redirect:'follow'});return{ok:true,ms:performance.now()-start}}catch(e){return{ok:false,timeout:e?.name==='AbortError',ms:performance.now()-start,error:e?.message||'Request failed'}}finally{clearTimeout(t)}}
performance.setResourceTimingBufferSize?.(512);
function resourceTimingRtt(url){if(!performance.getEntriesByName)return NaN;const target=new URL(url,location.href).href;const entries=performance.getEntriesByName(target,'resource');const last=entries[entries.length-1];if(!last)return NaN;const rtt=last.responseStart-last.requestStart;return Number.isFinite(rtt)&&rtt>=0?rtt:NaN}
async function latencyProbe(timeoutMs=PROBE_PROFILE.timeoutMs){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs),start=performance.now(),probeUrl=`/ping.txt?_=${Date.now()}_${Math.random()}`;try{const response=await fetch(probeUrl,{method:'GET',cache:'no-store',signal:c.signal,credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const body=(await response.text()).trim();if(body!=='ok')throw new Error('Unexpected probe response');const timingRtt=resourceTimingRtt(probeUrl);return Number.isFinite(timingRtt)?{ok:true,ms:timingRtt,source:'timing'}:{ok:true,ms:performance.now()-start,source:'clock'}}catch(e){return{ok:false,timeout:e?.name==='AbortError',ms:performance.now()-start,error:e?.message||'Request failed'}}finally{clearTimeout(t)}}
async function runNetworkQualityProbe(full){updateProgress(7,'Warming up the latency path…');return runProbeSequence({full,probe:()=>latencyProbe(PROBE_PROFILE.timeoutMs),onMeasured:({index,total})=>updateProgress(10+Math.round(((index+1)/total)*20),`Measuring latency and stability · sample ${index+1} of ${total}`)})}
async function runServiceChecks(){updateProgress(33,'Checking configured services…');const results=await Promise.all(state.settings.services.map(service=>serviceProbe(service.url,state.settings.timeoutMs)));const reachable=results.filter(result=>result.ok).length;return{results,reachable,total:results.length}}
function latencyStatus(ms){if(!Number.isFinite(ms))return['Unknown','warn'];if(ms<80)return['Excellent','good'];if(ms<180)return['Good','good'];if(ms<350)return['Fair','warn'];return['Poor','bad']} function jitterStatus(ms){if(!Number.isFinite(ms))return['Unknown','warn'];if(ms<10)return['Excellent','good'];if(ms<30)return['Good','good'];if(ms<60)return['Fair','warn'];return['Poor','bad']} function lossStatus(p){if(!Number.isFinite(p))return['Unknown','warn'];if(p===0)return['Excellent','good'];if(p<=5)return['Good','good'];if(p<=15)return['High','warn'];return['Severe','bad']} function speedStatus(m){if(!Number.isFinite(m))return['Unavailable','warn'];if(m>=100)return['Excellent','good'];if(m>=25)return['Fast','good'];if(m>=5)return['Usable','warn'];return['Slow','bad']}
async function timedDownload(full){
  const durationMs=full?SPEED_PROFILE.fullDurationMs:SPEED_PROFILE.quickDurationMs;
  const maxBytes=full?SPEED_PROFILE.maxFullBytes:SPEED_PROFILE.maxQuickBytes;
  const streamCount=Math.max(1,SPEED_PROFILE.downloadStreams||1);
  const controller=new AbortController(),abortTimer=setTimeout(()=>controller.abort(),durationMs+20000);
  const chunks=[];let bytes=0,startAtMs=null,failure=null;
  const record=value=>{if(startAtMs===null)startAtMs=performance.now();bytes+=value.byteLength;chunks.push({atMs:performance.now()-startAtMs,bytes})};
  const finished=()=>startAtMs!==null&&(performance.now()-startAtMs>=durationMs||bytes>=maxBytes);
  try{
    try{
      const warmup=await fetch(`https://speed.cloudflare.com/__down?bytes=1000000&_=${Date.now()}_${Math.random()}`,{cache:'no-store',signal:controller.signal,credentials:'omit'});
      try{await warmup.body?.cancel()}catch{}
    }catch{}
    const runStream=async()=>{
      while(!failure&&!finished()){
        let res;
        try{
          res=await fetch(`https://speed.cloudflare.com/__down?bytes=${Math.min(SPEED_PROFILE.downloadChunkBytes,maxBytes-bytes)}&_=${Date.now()}_${Math.random()}`,{cache:'no-store',signal:controller.signal,credentials:'omit'});
        }catch(e){if(!failure)failure=e;return}
        if(!res.ok||!res.body){failure=failure||new Error(`HTTP ${res.status}`);return}
        const reader=res.body.getReader();
        try{
          for(;;){
            const{done,value}=await reader.read();
            if(done)break;
            record(value);
            if(finished())break;
          }
        }catch(e){if(e?.name!=='AbortError'||!chunks.length)failure=failure||e}
        finally{try{await reader.cancel()}catch{}}
      }
    };
    await Promise.all(Array.from({length:streamCount},()=>runStream()));
    if(!failure&&!chunks.length)failure=new Error('Insufficient download data');
  }finally{clearTimeout(abortTimer)}
  const mbps=steadyStateThroughput(chunks);
  if(!Number.isFinite(mbps))throw failure||new Error('Insufficient download data');
  return{mbps,bytes,durationSec:startAtMs===null?0:(chunks[chunks.length-1]?.atMs||0)/1000};
}
async function timedUpload(full){
  const durationMs=full?SPEED_PROFILE.fullDurationMs:SPEED_PROFILE.quickDurationMs;
  const maxBytes=full?SPEED_PROFILE.maxFullBytes:SPEED_PROFILE.maxQuickBytes;
  const controller=new AbortController(),abortTimer=setTimeout(()=>controller.abort(),durationMs+20000);
  const transfers=[];let sent=0,failure=null;
  const payload=new Blob(['0'.repeat(SPEED_PROFILE.uploadChunkBytes)],{type:'application/octet-stream'});
  try{
    try{
      await fetch(`https://speed.cloudflare.com/__up?_=${Date.now()}_${Math.random()}`,{method:'POST',body:new Blob(['0'.repeat(500000)],{type:'application/octet-stream'}),mode:'no-cors',cache:'no-store',signal:controller.signal,credentials:'omit'});
    }catch{}
    const started=performance.now();
    while(performance.now()-started<durationMs&&sent<maxBytes&&!failure){
      const t0=performance.now();
      try{
        await fetch(`https://speed.cloudflare.com/__up?_=${Date.now()}_${Math.random()}`,{method:'POST',body:payload,mode:'no-cors',cache:'no-store',signal:controller.signal,credentials:'omit'});
        sent+=SPEED_PROFILE.uploadChunkBytes;
        transfers.push({bytes:SPEED_PROFILE.uploadChunkBytes,sec:(performance.now()-t0)/1000});
      }catch(e){failure=e}
    }
  }finally{clearTimeout(abortTimer)}
  const mbps=aggregateThroughput(transfers);
  if(!Number.isFinite(mbps))throw failure||new Error('Insufficient upload data');
  return{mbps,bytes:sent};
}
async function runSpeedTests(full){
  els.downloadMetric.textContent='Testing…';
  els.uploadMetric.textContent='Waiting…';
  setPill(els.downloadPill,'Testing','warn');
  setPill(els.uploadPill,'Waiting','');
  const windowLabel=full?'8':'4';
  let download=NaN,upload=NaN,downBytes=0,upBytes=0;
  try{
    updateProgress(38,'Letting the connection settle before the download test…');
    await sleep(SPEED_PROFILE.settleMs);
    updateProgress(40,'Testing download speed…');
    els.downloadDetail.textContent=`Streaming a ${windowLabel}-second Cloudflare download window…`;
    const down=await timedDownload(full);
    download=down.mbps;downBytes=down.bytes;
    els.downloadMetric.textContent=`${download.toFixed(download>=100?0:1)} Mbps`;
    const [dl,dc]=speedStatus(download);
    setPill(els.downloadPill,dl,dc);
    els.downloadDetail.textContent=`Aggregate capacity across ${SPEED_PROFILE.downloadStreams} parallel streams · ${(downBytes/1e6).toFixed(0)} MB over ${down.durationSec.toFixed(1)} s · first ${SPEED_PROFILE.rampDiscardMs/1000} s ramp discarded.`;
  }catch(e){
    els.downloadMetric.textContent='Unavailable';
    setPill(els.downloadPill,'Failed','warn');
    els.downloadDetail.textContent=`Download test failed${e?.name==='AbortError'?' (timed out)':''}.`;
  }
  try{
    updateProgress(64,'Testing upload speed…');
    els.uploadMetric.textContent='Testing…';
    setPill(els.uploadPill,'Testing','warn');
    els.uploadDetail.textContent=`Streaming a ${windowLabel}-second Cloudflare upload window…`;
    const up=await timedUpload(full);
    upload=up.mbps;upBytes=up.bytes;
    els.uploadMetric.textContent=`${upload.toFixed(upload>=100?0:1)} Mbps`;
    const [ul,uc]=speedStatus(upload);
    setPill(els.uploadPill,ul,uc);
    els.uploadDetail.textContent=`Aggregate rate from repeated uploads totalling ${(upBytes/1e6).toFixed(0)} MB · first transfer discarded as warm-up.`;
  }catch(e){
    els.uploadMetric.textContent='Unavailable';
    setPill(els.uploadPill,'Failed','warn');
    els.uploadDetail.textContent=`Upload test failed${e?.name==='AbortError'?' (timed out)':''}.`;
  }
  return{download,upload,downBytes,upBytes};
}
function qualityScore(r){let score=100;if(!r.internetOk)return 10;score-=clamp(r.loss*2.4,0,35);if(Number.isFinite(r.latency))score-=clamp((r.latency-50)/8,0,20);else score-=20;if(Number.isFinite(r.jitter))score-=clamp((r.jitter-8)/3,0,15);else score-=15;if(Number.isFinite(r.download))score-=r.download>=50?0:r.download>=25?3:r.download>=10?7:r.download>=5?12:20;else score-=15;if(Number.isFinite(r.upload))score-=r.upload>=20?0:r.upload>=10?3:r.upload>=5?7:r.upload>=2?12:15;else score-=12;return clamp(Math.round(score),0,100)}
function scoreLabel(score){if(score>=90)return['Excellent','good'];if(score>=78)return['Good','good'];if(score>=60)return['Fair','warn'];return['Poor','bad']}
function classifyUseCase(type,r){if(!r.internetOk)return['POOR','bad'];const loss=r.loss,lat=r.latency,jit=r.jitter,down=r.download,up=r.upload;if(type==='gaming'){if(loss<=2&&lat<80&&jit<20)return['EXCELLENT','good'];if(loss<=5&&lat<160&&jit<40)return['GOOD','good'];if(loss<=10&&lat<250)return['FAIR','warn'];return['POOR','bad']}if(type==='calls'){if(loss<=2&&lat<150&&jit<30&&up>=5&&down>=5)return['EXCELLENT','good'];if(loss<=5&&lat<250&&up>=2&&down>=3)return['GOOD','good'];if(loss<=10&&up>=1)return['FAIR','warn'];return['POOR','bad']}if(type==='stream'){if(loss<=3&&down>=25)return['EXCELLENT','good'];if(loss<=5&&down>=10)return['GOOD','good'];if(down>=5)return['FAIR','warn'];return['POOR','bad']}if(loss<=5&&down>=10)return['EXCELLENT','good'];if(loss<=10&&down>=3)return['GOOD','good'];return down>=1?['FAIR','warn']:['POOR','bad']}
function renderVerdict(r){const s=qualityScore(r),[label,cls]=scoreLabel(s);els.qualityScore.innerHTML=`${s}<small>/100</small>`;els.qualityLabel.textContent=label;setPill(els.verdictPill,label,cls);els.verdictSummary.textContent=s>=90?'Fast, stable connection with strong results across the measured signals.':s>=78?'Connection is healthy for most everyday workloads.':s>=60?'Connection is usable, but one or more measurements may affect demanding tasks.':'Connection quality is poor or unstable; review the measurements below.';[['gamingVerdict','gaming'],['callsVerdict','calls'],['streamVerdict','stream'],['browseVerdict','browse']].forEach(([id,type])=>{const [v,c]=classifyUseCase(type,r);els[id].textContent=v;els[id].className=`verdict-value ${c}`});return{s,label,cls}}
function updateDelta(el,current,previous,lowerBetter=false,unit=''){if(!Number.isFinite(current)||!Number.isFinite(previous)||previous===0){el.textContent='';return}const pct=((current-previous)/previous)*100,better=lowerBetter?pct<0:pct>0,neutral=Math.abs(pct)<3;el.textContent=`${pct>=0?'▲':'▼'} ${Math.abs(pct).toFixed(0)}% vs previous check`;el.className=`delta ${neutral?'':better?'good':'warn'}`.trim()}
function updateProgress(p,text){els.runProgress.style.width=`${clamp(p,0,100)}%`;els.progressText.textContent=text}
async function runChecks(full=true){
  if(state.checking)return;
  state.checking=true;
  try{
  const started=performance.now(),previous=state.history[state.history.length-1];
  els.fullBtn.disabled=true;
  els.quickBtn.disabled=true;
  els.overallStatus.textContent='Running diagnostic';
  els.overallDot.className='overall-dot warn';
  els.hero.style.setProperty('--status-glow','rgba(255,176,32,.16)');
  updateProgress(4,'Checking browser and network state…');
  state.results=[];
  renderServices();
  setPill(els.serviceSummary,'Checking','');
  updateNetworkInfo();
  renderSecurityAssessment();
  const startedOnline=navigator.onLine!==false;
  const expectedSamples=full?PROBE_PROFILE.fullSamples:PROBE_PROFILE.quickSamples;
  let probe={samples:[],latency:NaN,jitter:NaN,failures:expectedSamples,successes:0,total:expectedSamples,loss:100};
  let services={results:state.settings.services.map(()=>({ok:false,offline:true,ms:0})),reachable:0,total:state.settings.services.length};
  let speed={download:NaN,upload:NaN};
    if(startedOnline){
      probe=await runNetworkQualityProbe(full);
      if(navigator.onLine!==false){
        services=await runServiceChecks();
        state.results=services.results;
        renderServices(services.results);
        speed=await runSpeedTests(full);
      }else{
        state.results=services.results;
        renderServices(services.results);
        els.downloadMetric.textContent='— Mbps';
        els.uploadMetric.textContent='— Mbps';
        els.downloadDetail.textContent='Skipped because the browser reports offline.';
        els.uploadDetail.textContent='Skipped because the browser reports offline.';
        setPill(els.downloadPill,'Offline','bad');
        setPill(els.uploadPill,'Offline','bad');
      }
    }else{
      state.results=services.results;
      renderServices(services.results);
      els.downloadMetric.textContent='— Mbps';
      els.uploadMetric.textContent='— Mbps';
      els.downloadDetail.textContent='Skipped because the browser reports offline.';
      els.uploadDetail.textContent='Skipped because the browser reports offline.';
      setPill(els.downloadPill,'Offline','bad');
      setPill(els.uploadPill,'Offline','bad');
    }

    updateProgress(82,'Calculating connection quality…');
    const browserOnline=navigator.onLine!==false;
    const internetOk=hasInternetAccess(browserOnline,probe.successes,services.reachable);
    const partial=internetOk&&(probe.failures>0||services.reachable<services.total);
    els.internetMetric.textContent=internetOk?'Online':'Offline';
    els.internetDetail.textContent=browserOnline?`${probe.successes}/${probe.total} latency probes and ${services.reachable}/${services.total} services responded.`:'The browser reports that this device is offline.';
    setPill(els.internetPill,internetOk?'Connected':'No access',internetOk?(partial?'warn':'good'):'bad');

    els.latencyMetric.textContent=Number.isFinite(probe.latency)?`${Math.round(probe.latency)} ms`:'— ms';
    const [ll,lc]=latencyStatus(probe.latency);
    setPill(els.latencyPill,ll,lc);
    els.latencyDetail.textContent=Number.isFinite(probe.latency)?`Median HTTP RTT · ${probe.successes} successful of ${probe.total} samples.`:'Median HTTP RTT unavailable; no latency probe succeeded.';

    els.jitterMetric.textContent=Number.isFinite(probe.jitter)?`${probe.jitter.toFixed(1)} ms`:'— ms';
    const [jl,jc]=jitterStatus(probe.jitter);
    setPill(els.jitterPill,jl,jc);
    els.jitterDetail.textContent=Number.isFinite(probe.jitter)?'Mean variation between sequential successful probes.':'Jitter requires at least two successful latency probes.';

    els.lossMetric.textContent=`${Math.round(probe.loss)}%`;
    const [pl,pc]=lossStatus(probe.loss);
    setPill(els.lossPill,pl,pc);
    els.lossDetail.textContent=`${probe.failures} failed of ${probe.total} latency probes. Application-layer approximation.`;
    setPill(els.serviceSummary,`${services.reachable}/${services.total} services reachable`,services.reachable===services.total?'good':services.reachable>0?'warn':'bad');

    const result={time:Date.now(),latency:probe.latency,jitter:probe.jitter,loss:probe.loss,download:speed.download,upload:speed.upload,internetOk};
    const verdict=renderVerdict(result);
    state.lastResult={...result,score:verdict.s};
    updateDelta(els.latencyDelta,probe.latency,previous?.latency,true,'ms');
    updateDelta(els.downloadDelta,speed.download,previous?.download,false,'Mbps');
    updateDelta(els.uploadDelta,speed.upload,previous?.upload,false,'Mbps');
    if(Number.isFinite(probe.latency)||Number.isFinite(speed.download)||Number.isFinite(speed.upload)){
      state.history.push(result);
      state.history=state.history.slice(-20);
      saveJson(HISTORY_KEY,state.history);
    }
    drawAllCharts();
    const overallClass=!internetOk?'bad':verdict.s>=78?'good':verdict.s>=60?'warn':'bad';
    els.overallStatus.textContent=!internetOk?'Connection problem':verdict.s>=90?'Connection excellent':verdict.s>=78?'Connection healthy':verdict.s>=60?'Connection degraded':'Connection poor';
    els.overallDot.className=`overall-dot ${overallClass}`;
    els.hero.style.setProperty('--status-glow',overallClass==='good'?'rgba(46,212,122,.14)':overallClass==='warn'?'rgba(255,176,32,.16)':'rgba(255,93,108,.16)');
    els.lastCheck.textContent=`Last checked: ${nowLabel()}`;
    els.testDuration.textContent=`Duration: ${((performance.now()-started)/1000).toFixed(1)} s`;
    updateProgress(100,full?'Full diagnostic complete.':'Quick check complete.');
  }catch{
    els.overallStatus.textContent='Diagnostic could not complete';
    els.overallDot.className='overall-dot bad';
    els.hero.style.setProperty('--status-glow','rgba(255,93,108,.16)');
    updateProgress(0,'The diagnostic stopped unexpectedly. Please retry.');
  }finally{
    state.checking=false;
    els.fullBtn.disabled=false;
    els.quickBtn.disabled=false;
  }
}
function drawChart(canvas,data,key,suffix){const ctx=canvas.getContext('2d'),ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1)),w=canvas.clientWidth||280,h=110;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;[.25,.5,.75].forEach(f=>{ctx.beginPath();ctx.moveTo(0,h*f);ctx.lineTo(w,h*f);ctx.stroke()});const vals=data.map(d=>d[key]).filter(Number.isFinite);if(vals.length<2){ctx.fillStyle='#9aa8bd';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('Run at least two checks',w/2,h/2+4);return}const max=Math.max(...vals,1)*1.15,min=Math.min(0,...vals),valid=data.filter(d=>Number.isFinite(d[key])),points=valid.map((d,i)=>({x:8+(i/(valid.length-1))*(w-16),y:h-10-((d[key]-min)/(max-min||1))*(h-22)}));const gradient=ctx.createLinearGradient(0,0,w,0);gradient.addColorStop(0,'#67a7ff');gradient.addColorStop(1,'#2ed47a');ctx.strokeStyle=gradient;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.fillStyle='#f4f7fb';points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,2.3,0,Math.PI*2);ctx.fill()})}
function drawAllCharts(){drawChart(els.latencyChart,state.history,'latency','ms');drawChart(els.downloadChart,state.history,'download','Mbps');drawChart(els.uploadChart,state.history,'upload','Mbps');const last=state.history[state.history.length-1];els.latencyLatest.textContent=Number.isFinite(last?.latency)?`${Math.round(last.latency)} ms`:'— ms';els.downloadLatest.textContent=Number.isFinite(last?.download)?`${last.download.toFixed(1)} Mbps`:'— Mbps';els.uploadLatest.textContent=Number.isFinite(last?.upload)?`${last.upload.toFixed(1)} Mbps`:'— Mbps'}
function buildReport(){const r=state.lastResult,c=navigator.connection||navigator.mozConnection||navigator.webkitConnection,lines=['NETVITALS REPORT',`Generated: ${nowLabel()}`,`Overall: ${els.overallStatus.textContent}`,`Quality: ${r?`${r.score}/100`:'Not checked'}`,`Internet: ${els.internetMetric.textContent}`,`Latency: ${els.latencyMetric.textContent}`,`Jitter: ${els.jitterMetric.textContent}`,`Request loss: ${els.lossMetric.textContent}`,`Download: ${els.downloadMetric.textContent}`,`Upload: ${els.uploadMetric.textContent}`,`Network: ${c?.effectiveType||c?.type||'Not exposed'}`,`Battery: ${els.batteryMetric.textContent}`,`Device: ${els.deviceMetric.textContent}`,`Security signals: ${state.securityResult?`${state.securityResult.score}/100 — ${state.securityResult.label}`:'Not checked'}`,'','USE CASES',`Gaming: ${els.gamingVerdict.textContent}`,`Video calls: ${els.callsVerdict.textContent}`,`Streaming: ${els.streamVerdict.textContent}`,`Browsing: ${els.browseVerdict.textContent}`,'','ENDPOINTS'];state.settings.services.forEach((s,i)=>{const x=state.results[i];lines.push(`${s.name}: ${x?(x.offline?'Offline':x.ok?`Reachable, ${Math.round(x.ms)} ms`:x.timeout?'Timed out':'Failed'):'Not checked'} — ${s.url}`)});lines.push('','Measurement notes:','Latency is a median browser HTTP RTT approximation.','Request loss is an application-layer approximation.','Security scoring covers browser-visible signals only.');return lines.join('\n')}
async function shareReport(){const text=buildReport();try{if(navigator.share){await navigator.share({title:'NetVitals Report',text});return}await navigator.clipboard.writeText(text);const old=els.shareBtn.textContent;els.shareBtn.textContent='Copied report';setTimeout(()=>els.shareBtn.textContent=old,1400)}catch(e){if(e?.name!=='AbortError')window.prompt('Copy this report:',text)}}
function openSettings(){els.timeoutInput.value=state.settings.timeoutMs;els.intervalInput.value=state.settings.intervalSec;renderServiceEditors(state.settings.services);els.settingsPanel.classList.add('open');document.body.style.overflow='hidden'} function closeSettings(){els.settingsPanel.classList.remove('open');document.body.style.overflow=''}
function renderServiceEditors(services){els.serviceEditors.innerHTML='';services.forEach((s)=>{const row=document.createElement('div');row.className='service-editor';row.innerHTML=`<label>Name<input class="edit-name" value=""></label><label>HTTPS URL<input class="edit-url" type="url" value=""></label><button class="danger-button remove-service" aria-label="Remove endpoint">−</button>`;row.querySelector('.edit-name').value=s.name;row.querySelector('.edit-url').value=s.url;row.querySelector('.remove-service').addEventListener('click',()=>row.remove());els.serviceEditors.appendChild(row)})}
function collectServices(){return[...els.serviceEditors.querySelectorAll('.service-editor')].map((row,i)=>({name:row.querySelector('.edit-name').value.trim()||`Endpoint ${i+1}`,url:row.querySelector('.edit-url').value.trim()})).filter(s=>/^https:\/\//i.test(s.url))}
function scheduleAutoRefresh(){clearInterval(state.timer);state.timer=null;if(state.settings.intervalSec>0)state.timer=setInterval(()=>runChecks(false),Math.max(5,state.settings.intervalSec)*1000)}
els.fullBtn.addEventListener('click',()=>runChecks(true));els.quickBtn.addEventListener('click',()=>runChecks(false));els.shareBtn.addEventListener('click',shareReport);els.settingsBtn.addEventListener('click',openSettings);els.closeSettingsBtn.addEventListener('click',closeSettings);els.settingsPanel.addEventListener('click',e=>{if(e.target===els.settingsPanel)closeSettings()});els.addServiceBtn.addEventListener('click',()=>{const current=collectServices();current.push({name:'New service',url:'https://'});renderServiceEditors(current)});els.resetBtn.addEventListener('click',()=>{state.settings=clone(defaults);els.timeoutInput.value=state.settings.timeoutMs;els.intervalInput.value=state.settings.intervalSec;renderServiceEditors(state.settings.services)});els.saveBtn.addEventListener('click',()=>{const services=collectServices();state.settings={timeoutMs:Math.min(30000,Math.max(1000,Number(els.timeoutInput.value)||defaults.timeoutMs)),intervalSec:Math.min(3600,Math.max(0,Number(els.intervalInput.value)||0)),services:services.length?services:clone(defaults.services)};saveJson(STORAGE_KEY,state.settings);renderServices();renderSecurityAssessment();scheduleAutoRefresh();closeSettings()});window.addEventListener('online',()=>{updateNetworkInfo();runChecks(false)});window.addEventListener('offline',()=>{updateNetworkInfo();els.overallStatus.textContent='Device is offline';els.overallDot.className='overall-dot bad';els.internetMetric.textContent='Offline';setPill(els.internetPill,'No access','bad')});window.addEventListener('resize',()=>{detectDevice();drawAllCharts()});window.addEventListener('orientationchange',()=>setTimeout(detectDevice,150));const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;connection?.addEventListener?.('change',updateNetworkInfo);
detectDevice();updateNetworkInfo();updateBattery();renderSecurityAssessment();renderServices();drawAllCharts();scheduleAutoRefresh();
