/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber – contentScript.js  (v0.2.3)
  ▸ Fixes based on latest feedback:
      • Uses **innerText** (not textContent) for content‑editable fields to
        keep original line breaks and avoid "space insertion".
      • Redaction loop now runs until **no further matches** (max 10 loops)
        guaranteeing a single click scrubs everything.
      • Avoids re‑inserting the Scrub button if one already exists inside
        the same parent node (prevents layout drift).
─────────────────────────────────────────────────────────────*/

/* async helper – background returns [{start,end}]  (still available) */
const detectSensitive = text =>
  new Promise(res => chrome.runtime.sendMessage({ type: 'scan', text }, res));

/* tiny utilities */
const isTextInput = el =>
  el && (el.tagName === 'TEXTAREA' || el.isContentEditable ||
         el.getAttribute('role') === 'textbox');

/* toast */
function toast(msg){
  const n = Object.assign(document.body.appendChild(document.createElement('div')), {
    textContent: msg,
    style:'position:fixed;bottom:120px;right:24px;padding:8px 12px;'+
          'background:#111;color:#fff;border-radius:6px;font:14px/1 sans-serif;'+
          'z-index:9999;opacity:0;transition:opacity .3s;'
  });
  requestAnimationFrame(()=>n.style.opacity='0.9');
  setTimeout(()=>{n.style.opacity='0'; setTimeout(()=>n.remove(),300);},2500);
}

/* helper to get & set raw text preserving formatting */
function getRaw(el){
  return el.tagName==='TEXTAREA' ? el.value : el.innerText;
}
function setRaw(el,txt){
  if(el.tagName==='TEXTAREA'){
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,txt);
    el.dispatchEvent(new Event('input',{bubbles:true}));
  }else{
    el.innerText = txt; // keeps newline → <div>/<br> structure
  }
}

/* main input handler */
let lastActive=null;
document.addEventListener('input', e=>{
  if(!isTextInput(e.target)) return;
  const el=e.target;
  if(!getRaw(el).trim()){ cleanUp(el); return; }
  lastActive=el;
  injectScrubButton(el);
}, true);

/* scrub button & shortcut */
function injectScrubButton(el){
  // only add once per parent node
  if(el.parentElement.querySelector('#scrubSendBtn')) return;
  const btn=document.createElement('button');
  btn.id='scrubSendBtn'; btn.type='button';
  btn.innerHTML=`<img src="${chrome.runtime.getURL('icons/logo.png')}" width="16" height="16" style="vertical-align:middle;margin-right:4px"> Scrub`;
  Object.assign(btn.style,{margin:'2px 8px',padding:'2px 8px 2px 6px',fontSize:'12px',
    border:'1px solid #d0d7de',borderRadius:'10px',background:'#fff',cursor:'pointer',
    display:'inline-flex',alignItems:'center',gap:'4px'});
  btn.onclick=()=>scrubText(el);
  el.parentElement.insertBefore(btn,el.nextSibling);
}

document.addEventListener('keydown',e=>{
  if(e.altKey && e.shiftKey && e.key.toLowerCase()==='s' && lastActive){
    e.preventDefault(); scrubText(lastActive);
  }
}, true);

/* ───────── Scrub core ───────── */
function scrubText(target){
  let raw = getRaw(target);
  let totalMasked = 0;
  for(let i=0;i<10;i++){
    const { clean, stats } = self.PromptScrubberRedactor.redact(raw);
    const maskedNow = Object.values(stats).reduce((a,b)=>a+b,0);
    totalMasked += maskedNow;
    raw = clean;
    if(maskedNow === 0) break; // done
  }
  setRaw(target, raw);
  toast(totalMasked ? `${totalMasked} sensitive item${totalMasked>1?'s':''} masked` : 'No sensitive items detected');
  if(!raw.trim()) cleanUp(target);
}

/* clean-up when box is emptied */
function cleanUp(el){
  const b=el.parentElement?.querySelector('#scrubSendBtn');
  if(b) b.remove();
  lastActive=null;
}
