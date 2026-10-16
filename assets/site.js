/* Site behaviour shared by every view: the hamburger menu, the --hdr offset used by sticky headings, and collapsible sections. */
(function () {
  const store = {get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }};
  const nav = () => document.querySelector('.topnav');
  const setHdr = () => { const n = nav(); if (n) document.documentElement.style.setProperty('--hdr', n.offsetHeight + 'px'); };
  const setOpen = open => { const n = nav(); if (!n) return; n.classList.toggle('open', open); const b = n.querySelector('.burger'); b && b.setAttribute('aria-expanded', open); setHdr(); };
  function initNav() {
    const n = nav(); if (!n || n.dataset.ready) return; n.dataset.ready = 1;
    n.querySelector('.burger').addEventListener('click', () => setOpen(!n.classList.contains('open')));
    n.querySelector('.menu').addEventListener('click', e => { if (e.target.closest('button,a')) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', e => { if (n.classList.contains('open') && !e.target.closest('.topnav')) setOpen(false); });
    window.addEventListener('resize', setHdr); setHdr();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHdr);
  }
  window.setNavLabel = text => { const c = document.querySelector('.topnav .cur'); if (c) c.textContent = text; setHdr(); };

  // Turn each heading with class "sec" (or, on pages without those, each h2) and the content that follows it into a collapsible section. State is remembered per page and heading.
  const done = new WeakSet();
  window.collapsify = function (root, keyPrefix) {
    if (!root || done.has(root)) return; done.add(root);
    let heads = [...root.querySelectorAll(':scope > h3.sec, :scope > div > h3.sec')].filter(h => !h.closest('.cs'));
    if (!heads.length) heads = [...root.querySelectorAll(':scope > h2')];
    if (heads.length < 2) return;
    const level = heads[0].tagName, key = (keyPrefix || location.hash.split('/').slice(0, 2).join('/')) + '|';
    const sections = [];
    heads.forEach((h, i) => {
      const host = h.parentElement, sec = document.createElement('section'), hd = document.createElement('header'), body = document.createElement('div');
      sec.className = 'cs'; hd.className = 'cs-h'; body.className = 'cs-b';
      const next = heads[i + 1] && heads[i + 1].parentElement === host ? heads[i + 1] : null;
      host.insertBefore(sec, h);
      hd.appendChild(h); hd.insertAdjacentHTML('beforeend', '<span class="cs-chev" aria-hidden="true"></span>');
      sec.appendChild(hd); sec.appendChild(body);
      while (sec.nextSibling && sec.nextSibling !== next && !(sec.nextSibling.nodeType === 1 && sec.nextSibling.matches && sec.nextSibling.matches(level === 'H3' ? 'h3.sec' : 'h2'))) body.appendChild(sec.nextSibling);
      const id = key + h.textContent.trim().slice(0, 60);
      hd.tabIndex = 0; hd.setAttribute('role', 'button');
      const set = c => { sec.classList.toggle('collapsed', c); hd.setAttribute('aria-expanded', !c); };
      set(store.get('cs:' + id) === '1');
      const toggle = () => { const c = !sec.classList.contains('collapsed'); set(c); store.set('cs:' + id, c ? '1' : '0'); };
      hd.addEventListener('click', e => { if (e.target.closest('a')) return; toggle(); });
      hd.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      sections.push({sec, set, id});
    });
    if (sections.length > 2) {
      const bar = document.createElement('div'); bar.className = 'cs-tools';
      bar.innerHTML = '<button type="button" data-all="open">Expand all</button><button type="button" data-all="close">Collapse all</button>';
      bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const c = b.dataset.all === 'close'; sections.forEach(s => { s.set(c); store.set('cs:' + s.id, c ? '1' : '0'); }); });
      sections[0].sec.parentElement.insertBefore(bar, sections[0].sec);
    }
  };

  // ---- information pills: long explanatory and caveat boxes become a small "i" button that opens a pop-up on click and closes on a second click, Escape, a click elsewhere or navigation
  const KEEP = /^(No match|No table|No term|Nothing placed|Error|This page could not|The dashboard could not|Cannot load|Pick a topic|Jump to|Terms used|Data behind|All the tables|Used by claims|Type a|Great Britain|Database last built|Finished|By year)/;
  const keepNote = n => n.classList.contains('keep') || n.classList.contains('err') || !!n.querySelector('.chip,.chip2,button,input,select') || KEEP.test(n.textContent.trim()) || n.textContent.trim().length < 70;
  let pop = null, popFor = null;
  const closePop = () => { if (pop) pop.style.display = 'none'; if (popFor) popFor.setAttribute('aria-expanded', 'false'); popFor = null; };
  const place = () => {
    if (!pop || !popFor) return;
    const r = popFor.getBoundingClientRect(), narrow = innerWidth < 760;
    pop.style.maxHeight = narrow ? '46vh' : '58vh';
    if (narrow) { pop.style.left = '3vw'; pop.style.right = '3vw'; pop.style.width = 'auto'; pop.style.top = 'auto'; pop.style.bottom = '64px'; return; }
    pop.style.right = 'auto'; pop.style.bottom = 'auto'; pop.style.width = 'min(460px, 92vw)';
    const w = pop.offsetWidth, h = pop.offsetHeight, left = Math.max(10, Math.min(r.left, innerWidth - w - 10));
    let top = r.bottom + 8; if (top + h > innerHeight - 56) top = Math.max(10, r.top - h - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  };
  const openPop = (btn, html) => {
    if (!pop) { pop = document.createElement('div'); pop.className = 'popover'; pop.setAttribute('role', 'dialog'); document.body.appendChild(pop); pop.addEventListener('click', e => { if (e.target.closest('.pop-x')) closePop(); else if (e.target.closest('a')) closePop(); }); }
    if (popFor === btn) { closePop(); return; }
    closePop(); popFor = btn; btn.setAttribute('aria-expanded', 'true');
    pop.innerHTML = '<button type="button" class="pop-x" aria-label="Close">×</button>' + html; pop.style.display = 'block'; place();
  };
  const label = n => { const b = n.querySelector('b,strong'); let t = b ? b.textContent.trim().replace(/[.:]+$/, '') : ''; if (!t || t.length > 34) { const w = n.textContent.trim().split(/\s+/).slice(0, 4).join(' ').replace(/[.,;:]+$/, ''); t = w ? w + '…' : 'Note'; } return t; };
  function infoify(root) {
    (root || document).querySelectorAll('.note:not(.infoed), .d-note:not(.infoed)').forEach(n => {
      if (keepNote(n)) { n.classList.add('infoed', 'plainnote'); return; }
      n.classList.add('infoed'); n.hidden = true;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'info-btn'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-haspopup', 'dialog');
      btn.innerHTML = '<i aria-hidden="true">i</i><span></span>'; btn.lastChild.textContent = label(n); btn.title = 'Show or hide: ' + n.textContent.trim().slice(0, 90);
      btn.addEventListener('click', e => { e.stopPropagation(); openPop(btn, n.innerHTML); });
      const prev = n.previousElementSibling;
      if (prev && prev.classList.contains('info-row')) prev.appendChild(btn);
      else { const row = document.createElement('div'); row.className = 'info-row'; row.appendChild(btn); n.parentNode.insertBefore(row, n); }
    });
  }
  document.addEventListener('click', e => { if (pop && pop.style.display === 'block' && !e.target.closest('.popover,.info-btn')) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('resize', place); window.addEventListener('scroll', () => { if (innerWidth >= 760) place(); }, {passive: true});
  window.addEventListener('hashchange', () => { closePop(); hideTips(); });
  const hideTips = () => document.querySelectorAll('.dtip,#tip').forEach(t => { t.style.display = 'none'; });
  window.hideTips = hideTips; window.closePop = closePop; window.infoify = infoify;
  let raf = 0; const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => infoify(document)); });
  window.addEventListener('DOMContentLoaded', () => { mo.observe(document.body, {childList: true, subtree: true}); infoify(document); });
  window.addEventListener('pagehide', hideTips);
  window.addEventListener('DOMContentLoaded', initNav);
  window.siteStore = store;
})();
