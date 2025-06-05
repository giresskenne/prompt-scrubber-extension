/*─────────────────────────────────────────────────────────────
  Prompt-Scrubber – contentScript.js  (v0.3.0)
  ▸ Enhanced with sensitive text underlining:
      • Adds "Underline Sensitive" button to highlight sensitive data
      • Visual feedback before scrubbing with red underlines
      • Toggle functionality to show/hide underlines
      • Preserves all original scrubbing functionality
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
let underlineState = new Map(); // Track underline state per element
// Track whether the extension is enabled
let scrubberEnabled = true;

// On load, get the enabled state from storage
chrome.storage && chrome.storage.sync.get('enabled', result => {
  scrubberEnabled = result.hasOwnProperty('enabled') ? result.enabled : true;
});

// Listen for enable/disable messages from popup
chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg && msg.action === 'setState' && typeof msg.enabled === 'boolean') {
    scrubberEnabled = msg.enabled;
  }
});

function injectScrubButton(el){
  // only add once per parent node
  if(el.parentElement.querySelector('#scrubSendBtn')) return;
  
  // Create container for buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:inline-flex;gap:4px;margin:2px 8px;';
  
  // Scrub button only (underline button removed)
  const scrubBtn = document.createElement('button');
  scrubBtn.id = 'scrubSendBtn';
  scrubBtn.type = 'button';
  scrubBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/logo.png')}" width="16" height="16" style="vertical-align:middle;margin-right:4px"> Scrub`;
  Object.assign(scrubBtn.style, {
    padding: '2px 8px 2px 6px',
    fontSize: '12px',
    border: '1px solid #d0d7de',
    borderRadius: '10px',
    background: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  });
  scrubBtn.onclick = () => scrubText(el);
  
  buttonContainer.appendChild(scrubBtn);
  el.parentElement.insertBefore(buttonContainer, el.nextSibling);
}

// Automatically highlight sensitive info in textarea on input
function autoHighlightSensitive(el) {
  if (el.tagName === 'TEXTAREA') {
    const text = getRaw(el);
    if (!text.trim()) {
      el.style.background = '';
      el.removeAttribute('data-sensitive-count');
      return;
    }

    // Use the same redactor logic as the scrub function
    const { stats } = self.PromptScrubberRedactor.redact(text);
    const totalSensitive = Object.values(stats).reduce((a,b)=>a+b,0);
    
    if (totalSensitive > 0) {
      el.style.background = 'linear-gradient(90deg, #fff 0%, #ffebee 100%)';
      el.setAttribute('data-sensitive-count', totalSensitive);
    } else {
      el.style.background = '';
      el.removeAttribute('data-sensitive-count');
    }
  }
}

document.addEventListener('input', e=>{
  if (!scrubberEnabled) return;
  if(!isTextInput(e.target)) return;
  const el=e.target;
  if(!getRaw(el).trim()){ cleanUp(el); return; }
  lastActive=el;
  injectScrubButton(el);
  autoHighlightSensitive(el); // highlight automatically
}, true);

/* ───────── Scrub core (enhanced) ───────── */
function scrubText(target){
  // Remove underlines before scrubbing
  if (underlineState.get(target)) {
    removeUnderlines(target);
    underlineState.set(target, false);
    updateUnderlineButton(target, false);
  }
  
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

/* clean-up when box is emptied (enhanced) */
function cleanUp(el){
  const buttonContainer = el.parentElement?.querySelector('#scrubSendBtn')?.parentElement;
  if(buttonContainer) buttonContainer.remove();
  underlineState.delete(el);
  lastActive=null;
}