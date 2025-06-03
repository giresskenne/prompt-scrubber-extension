/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber – contentScript.js  (v0.2.0)
─────────────────────────────────────────────────────────────*/

/* async helper – background returns [{start,end}] */
const detectSensitive = text =>
  new Promise(res => chrome.runtime.sendMessage({ type: 'scan', text }, res));


/* tiny utilities */
const isTextInput = el =>
  el && (el.tagName === 'TEXTAREA' || el.isContentEditable ||
         el.getAttribute('role') === 'textbox');

const escapeHTML = s =>
  s.replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));

/* toast */
function toast(msg){
  const n = Object.assign(document.body.appendChild(document.createElement('div')), {
    textContent: msg,
    style:'position:fixed;bottom:120px;right:24px;padding:8px 12px;'+
          'background:#111;color:#fff;border-radius:6px;font:14px/1 sans-serif;'+
          'z-index:9999;opacity:0;transition:opacity .3s;'
  });
  requestAnimationFrame(()=>n.style.opacity='0.9');
  setTimeout(()=>{n.style.opacity='0'; setTimeout(()=>n.remove(),300);},2000);
}

/* global style (wavy underline) */
(function(){ if(document.getElementById('psCSS')) return;
  const s=document.createElement('style'); s.id='psCSS';
  s.textContent=`
    .ps-wrapper{position:relative;}
    .ps-overlay{position:absolute;top:0;left:0;width:100%;height:100%;
                pointer-events:none;white-space:pre-wrap;word-break:break-word;
                color:transparent;font:inherit;line-height:inherit;padding:inherit;}
    .ps-hl{text-decoration:underline wavy #004aad;color:inherit;}
  `;
  document.head.appendChild(s);
})();

/* overlay helpers */
function copyFontBox(src,dst){
  const cs=getComputedStyle(src);
  [
    'font','fontFamily','fontSize','fontWeight','lineHeight',
    'letterSpacing','wordSpacing','whiteSpace','wordBreak','tabSize',
    'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'textIndent'
  ].forEach(p=>dst.style[p]=cs[p]);
}
function ensureWrapper(el){
  if(el.parentNode?.classList.contains('ps-wrapper')) return el.parentNode;
  const w=document.createElement('div'); w.className='ps-wrapper';
  w.style.position='relative'; el.parentNode.insertBefore(w,el); w.appendChild(el);
  return w;
}
function ensureOverlay(el){
  if(el._psOverlay) return el._psOverlay;
  const ov=document.createElement('div'); ov.className='ps-overlay';
  copyFontBox(el,ov); ensureWrapper(el).appendChild(ov);
  /* sync size & scroll */
  const sync=()=>{ ov.style.width=el.clientWidth+'px';
                   ov.style.height=el.clientHeight+'px';
                   ov.scrollTop=el.scrollTop; };
  sync(); el.addEventListener('scroll',sync);
  new ResizeObserver(sync).observe(el);
  return (el._psOverlay=ov);
}
function paint(el,text,matches){
  const ov=ensureOverlay(el);
  if(!matches.length){ ov.innerHTML=''; return; }
  matches.sort((a,b)=>a.start-b.start);
  let out='',last=0;
  for(const {start,end} of matches){
    out+=escapeHTML(text.slice(last,start));
    out+=`<span class="ps-hl">${escapeHTML(text.slice(start,end))}</span>`;
    last=end;
  }
  out+=escapeHTML(text.slice(last));
  ov.innerHTML=out;
}

/* fast local regex for instant preview */
const quickRX=new RegExp([
  '\\bAKIA[0-9A-Z]{12,20}\\b',
  '\\b(?:sk|gh[pous]|gitpat)[-_][A-Za-z0-9]{20,}\\b',
  '[A-Za-z0-9._%+-]+@[^\\s@]+\\.[A-Za-z]{2,}',
  '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
  '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b'
].join('|'),'gi');

/* background ready? */
let detectorReady=false;
chrome.runtime.sendMessage({type:'ping'}, m=>{ if(m?.ready) detectorReady=true; });

/* main input handler */
let lastActive=null;
document.addEventListener('input', async e=>{
  if(!isTextInput(e.target)) return;
  const el=e.target, raw = el.tagName==='TEXTAREA'?el.value:el.innerText;
  if(!raw.trim()){ cleanUp(el); return; }
  lastActive=el;

  /* quick preview */
  const quick=[]; quickRX.lastIndex=0; let m;
  while((m=quickRX.exec(raw))) quick.push({start:m.index,end:m.index+m[0].length});
  paint(el,raw,quick);

  /* hi-fidelity detection */
  if(detectorReady){
    const full = await detectSensitive(raw);
    paint(el,raw,full);
  }

  injectScrubButton(el);
},true);

/* scrub button & shortcut */
function injectScrubButton(el){
  if(document.getElementById('scrubSendBtn')) return;
  const btn=document.createElement('button');
  btn.id='scrubSendBtn'; btn.type='button';
  btn.innerHTML=`<img src="${chrome.runtime.getURL('icons/logo.png')}" width="16" height="16"
                   style="vertical-align:middle;margin-right:4px"> Scrub`;
  Object.assign(btn.style,{margin:'2px 8px',padding:'2px 8px 2px 6px',fontSize:'12px',
    border:'1px solid #d0d7de',borderRadius:'10px',background:'#fff',cursor:'pointer',
    display:'inline-flex',alignItems:'center',gap:'4px'});
  btn.onclick=()=>scrubText(el);
  el.parentElement.insertBefore(btn,el.nextSibling);
}
document.addEventListener('keydown',e=>{
  if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==='s'&&lastActive){
    e.preventDefault(); scrubText(lastActive);
  }
},true);

/* scrub core */
function scrubText(target){
  const raw = target.tagName==='TEXTAREA'?target.value:target.innerText;
  const {clean,stats}=self.PromptScrubberRedactor.redact(raw);
  if(target.tagName==='TEXTAREA'){
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(target,clean);
    target.dispatchEvent(new Event('input',{bubbles:true}));
  }else{ target.innerText=clean; }
  const total=Object.values(stats).reduce((a,b)=>a+b,0);
  toast(total?`${total} sensitive items masked`:'No sensitive items detected');
  if(!clean.trim()) cleanUp(target);
}
/* remove overlay & button when box is empty */
function cleanUp(el){
  if(el._psOverlay){ el._psOverlay.innerHTML=''; }
  const b=document.getElementById('scrubSendBtn'); if(b) b.remove();
  lastActive=null;
}
