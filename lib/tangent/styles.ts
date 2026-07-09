// All tangent UI styling, injected once. Theme-aware via [data-st-theme] so it matches the host.
export function injectStyles(): void {
  if (document.getElementById('st-styles')) return;
  const style = document.createElement('style');
  style.id = 'st-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CSS = `
.st-tangent-btn{position:fixed;z-index:2147483647;display:none;padding:4px 9px;border-radius:7px;
  border:1px solid transparent;font:500 12px ui-sans-serif,system-ui,sans-serif;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.18)}
.st-tangent-btn[data-st-theme="light"]{background:#0d0d0d;color:#fff}
.st-tangent-btn[data-st-theme="dark"]{background:#ececec;color:#1a1a1a}

.st-card{position:fixed;z-index:2147483646;padding:14px;border-radius:16px;
  display:flex;flex-direction:column;max-height:calc(100vh - 24px);
  box-shadow:0 16px 48px rgba(0,0,0,.30);animation:st-pop .14s ease-out;
  font-family:'Söhne',ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:14px}
@keyframes st-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
.st-card[data-st-theme="light"]{background:#fff;border:1px solid #e5e5e5;color:#0d0d0d}
.st-card[data-st-theme="dark"]{background:#2a2a2a;border:1px solid #3a3a3a;color:#ececec}
/* tail so it reads as a thought bubble popping out of the text */
.st-card::before{content:"";position:absolute;top:-7px;left:24px;width:13px;height:13px;transform:rotate(45deg)}
.st-card[data-st-theme="light"]::before{background:#fff;border-top:1px solid #e5e5e5;border-left:1px solid #e5e5e5}
.st-card[data-st-theme="dark"]::before{background:#2a2a2a;border-top:1px solid #3a3a3a;border-left:1px solid #3a3a3a}

/* collapsed side pill, shown when the tangented text is off-screen */
.st-card.st-min{right:16px;bottom:96px;width:auto;max-width:220px;padding:8px 14px;border-radius:20px;
  cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.st-card.st-min::before{display:none}
.st-card.st-min .st-card-actions,.st-card.st-min .st-quote,.st-card.st-min .st-thread,
.st-card.st-min .st-quickbar,.st-card.st-min .st-composer{display:none}
.st-card.st-min .st-card-head{margin:0}
.st-card.st-min .st-card-label{opacity:.9;max-width:180px}

.st-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;cursor:move;user-select:none}
.st-card-label{font-size:12px;font-weight:600;opacity:.6;flex:1 1 auto;min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.st-card-actions{display:flex;gap:2px;flex:0 0 auto}
.st-back{font-size:17px;line-height:1;padding:2px 6px}
.st-icon{background:none;border:none;cursor:pointer;color:inherit;opacity:.5;font-size:13px;line-height:1;padding:3px 5px;border-radius:6px}
.st-icon:hover{opacity:1;background:rgba(128,128,128,.12);background:color-mix(in srgb, currentColor 12%, transparent)}
.st-icon:disabled{opacity:.2;cursor:default}
.st-send.st-stop{background:#d33!important;color:#fff!important}
.st-answer-actions{margin-top:6px}
.st-mini{border:none;background:none;color:inherit;opacity:.5;cursor:pointer;font:12px ui-sans-serif,system-ui,sans-serif;padding:2px 6px;border-radius:6px}
.st-mini:hover{opacity:1;background:rgba(128,128,128,.12);background:color-mix(in srgb, currentColor 12%, transparent)}
.st-launcher-row{display:flex;align-items:center;gap:4px}
.st-launcher-row .st-list-item{flex:1 1 auto}
.st-quote{border-left:2px solid currentColor;opacity:.55;padding-left:10px;margin-bottom:12px;
  font-size:13px;line-height:1.5;max-height:96px;overflow:auto}
.st-thread{display:flex;flex-direction:column;gap:12px;margin-bottom:12px;flex:1 1 auto;
  min-height:0;overflow-y:auto}
.st-msg{line-height:1.6;white-space:pre-wrap;word-break:break-word}
.st-user{align-self:flex-end;max-width:85%;padding:8px 14px;border-radius:18px}
.st-card[data-st-theme="light"] .st-user{background:#ececec}
.st-card[data-st-theme="dark"] .st-user{background:#3a3a3a}
.st-assistant{align-self:stretch}
.st-thinking{opacity:.5}
/* quick-action + suggested-follow-up chips */
.st-quickbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;flex:0 0 auto}
.st-chip{border:1px solid rgba(128,128,128,.22);border:1px solid color-mix(in srgb, currentColor 22%, transparent);border-radius:14px;
  padding:3px 10px;font:500 12px ui-sans-serif,system-ui,sans-serif;cursor:pointer;
  background:transparent;color:inherit;opacity:.85;max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.st-chip:hover{opacity:1;background:rgba(128,128,128,.1);background:color-mix(in srgb, currentColor 10%, transparent)}
.st-chip:disabled{opacity:.35;cursor:default}
.st-followups{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.st-followup{font-size:11px;padding:2px 9px}
.st-composer{display:flex;align-items:flex-end;gap:8px;flex:0 0 auto}
.st-input{flex:1;resize:none;border-radius:18px;padding:9px 13px;font:inherit;color:inherit;
  background:transparent;max-height:140px}
.st-card[data-st-theme="light"] .st-input{border:1px solid #d5d5d5}
.st-card[data-st-theme="dark"] .st-input{border:1px solid #4a4a4a}
.st-send{border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:15px;flex:0 0 auto}
.st-card[data-st-theme="light"] .st-send{background:#0d0d0d;color:#fff}
.st-card[data-st-theme="dark"] .st-send{background:#ececec;color:#1a1a1a}
.st-send:disabled{opacity:.4;cursor:default}

/* corner grip to resize the bubble */
.st-resize{position:absolute;right:3px;bottom:3px;width:14px;height:14px;cursor:nwse-resize;opacity:.4;
  border-right:2px solid currentColor;border-bottom:2px solid currentColor;border-bottom-right-radius:5px}
.st-resize:hover{opacity:.8}
.st-card.st-min .st-resize{display:none}

/* highlight on the message a tangent is anchored to */
.st-anchored{outline:2px solid rgba(139,123,255,.55);outline:2px solid color-mix(in srgb, #8b7bff 55%, transparent);outline-offset:6px;border-radius:8px}

/* per-message marker badge */
.st-marker{position:absolute;top:6px;right:6px;z-index:6;border:none;border-radius:12px;
  padding:2px 9px;font:600 11px ui-sans-serif,system-ui,sans-serif;cursor:pointer;color:#fff;
  background:#7c5cff;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.st-marker:hover{opacity:1}

/* floating index of all tangents in the conversation */
.st-launcher{position:fixed;left:20px;bottom:20px;z-index:2147483645;border:none;border-radius:20px;
  padding:8px 14px;font:600 13px ui-sans-serif,system-ui,sans-serif;cursor:pointer;color:#fff;
  background:#7c5cff;box-shadow:0 6px 20px rgba(0,0,0,.25)}

/* shared dropdown surfaces (marker menu + launcher panel) */
.st-marker-menu{position:absolute;top:30px;right:6px}
.st-launcher-panel{position:fixed;left:20px;bottom:60px}
.st-marker-menu,.st-launcher-panel{z-index:2147483645;min-width:200px;max-height:300px;overflow:auto;
  padding:6px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);
  background:#fff;color:#0d0d0d;border:1px solid #e5e5e5}
.st-marker-menu[data-st-theme="dark"],.st-launcher-panel[data-st-theme="dark"]{
  background:#2a2a2a;color:#ececec;border-color:#3a3a3a}
.st-list-item{display:block;width:100%;text-align:left;border:none;background:none;color:inherit;
  padding:7px 9px;border-radius:7px;cursor:pointer;font:13px ui-sans-serif,system-ui,sans-serif;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-list-item:hover{background:rgba(128,128,128,.12);background:color-mix(in srgb, currentColor 12%, transparent)}

/* export and import actions at the top of the launcher panel */
.st-launcher-actions{display:flex;gap:6px;padding:2px 2px 8px;margin-bottom:4px;
  border-bottom:1px solid rgba(128,128,128,.14);border-bottom:1px solid color-mix(in srgb, currentColor 14%, transparent)}
.st-export{flex:1;border:none;border-radius:7px;padding:6px 8px;cursor:pointer;
  font:600 12px ui-sans-serif,system-ui,sans-serif;color:inherit;
  background:rgba(128,128,128,.1);background:color-mix(in srgb, currentColor 10%, transparent)}
.st-export:hover{background:rgba(128,128,128,.18);background:color-mix(in srgb, currentColor 18%, transparent)}
.st-launcher-empty{padding:8px 9px;opacity:.6;font:13px ui-sans-serif,system-ui,sans-serif;line-height:1.45}

/* dismissible toast notices (broken-selector warning, import result, first-run hint) */
.st-notice-host{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;
  display:flex;flex-direction:column;gap:8px;align-items:center;max-width:calc(100vw - 24px);
  pointer-events:none}
.st-notice{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;max-width:440px;
  font:500 13px ui-sans-serif,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);
  animation:st-pop .14s ease-out;pointer-events:auto}
.st-notice[data-st-theme="light"]{background:#fff;border:1px solid #e5e5e5;color:#0d0d0d}
.st-notice[data-st-theme="dark"]{background:#2a2a2a;border:1px solid #3a3a3a;color:#ececec}
.st-notice-text{flex:1 1 auto;line-height:1.45}
.st-notice-action{flex:0 0 auto;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;color:#fff;
  font:600 12px ui-sans-serif,system-ui,sans-serif;background:#7c5cff}
.st-notice-close{flex:0 0 auto;border:none;background:none;color:inherit;opacity:.5;cursor:pointer;
  font-size:13px;line-height:1;padding:2px 4px;border-radius:6px}
.st-notice-close:hover{opacity:1;background:rgba(128,128,128,.12);background:color-mix(in srgb, currentColor 12%, transparent)}

/* inline svg icons: monochrome, inherit color, and let clicks fall through to the button */
.st-svg{display:block;pointer-events:none}

/* smooth, native-feeling hover and press feedback on our controls */
.st-icon,.st-mini,.st-send,.st-marker,.st-launcher,.st-list-item,.st-export,.st-tangent-btn,
.st-notice-action,.st-notice-close{transition:background .15s ease,opacity .15s ease,transform .1s ease}
.st-icon:active,.st-mini:active,.st-send:not(:disabled):active,.st-marker:active,.st-launcher:active,
.st-export:active,.st-tangent-btn:active,.st-notice-action:active{transform:scale(.94)}

/* visible keyboard focus on every interactive control */
.st-tangent-btn:focus-visible,.st-icon:focus-visible,.st-send:focus-visible,.st-mini:focus-visible,
.st-marker:focus-visible,.st-launcher:focus-visible,.st-list-item:focus-visible,.st-input:focus-visible,
.st-export:focus-visible,.st-notice-action:focus-visible,.st-notice-close:focus-visible{
  outline:2px solid #7c5cff;outline-offset:2px}
`;
