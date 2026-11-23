// ===== Fill these in (Supabase > Project Settings > API) =====
const SUPABASE_URL = 'https://zjmgfrgeeopqxcxvtljm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_U9LZ7mNy4v5I8w_IWYaTcQ_p89aK_WF';
const ADMIN_EMAIL = 'medelcabillion@gmail.com'; // email of the admin user you create in Supabase Auth
// =============================================================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let exporting = false, members = [], view = 'home', q = '', sort = 'az', sel = null, form = null, confirmDel = false, mode = 'login', authed = false;

const age = b => { if (!b) return ''; const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
const fmt = d => d ? new Date(d + 'T00:00').toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) : '—';
const ini = n => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const av = (m, c = '') => `<div class="av ${c}">${m.photo ? `<img src="${m.photo}" alt="">` : esc(ini(m.name))}</div>`;
const nextId = () => 'FGC-' + String(Math.max(0, ...members.map(m => parseInt(m.id.split('-')[1]) || 0)) + 1).padStart(3, '0');

// ---------- data (Supabase) ----------
async function load() {
  const { data, error } = await sb.from('members').select('*');
  if (!error) { members = data; if (authed && !form) render(); }
}
sb.channel('members-live').on('postgres_changes', {event:'*', schema:'public', table:'members'}, load).subscribe();
const saveMember = m => sb.from('members').upsert(m);
const removeMember = id => sb.from('members').delete().eq('id', id);

function sorted() {
  const l = members.filter(m => m.name.toLowerCase().includes(q.toLowerCase()));
  const f = {az:(a,b)=>a.name.localeCompare(b.name), za:(a,b)=>b.name.localeCompare(a.name),
    old:(a,b)=>a.joined.localeCompare(b.joined), young:(a,b)=>b.birthday.localeCompare(a.birthday)}[sort];
  return l.sort(f);
}
const card = m => `<div class="card m" data-id="${m.id}">${av(m)}<div><h3>${esc(m.name)}</h3><small>${esc(m.id)} · ${age(m.birthday)} yrs</small></div><span class="tag ${m.status}">${m.status}</span></div>`;
const listHtml = () => sorted().map(card).join('') || '<p class="c" style="color:var(--mut)">No members found.</p>';

// ---------- auth screens ----------
function renderAuth() {
  $('#nav').classList.add('hide'); $('#sub').textContent = 'Administrator access only';
  const err = '<p id="msg" style="color:#e11d48;font-size:13px;min-height:18px"></p>';
  if (mode === 'login') $('#app').innerHTML = `<div class="card" style="margin-top:24px"><h2 class="c">🔐 Admin Login</h2>
    <label>Username</label><input id="lu" autocomplete="username"><label>Password</label><input id="lp" type="password" autocomplete="current-password">${err}
    <button class="btn" id="login" style="width:100%">Log in</button><button class="btn ghost" id="fgt" style="width:100%;margin-top:8px">Forgot password?</button></div>`;
  if (mode === 'forgot') $('#app').innerHTML = `<div class="card" style="margin-top:24px"><h2 class="c">Forgot password</h2>
    <p style="font-size:14px;color:var(--mut)">We will email a reset link to the admin email address.</p>${err}
    <button class="btn" id="sendreset" style="width:100%">Send reset link</button><button class="btn ghost" id="back" style="width:100%;margin-top:8px">Back to login</button></div>`;
  if (mode === 'recovery') $('#app').innerHTML = `<div class="card" style="margin-top:24px"><h2 class="c">Set a new password</h2>
    <label>New password (min 6)</label><input id="np" type="password">${err}<button class="btn" id="setnew" style="width:100%">Save password</button></div>`;
}
let msgTimer;
const msg = (t, ok) => {
  const m = $('#msg') || $('#cpm'); if (!m) return;
  clearTimeout(msgTimer);
  m.style.transition = 'none'; m.style.opacity = 1;
  m.style.color = ok ? 'var(--deep)' : '#e11d48'; m.textContent = t;
  msgTimer = setTimeout(() => { m.style.transition = 'opacity 1.2s ease'; m.style.opacity = 0; }, 3500); // stays 3.5s, then fades slowly
};;

// ---------- main render ----------
function render() {
  if (!authed) return renderAuth();
  $('#sub').textContent = `Welcome, Admin · ${members.length} members · ☁️ synced`;
  $('#nav').classList.remove('hide');
  $('#nav').innerHTML = [['home','🏠','Home'],['members','👥','Members'],['profile','👤','Profile'],['settings','⚙️','Settings']]
    .map(([k,i,l]) => `<button data-v="${k}" class="${view===k?'on':''}"><span>${i}</span>${l}</button>`).join('');
  let h = '';
  if (view === 'home') {
    const a = members.filter(m => m.status === 'Active').length;
    const avg = members.length ? Math.round(members.reduce((s, m) => s + age(m.birthday), 0) / members.length) : 0;
    h = `<div class="stats"><div class="card stat"><b>${members.length}</b><span>Total members</span></div><div class="card stat"><b>${a}</b><span>Active</span></div>
      <div class="card stat"><b>${members.length - a}</b><span>Inactive / visitors</span></div><div class="card stat"><b>${avg}</b><span>Average age</span></div></div>
      <h2>Newest members</h2>${[...members].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 3).map(card).join('')}`;
  }
  if (view === 'members') h = `<input id="q" placeholder="🔍 Search members by name" value="${esc(q)}"><label>Sort by</label>
    <select id="sort"><option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="old">Oldest to newest (date joined)</option><option value="young">Youngest to oldest (age)</option></select>
    <div style="height:12px"></div><div id="list">${listHtml()}</div><button class="btn fab" id="add" aria-label="Add member">+</button>`;
  if (view === 'profile') h = `<div class="card c"><div class="av lg">AD</div><h2>Admin</h2><small style="color:var(--mut)">${esc(ADMIN_EMAIL)}</small></div><button class="btn del" id="logout" style="width:100%">Log out</button>`;
  if (view === 'settings') h = `<div class="card"><h2>Change password</h2><label>Current password</label><input id="cp0" type="password">
    <label>New password (min 6)</label><input id="cp1" type="password"><label>Confirm new password</label><input id="cp2" type="password">
    <p id="cpm" style="font-size:13px;min-height:18px"></p><button class="btn" id="chg" style="width:100%">Update password</button></div>
    <div class="card"><button class="btn" id="word" style="width:100%">Export all members to Word (print)</button><div style="height:8px"></div><button class="btn alt" id="exp" style="width:100%">Download members (JSON)</button></div>`;
  $('#app').innerHTML = h;
  if (view === 'members') $('#sort').value = sort;
  renderSheet();
}

function renderSheet() {
  $('#sheet')?.remove(); let c = '';
  if (form) { const m = form;
    c = `<h2>${m.isNew ? 'Add member' : 'Edit member'}</h2><div class="c"><div id="ph">${av(m, 'lg')}</div><input type="file" id="photo" accept="image/*"></div>
    <label>Full name</label><input id="f_name" value="${esc(m.name)}">
    <div class="row"><div><label>Birthday</label><input type="date" id="f_birthday" value="${m.birthday}"></div><div><label>Gender</label><select id="f_gender"><option>Female</option><option>Male</option></select></div></div>
    <label>Contact number</label><input id="f_phone" type="tel" value="${esc(m.phone)}"><label>Address</label><input id="f_address" value="${esc(m.address)}">
    <div class="row"><div><label>Date joined</label><input type="date" id="f_joined" value="${m.joined}"></div><div><label>Status</label><select id="f_status"><option>Active</option><option>Inactive</option><option>Visitor</option></select></div></div>
    <p id="err" style="color:#e11d48;font-size:13px"></p><div class="row"><button class="btn ghost" id="cancel">Cancel</button><button class="btn" id="saveb">Save</button></div>`;
  } else if (sel) { const m = members.find(x => x.id === sel); if (!m) { sel = null; return; }
    c = `<div class="c">${av(m, 'lg')}<h2 style="margin:0">${esc(m.name)}</h2><span class="tag ${m.status}" style="margin:6px 0 10px;display:inline-block">${m.status}</span></div>
    ${[['Member ID', m.id], ['Birthday', fmt(m.birthday) + ' (' + age(m.birthday) + ' yrs)'], ['Gender', m.gender], ['Contact', m.phone || '—'], ['Address', m.address || '—'], ['Date joined', fmt(m.joined)]]
      .map(r => `<div class="kv"><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join('')}
    <div class="row" style="margin-top:14px"><button class="btn ghost" id="close">Close</button><button class="btn alt" id="edit">Edit</button><button class="btn del" id="del">${confirmDel ? 'Tap to confirm' : 'Remove'}</button></div>`; }
  if (!c) return;
  const d = document.createElement('div'); d.className = 'sheet'; d.id = 'sheet'; d.innerHTML = '<div>' + c + '</div>'; document.body.appendChild(d);
  if (form) { $('#f_gender').value = form.gender; $('#f_status').value = form.status; }
}

// ---------- export to Word ----------
function exportWord() {
  const list = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const td = v => `<td style="border:1px solid #999;padding:4px">${esc(v)}</td>`;
  const rows = list.map(m => `<tr>${[m.id, m.name, fmt(m.birthday), age(m.birthday), m.gender, m.phone, m.address, fmt(m.joined), m.status].map(td).join('')}</tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>FGC Members</title>
<style>@page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:1.5cm}div.Section1{page:Section1}
body{font-family:Calibri,Arial,sans-serif}h1{color:#087E9B}table{border-collapse:collapse;width:100%;font-size:10pt}th{background:#14B8A6;color:#fff;border:1px solid #999;padding:5px;text-align:left}</style></head>
<body><div class="Section1"><h1>FGC Membership List</h1><p>Printed ${new Date().toLocaleDateString()} · Total members: ${list.length}</p>
<table><thead><tr><th>ID</th><th>Name</th><th>Birthday</th><th>Age</th><th>Gender</th><th>Contact</th><th>Address</th><th>Date joined</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
  const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'FGC-Members.doc';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- smooth page switch ----------
let goTimer;
function go(v) {
  if (v === view && !sel && !form) return;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const app = $('#app'); clearTimeout(goTimer);
  app.classList.remove('enter'); app.classList.add('leave');
  goTimer = setTimeout(() => {
    view = v; sel = form = null; render(); scrollTo(0, 0);
    app.classList.remove('leave'); app.classList.add('enter');
    goTimer = setTimeout(() => app.classList.remove('enter'), 400);
  }, 160);
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const t = e.target, id = t.id;
  const nv = t.closest('[data-v]'); if (nv) { view = nv.dataset.v; sel = form = null; render(); scrollTo(0, 0); return; }
  const cd = t.closest('.m[data-id]'); if (cd) { sel = cd.dataset.id; confirmDel = false; renderSheet(); return; }
  if (id === 'sheet' || id === 'close') { sel = form = null; confirmDel = false; renderSheet(); }
  if (id === 'login') {
    if ($('#lu').value.trim() !== 'Admin') return msg('Incorrect username or password.');
    const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: $('#lp').value });
    if (error) msg(error.message === 'Invalid login credentials' ? 'Incorrect username or password.' : error.message);
  }
  if (id === 'fgt') { mode = 'forgot'; render(); }
  if (id === 'back') { mode = 'login'; render(); }
  if (id === 'sendreset') { const { error } = await sb.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: location.href.split('#')[0] }); msg(error ? error.message : 'Reset link sent. Check the admin email.', !error); }
  if (id === 'setnew') { const p = $('#np').value; if (p.length < 6) return msg('Password must be at least 6 characters.');
    const { error } = await sb.auth.updateUser({ password: p }); if (error) return msg(error.message); mode = 'login'; authed = true; await load(); render(); }
  if (id === 'logout') { authed = false; mode = 'login'; members = []; view = 'home'; history.replaceState(null, '', location.pathname); render(); sb.auth.signOut(); }
  if (id === 'chg') { const n = $('#cp1').value;
    if (n.length < 6) return msg('New password must be at least 6 characters.');
    if (n !== $('#cp2').value) return msg('New passwords do not match.');
    const ok = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: $('#cp0').value });
    if (ok.error) return msg('Current password is incorrect.');
    const { error } = await sb.auth.updateUser({ password: n });
    if (error) return msg(error.message);
    ['cp0', 'cp1', 'cp2'].forEach(i => $('#' + i).value = ''); msg('Password updated.', true); }
  if (id === 'add') form = { isNew: true, id: nextId(), name: '', birthday: '', gender: 'Female', phone: '', address: '', joined: new Date().toISOString().slice(0, 10), status: 'Active', photo: '' }, renderSheet();
  if (id === 'edit') { form = { ...members.find(x => x.id === sel) }; sel = null; renderSheet(); }
  if (id === 'cancel') { form = null; renderSheet(); }
  if (id === 'del') { if (!confirmDel) { confirmDel = true; t.textContent = 'Tap to confirm'; return; } await removeMember(sel); sel = null; confirmDel = false; await load(); render(); }
  if (id === 'saveb') { const g = i => $('#f_' + i).value.trim(), er = $('#err');
    if (!g('name')) return er.textContent = 'Please enter a name.'; if (!g('birthday')) return er.textContent = 'Please enter a birthday.';
    const m = { ...form, name: g('name'), birthday: g('birthday'), gender: g('gender'), phone: g('phone'), address: g('address'), joined: g('joined'), status: g('status') }; delete m.isNew;
    const { error } = await saveMember(m); if (error) return er.textContent = error.message; form = null; await load(); render(); }
  if (id === 'word' && !exporting) { exporting = true; exportWord(); setTimeout(() => exporting = false, 1500); }
  if (id === 'exp') { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(members, null, 2)); a.download = 'fgc-members.json'; a.click(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#login')) $('#login').click(); });
document.addEventListener('input', e => { if (e.target.id === 'q') { q = e.target.value; $('#list').innerHTML = listHtml(); } });
document.addEventListener('change', e => { const t = e.target;
  if (t.id === 'sort') { sort = t.value; $('#list').innerHTML = listHtml(); }
  if (t.id === 'photo' && t.files[0]) { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'), s = Math.min(1, 160 / Math.max(im.width, im.height)); c.width = im.width * s; c.height = im.height * s;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); form.photo = c.toDataURL('image/jpeg', .8); $('#ph').innerHTML = av(form, 'lg'); }; im.src = r.result; }; r.readAsDataURL(t.files[0]); } });

// ---------- start ----------
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { authed = false; mode = 'recovery'; render(); return; }
  const was = authed;
  authed = !!session && mode !== 'recovery';
  if (authed) { if (!was) view = 'home'; setTimeout(load, 0); }
  else { members = []; if (event === 'SIGNED_OUT') mode = 'login'; }
  render();
});
render();