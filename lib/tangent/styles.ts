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
.st-card.st-min .st-card-close,.st-card.st-min .st-quote,.st-card.st-min .st-thread,
.st-card.st-min .st-composer{display:none}
.st-card.st-min .st-card-head{margin:0}

.st-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.st-card-label{font-size:12px;font-weight:600;opacity:.6}
.st-card-close{background:none;border:none;cursor:pointer;color:inherit;opacity:.5;font-size:13px}
.st-card-close:hover{opacity:1}
.st-quote{border-left:2px solid currentColor;opacity:.55;padding-left:10px;margin-bottom:12px;
  font-size:13px;line-height:1.5;max-height:96px;overflow:auto}
.st-thread{display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
.st-msg{line-height:1.6;white-space:pre-wrap;word-break:break-word}
.st-user{align-self:flex-end;max-width:85%;padding:8px 14px;border-radius:18px}
.st-card[data-st-theme="light"] .st-user{background:#ececec}
.st-card[data-st-theme="dark"] .st-user{background:#3a3a3a}
.st-assistant{align-self:stretch}
.st-thinking{opacity:.5}
.st-composer{display:flex;align-items:flex-end;gap:8px}
.st-input{flex:1;resize:none;border-radius:18px;padding:9px 13px;font:inherit;color:inherit;
  background:transparent;max-height:140px}
.st-card[data-st-theme="light"] .st-input{border:1px solid #d5d5d5}
.st-card[data-st-theme="dark"] .st-input{border:1px solid #4a4a4a}
.st-send{border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:15px;flex:0 0 auto}
.st-card[data-st-theme="light"] .st-send{background:#0d0d0d;color:#fff}
.st-card[data-st-theme="dark"] .st-send{background:#ececec;color:#1a1a1a}
.st-send:disabled{opacity:.4;cursor:default}
`;
