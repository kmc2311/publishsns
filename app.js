// X-like SNS (mobile) - front only MVP
// Data is stored in localStorage: user + posts + dms + publish selection

const LS_USER = "xls_user_v1";
const LS_POSTS = "xls_posts_v1";
const LS_DMS  = "xls_dms_v1";
const LS_PUBLISH = "xls_publish_selection_v1";

const AVATARS = ["🟢","🟣","🔵","🟡","🟠","🔴","🐻","🐼","🦊","🐯","🐸","🐧","🦄","🐱","🐶","🐰","🐹","🦖"];

// DM相手（サンプル）
const DM_CONTACTS = [
  { id:"u_aki",   name:"あき",   avatar:"🐱" },
  { id:"u_mina",  name:"みな",   avatar:"🐼" },
  { id:"u_ren",   name:"れん",   avatar:"🦊" },
  { id:"u_sora",  name:"そら",   avatar:"🐧" },
  { id:"u_haru",  name:"はる",   avatar:"🟣" },
  { id:"u_kai",   name:"かい",   avatar:"🔵" },
];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  view: "timeline",
  user: null,
  posts: [],
  composing: { thumbUrl: "", thumbText: "", blocks: [] },

  // DM
  dms: {
    threads: [], // [{id, peer:{id,name,avatar}, messages:[{id,from:'me'|'them', text, image, createdAt}], unread:number}]
    activeThreadId: null,
  },

  // Publish
  publish: {
    selectedIds: []
  }
};

// ---------- utils ----------
function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function nowISO(){ return new Date().toISOString(); }
function fmtTime(iso){
  try{
    const d = new Date(iso);
    const mm = (d.getMonth()+1).toString().padStart(2,"0");
    const dd = d.getDate().toString().padStart(2,"0");
    const hh = d.getHours().toString().padStart(2,"0");
    const mi = d.getMinutes().toString().padStart(2,"0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }catch{ return ""; }
}

function saveUser(user){ localStorage.setItem(LS_USER, JSON.stringify(user)); }
function loadUser(){
  const raw = localStorage.getItem(LS_USER);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
}

function savePosts(posts){ localStorage.setItem(LS_POSTS, JSON.stringify(posts)); }
function loadPosts(){
  const raw = localStorage.getItem(LS_POSTS);
  if(!raw) return [];
  try{ return JSON.parse(raw); }catch{ return []; }
}

function saveDMs(dms){ localStorage.setItem(LS_DMS, JSON.stringify(dms)); }
function loadDMs(){
  const raw = localStorage.getItem(LS_DMS);
  if(!raw) return { threads:[], activeThreadId:null };
  try{
    const v = JSON.parse(raw);
    return {
      threads: Array.isArray(v.threads) ? v.threads : [],
      activeThreadId: v.activeThreadId || null
    };
  }catch{
    return { threads:[], activeThreadId:null };
  }
}

function savePublishSelection(ids){
  localStorage.setItem(LS_PUBLISH, JSON.stringify(ids || []));
}
function loadPublishSelection(){
  const raw = localStorage.getItem(LS_PUBLISH);
  if(!raw) return [];
  try{
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  }catch{
    return [];
  }
}

function escapeHTML(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function escapeAttr(s){ return escapeHTML(s).replace(/"/g, "&quot;"); }

function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ---------- routing / view ----------
function setTopbarTitle(){
  const map = {
    timeline:"タイムライン",
    search:"検索",
    dm:"DM",
    profile:"プロフィール",
    compose:"投稿",
    detail:"投稿",
    publish:"出版ページ"
  };
  $("#topbarTitle").textContent = map[state.view] || "X-like";
}

function go(view){
  state.view = view;
  setTopbarTitle();

  $$(".view").forEach(v => v.classList.add("hidden"));
  const el = document.querySelector(`[data-view="${view}"]`);
  if(el) el.classList.remove("hidden");
  function resetScroll(){
  // 一番効く組み合わせ（モバイルSafari対策込み）
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const main = document.querySelector(".main");
  if(main) main.scrollTop = 0;
}

function go(view){
  state.view = view;
  setTopbarTitle();

  $$(".view").forEach(v => v.classList.add("hidden"));
  const el = document.querySelector(`[data-view="${view}"]`);
  if(el) el.classList.remove("hidden");

  $$(".navBtn").forEach(b => b.classList.toggle("is-active", b.dataset.go === view));

  // ✅ ここを追加：画面切替時に必ず先頭へ
  resetScroll();

  if(view === "timeline") renderFeed();
  if(view === "search") renderSearch();
  if(view === "profile") renderProfile();
  if(view === "compose") renderCompose();
  if(view === "dm") renderDM();
  if(view === "publish") renderPublish();
}


    // 画面切り替え時は必ず先頭に戻す（iOS/モバイル対策も含む）
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  const main = document.querySelector(".main");
  if(main) main.scrollTop = 0;


  $$(".navBtn").forEach(b => b.classList.toggle("is-active", b.dataset.go === view));

  if(view === "timeline") renderFeed();
  if(view === "search") renderSearch();
  if(view === "profile") renderProfile();
  if(view === "compose") renderCompose();
  if(view === "dm") renderDM();
  if(view === "publish") renderPublish();
}

function openDetail(postId){
  const p = state.posts.find(x => x.id === postId);
  if(!p) return;
  const wrap = $("#postDetail");
  wrap.innerHTML = "";

  const head = document.createElement("div");
  head.className = "cardHead";
  head.innerHTML = `
    <div class="avatar">${escapeHTML(state.user.avatar)}</div>
    <div class="nameLine">
      <div class="name">${escapeHTML(state.user.name)}</div>
      <div class="time">${fmtTime(p.createdAt)}</div>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "cardBody render";
  body.innerHTML = `
    ${p.thumb?.url ? `<img class="thumb" src="${escapeAttr(p.thumb.url)}" alt="thumb">` : ""}
    ${p.thumb?.text ? `<div class="postDetailTitle">${escapeHTML(p.thumb.text)}</div>` : ""}
    ${renderBlocksHTML(p.blocks || [])}
  `;

  wrap.appendChild(head);
  wrap.appendChild(body);
  go("detail");
}

// ---------- Timeline / Search / Profile ----------
function renderFeed(){
  const feed = $("#feed");
  feed.innerHTML = "";

  if(state.posts.length === 0){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.innerHTML = "まだ投稿がありません。右下の＋から投稿してみてください。";
    feed.appendChild(empty);
    return;
  }

  state.posts
    .slice()
    .sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""))
    .forEach(p => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="cardHead">
          <div class="avatar">${escapeHTML(state.user.avatar)}</div>
          <div class="nameLine">
            <div class="name">${escapeHTML(state.user.name)}</div>
            <div class="time">${fmtTime(p.createdAt)}</div>
          </div>
        </div>
        ${p.thumb?.url ? `<img class="thumb" src="${escapeAttr(p.thumb.url)}" alt="thumb">` : ""}
        <div class="cardBody">
          <div class="thumbText">${escapeHTML(p.thumb?.text || "")}</div>
        </div>
      `;
      card.addEventListener("click", ()=> openDetail(p.id));
      feed.appendChild(card);
    });
}

function renderSearch(){
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  const out = $("#searchResults");
  out.innerHTML = "";

  if(!q){
    out.innerHTML = `<div class="muted">キーワードを入力すると結果が表示されます。</div>`;
    return;
  }

  const hits = state.posts.filter(p => {
    const t = (p.thumb?.text || "").toLowerCase();
    const b = JSON.stringify(p.blocks || []).toLowerCase();
    return t.includes(q) || b.includes(q);
  });

  if(hits.length === 0){
    out.innerHTML = `<div class="muted">見つかりませんでした。</div>`;
    return;
  }

  hits.forEach(p => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="cardHead">
        <div class="avatar">${escapeHTML(state.user.avatar)}</div>
        <div class="nameLine">
          <div class="name">${escapeHTML(state.user.name)}</div>
          <div class="time">${fmtTime(p.createdAt)}</div>
        </div>
      </div>
      ${p.thumb?.url ? `<img class="thumb" src="${escapeAttr(p.thumb.url)}" alt="thumb">` : ""}
      <div class="cardBody">
        <div class="thumbText">${escapeHTML(p.thumb?.text || "")}</div>
      </div>
    `;
    card.addEventListener("click", ()=> openDetail(p.id));
    out.appendChild(card);
  });
}

function renderProfile(){
  $("#meName").textContent = state.user?.name || "";
  $("#meAvatarMini").textContent = state.user?.avatar || "🙂";
  $("#meAvatarBig").textContent = state.user?.avatar || "🙂";

  const mine = $("#myPosts");
  mine.innerHTML = "";

  const my = state.posts
    .slice()
    .sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""))
    .filter(p => p.authorId === state.user.id);

  if(my.length === 0){
    mine.innerHTML = `<div class="muted">自分の投稿はまだありません。</div>`;
    return;
  }

  my.forEach(p => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="cardHead">
        <div class="avatar">${escapeHTML(state.user.avatar)}</div>
        <div class="nameLine">
          <div class="name">${escapeHTML(state.user.name)}</div>
          <div class="time">${fmtTime(p.createdAt)}</div>
        </div>
      </div>
      ${p.thumb?.url ? `<img class="thumb" src="${escapeAttr(p.thumb.url)}" alt="thumb">` : ""}
      <div class="cardBody">
        <div class="thumbText">${escapeHTML(p.thumb?.text || "")}</div>
      </div>
    `;
    card.addEventListener("click", ()=> openDetail(p.id));
    mine.appendChild(card);
  });
}

// ---------- Publish ----------
function renderPublish(){
  const list = $("#publishList");
  const btnGo = $("#btnGoEditor");
  if(!list || !btnGo) return;

  if(!state.posts || state.posts.length === 0){
    list.innerHTML = `<div class="muted">投稿がまだありません。</div>`;
    btnGo.disabled = true;
    return;
  }

  const selected = new Set(state.publish.selectedIds || []);

  const posts = state.posts.slice().sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
  list.innerHTML = "";

  posts.forEach(p=>{
    const item = document.createElement("div");
    item.className = "pubItem";

    const checked = selected.has(p.id);
    const thumb = (p.thumb && p.thumb.url) ? p.thumb.url : "";
    const title = (p.thumb && p.thumb.text) ? p.thumb.text : "（サムネ文章なし）";
    const created = p.createdAt ? fmtTime(p.createdAt) : "";

    item.innerHTML = `
      <input class="pubCheck" type="checkbox" ${checked ? "checked" : ""} />
      <div class="pubMain">
        <div class="pubTitle">${escapeHTML(title)}</div>
        <div class="muted">この投稿を「本」に含める</div>
        <div class="pubMeta">${escapeHTML(created)}</div>
      </div>
      ${thumb ? `<img class="pubThumb" src="${escapeAttr(thumb)}" alt="thumb" />` : `<div class="pubThumb"></div>`}
    `;

    const cb = item.querySelector(".pubCheck");
    cb.addEventListener("change", ()=>{
      if(cb.checked) selected.add(p.id);
      else selected.delete(p.id);

      state.publish.selectedIds = [...selected];
      savePublishSelection(state.publish.selectedIds);
      btnGo.disabled = state.publish.selectedIds.length === 0;
    });

    list.appendChild(item);
  });

  btnGo.disabled = (state.publish.selectedIds || []).length === 0;
}

// ---------- DM core ----------
function getThread(threadId){
  return state.dms.threads.find(t => t.id === threadId) || null;
}
function getLastMessage(thread){
  const m = (thread.messages || [])
    .slice()
    .sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""))[0];
  return m || null;
}
function threadUnreadCount(thread){
  return Number(thread.unread || 0);
}
function markThreadRead(thread){
  thread.unread = 0;
  saveDMs(state.dms);
}

function renderDM(){
  $("#dmChat").classList.add("hidden");
  $("#dmThreads").classList.remove("hidden");
  renderDMThreads();
}

function renderDMThreads(){
  const wrap = $("#dmThreads");
  wrap.innerHTML = "";

  const threads = (state.dms.threads || []).slice().sort((a,b)=>{
    const al = getLastMessage(a)?.createdAt || "";
    const bl = getLastMessage(b)?.createdAt || "";
    return (bl).localeCompare(al);
  });

  if(threads.length === 0){
    wrap.innerHTML = `<div class="muted">まだDMがありません。「＋新規」から会話を開始できます。</div>`;
    return;
  }

  threads.forEach(t=>{
    const last = getLastMessage(t);
    const lastTextRaw =
      last
        ? (last.from === "me"
            ? `あなた: ${last.text || (last.image ? "画像" : "")}`
            : (last.text || (last.image ? "画像" : "")))
        : "（まだメッセージがありません）";

    const unread = threadUnreadCount(t);

    const row = document.createElement("div");
    row.className = "thread";

    row.innerHTML = `
      <div class="avatar">${escapeHTML(t.peer.avatar)}</div>
      <div class="threadMain">
        <div class="threadName">${escapeHTML(t.peer.name)}</div>
        <div class="threadLast">${escapeHTML(lastTextRaw)}</div>
      </div>
      <div class="threadActions">
        ${unread > 0 ? `<span class="badge unread">${unread}</span>` : ``}
        <div class="threadMeta">${last ? fmtTime(last.createdAt) : ""}</div>
        <button class="smallIconBtn" data-act="del">削除</button>
      </div>
    `;

    row.addEventListener("click", (e)=>{
      const delBtn = e.target.closest('button[data-act="del"]');
      if(delBtn){
        e.stopPropagation();
        const ok = confirm(`${t.peer.name} との会話を削除しますか？`);
        if(!ok) return;
        state.dms.threads = state.dms.threads.filter(x => x.id !== t.id);
        if(state.dms.activeThreadId === t.id) state.dms.activeThreadId = null;
        saveDMs(state.dms);
        renderDMThreads();
        return;
      }
      openDMChat(t.id);
    });

    wrap.appendChild(row);
  });
}

function openDMChat(threadId){
  state.dms.activeThreadId = threadId;
  saveDMs(state.dms);

  $("#dmThreads").classList.add("hidden");
  $("#dmChat").classList.remove("hidden");

  const t = getThread(threadId);
  if(!t) return;

  markThreadRead(t);

  $("#dmChatAvatar").textContent = t.peer.avatar;
  $("#dmChatName").textContent = t.peer.name;

  renderDMChat();
  setTimeout(()=> $("#dmInput")?.focus(), 0);
}

function closeDMChat(){
  state.dms.activeThreadId = null;
  saveDMs(state.dms);

  $("#dmChat").classList.add("hidden");
  $("#dmThreads").classList.remove("hidden");
  renderDMThreads();
}

function renderDMChat(){
  const t = getThread(state.dms.activeThreadId);
  if(!t) return;

  const box = $("#dmMessages");
  box.innerHTML = "";

  const msgs = (t.messages || []).slice().sort((a,b)=> (a.createdAt||"").localeCompare(b.createdAt||""));

  if(msgs.length === 0){
    box.innerHTML = `<div class="muted">最初のメッセージを送ってみよう。</div>`;
  }else{
    msgs.forEach(m=>{
      const row = document.createElement("div");
      row.className = `bubbleRow ${m.from === "me" ? "me" : "them"}`;

      const body = document.createElement("div");
      body.className = `bubble ${m.from === "me" ? "me" : "them"}`;

      const textPart = document.createElement("div");
      textPart.innerHTML = escapeHTML(m.text || "");
      body.appendChild(textPart);

      if(m.image){
        const img = document.createElement("img");
        img.className = "dmMsgImg";
        img.src = m.image;
        img.alt = "dm image";
        body.appendChild(img);
      }

      const meta = document.createElement("div");
      meta.className = "bubbleMeta";
      meta.textContent = fmtTime(m.createdAt);
      body.appendChild(meta);

      // メッセージ削除（クリックで）
      body.addEventListener("click", ()=>{
        const ok = confirm("このメッセージを削除しますか？");
        if(!ok) return;
        t.messages = (t.messages || []).filter(x => x.id !== m.id);
        saveDMs(state.dms);
        renderDMChat();
        renderDMThreads();
      });

      row.appendChild(body);
      box.appendChild(row);
    });
  }

  box.scrollTop = box.scrollHeight;
}

function sendDM({ text, image }){
  const t = getThread(state.dms.activeThreadId);
  if(!t) return;

  const msg = { id: uid(), from:"me", text: text || "", image: image || "", createdAt: nowISO() };
  t.messages = t.messages || [];
  t.messages.push(msg);
  saveDMs(state.dms);

  renderDMChat();
  renderDMThreads();

  // デモ：相手が返信 → 未読を増やす
  setTimeout(()=>{
    const reply = autoReply(text || "", t.peer.name);
    t.messages.push({ id: uid(), from:"them", text: reply, image:"", createdAt: nowISO() });

    // 一覧で「本物っぽく」見せるための未読カウント（開いてたらすぐ0に戻す）
    t.unread = Number(t.unread || 0) + 1;
    saveDMs(state.dms);

    if(state.dms.activeThreadId === t.id){
      markThreadRead(t);
      renderDMChat();
    }
    renderDMThreads();
  }, 450);
}

function autoReply(text, peerName){
  const t = text.trim();
  if(t.includes("こんにちは") || t.includes("はじめまして")) return `こんにちは！${peerName}です。どうした？`;
  if(t.endsWith("?") || t.includes("？")) return `うん、いいと思う！もう少し教えて〜`;
  const samples = ["了解！","いいね、それ！","わかる。","なるほどね。","それでどうなった？"];
  return samples[Math.floor(Math.random()*samples.length)];
}

// New DM modal
function openNewDMModal(){
  $("#dmNewModal").classList.remove("hidden");
  $("#dmUserSearch").value = "";
  renderDMUserList();
  setTimeout(()=> $("#dmUserSearch")?.focus(), 0);
}
function closeNewDMModal(){
  $("#dmNewModal").classList.add("hidden");
}
function renderDMUserList(){
  const q = ($("#dmUserSearch").value || "").trim().toLowerCase();
  const list = $("#dmUserList");
  list.innerHTML = "";

  const filtered = DM_CONTACTS.filter(u => !q || u.name.toLowerCase().includes(q));

  if(filtered.length === 0){
    list.innerHTML = `<div class="muted">該当なし</div>`;
    return;
  }

  filtered.forEach(u=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "userPick";

    const exists = state.dms.threads.some(t => t.peer.id === u.id);

    btn.innerHTML = `
      <div class="avatar">${escapeHTML(u.avatar)}</div>
      <div style="flex:1;">
        <div class="userPickName">${escapeHTML(u.name)}</div>
        <div class="muted" style="font-size:12px; margin-top:4px;">
          ${exists ? "既存の会話を開きます" : "新しい会話を作成します"}
        </div>
      </div>
      <div class="threadMeta">→</div>
    `;

    btn.addEventListener("click", ()=>{
      let thread = state.dms.threads.find(t=> t.peer.id === u.id);
      if(!thread){
        thread = { id: uid(), peer: u, messages: [], unread: 0 };
        state.dms.threads.push(thread);
        saveDMs(state.dms);
      }
      closeNewDMModal();
      openDMChat(thread.id);
    });

    list.appendChild(btn);
  });
}

// ---------- Compose editor (posts) ----------
function newBlock(type){
  const id = uid();
  if(type === "heading") return { id, type, text: "" };
  if(type === "paragraph") return { id, type, text: "" };
  if(type === "link") return { id, type, label: "", url: "" };
  if(type === "image") return { id, type, url: "" };
  if(type === "toggle") return { id, type, title: "", open: true, children: [] };
  return { id, type:"paragraph", text:"" };
}

function renderCompose(){
  $("#thumbUrl").value = state.composing.thumbUrl || "";
  $("#thumbText").value = state.composing.thumbText || "";

  const img = $("#thumbPreview");
  if(state.composing.thumbUrl){
    img.src = state.composing.thumbUrl;
    img.classList.remove("hidden");
  }else{
    img.classList.add("hidden");
  }

  renderBlocks();
}

function renderBlocks(){
  const wrap = $("#blocks");
  wrap.innerHTML = "";
  if(state.composing.blocks.length === 0){
    const muted = document.createElement("div");
    muted.className = "muted";
    muted.textContent = "上のボタンからブロックを追加してください（見出し/本文/トグル/リンク/画像）";
    wrap.appendChild(muted);
    return;
  }
  state.composing.blocks.forEach((b, idx) => {
    wrap.appendChild(blockEditor(b, idx, state.composing.blocks));
  });
}

function blockEditor(block, idx, parentArray){
  const el = document.createElement("div");
  el.className = "block";

  const top = document.createElement("div");
  top.className = "blockTop";
  top.innerHTML = `
    <div class="blockType">${block.type}</div>
    <div class="blockActions">
      <button class="smallBtn" data-act="up">↑</button>
      <button class="smallBtn" data-act="down">↓</button>
      <button class="smallBtn" data-act="del">削除</button>
    </div>
  `;
  top.addEventListener("click", (e)=>{
    const btn = e.target.closest("button");
    if(!btn) return;
    const act = btn.dataset.act;
    if(act === "del"){
      parentArray.splice(idx,1);
      renderBlocks();
    }
    if(act === "up" && idx > 0){
      const t = parentArray[idx-1]; parentArray[idx-1] = parentArray[idx]; parentArray[idx] = t;
      renderBlocks();
    }
    if(act === "down" && idx < parentArray.length-1){
      const t = parentArray[idx+1]; parentArray[idx+1] = parentArray[idx]; parentArray[idx] = t;
      renderBlocks();
    }
  });

  el.appendChild(top);

  if(block.type === "heading" || block.type === "paragraph"){
    const ta = document.createElement("textarea");
    ta.rows = block.type === "heading" ? 2 : 5;
    ta.placeholder = block.type === "heading" ? "見出しテキスト" : "本文テキスト";
    ta.value = block.text || "";
    ta.addEventListener("input", ()=> block.text = ta.value);
    el.appendChild(ta);
  }

  if(block.type === "link"){
    const label = document.createElement("input");
    label.placeholder = "リンクの表示名";
    label.value = block.label || "";
    label.addEventListener("input", ()=> block.label = label.value);

    const url = document.createElement("input");
    url.placeholder = "https://...";
    url.value = block.url || "";
    url.addEventListener("input", ()=> block.url = url.value);

    el.appendChild(label);
    el.appendChild(spacer(8));
    el.appendChild(url);
  }

  if(block.type === "image"){
    const url = document.createElement("input");
    url.placeholder = "画像URL（https://...）";
    url.value = block.url || "";
    url.addEventListener("input", ()=>{
      block.url = url.value;
      preview.src = block.url;
      preview.style.display = block.url ? "block" : "none";
    });

    const preview = document.createElement("img");
    preview.className = "thumbPreview";
    preview.alt = "image block preview";
    preview.style.marginTop = "10px";
    preview.src = block.url || "";
    if(!block.url) preview.style.display = "none";

    el.appendChild(url);
    el.appendChild(preview);
  }

  if(block.type === "toggle"){
    const row = document.createElement("div");
    row.className = "toggleHeaderRow";

    const btn = document.createElement("button");
    btn.className = "toggleBtn";
    btn.type = "button";
    btn.textContent = block.open ? "−" : "+";
    btn.addEventListener("click", ()=>{
      block.open = !block.open;
      renderBlocks();
    });

    const title = document.createElement("input");
    title.placeholder = "トグルのタイトル";
    title.value = block.title || "";
    title.addEventListener("input", ()=> block.title = title.value);

    row.appendChild(btn);
    row.appendChild(title);
    el.appendChild(row);

    const body = document.createElement("div");
    body.className = "toggleBody";
    body.style.display = block.open ? "block" : "none";

    const childTools = document.createElement("div");
    childTools.style.display = "flex";
    childTools.style.gap = "8px";
    childTools.style.flexWrap = "wrap";
    childTools.style.margin = "8px 0";

    ["heading","paragraph","link","image"].forEach(t=>{
      const bbtn = document.createElement("button");
      bbtn.type = "button";
      bbtn.className = "smallBtn";
      bbtn.textContent = `＋${t}`;
      bbtn.addEventListener("click", ()=>{
        block.children = block.children || [];
        block.children.push(newBlock(t));
        renderBlocks();
      });
      childTools.appendChild(bbtn);
    });

    body.appendChild(childTools);

    const childWrap = document.createElement("div");
    childWrap.style.display = "flex";
    childWrap.style.flexDirection = "column";
    childWrap.style.gap = "10px";

    (block.children || []).forEach((child, cidx)=>{
      childWrap.appendChild(blockEditor(child, cidx, block.children));
    });

    body.appendChild(childWrap);
    el.appendChild(body);
  }

  return el;
}

function spacer(h){
  const d = document.createElement("div");
  d.style.height = `${h}px`;
  return d;
}

function renderBlocksHTML(blocks){
  let html = "";
  for(const b of blocks){
    if(b.type === "heading"){
      html += `<h1>${escapeHTML(b.text || "")}</h1>`;
    }else if(b.type === "paragraph"){
      const safe = escapeHTML(b.text || "").replace(/\n/g,"<br/>");
      html += `<p>${safe}</p>`;
    }else if(b.type === "link"){
      const label = escapeHTML(b.label || b.url || "link");
      const url = escapeAttr(b.url || "#");
      html += `<p><a href="${url}" target="_blank" rel="noreferrer">${label}</a></p>`;
    }else if(b.type === "image"){
      if(b.url) html += `<img src="${escapeAttr(b.url)}" alt="image"/>`;
    }else if(b.type === "toggle"){
      const title = escapeHTML(b.title || "Toggle");
      const inner = renderBlocksHTML(b.children || []);
      html += `
        <div class="block" style="margin:10px 0;">
          <div style="font-weight:900;">▶ ${title}</div>
          <div style="margin-top:8px; opacity:.96;">${inner}</div>
        </div>
      `;
    }
  }
  return html;
}

// ---------- onboarding / profile edit ----------
function showOnboarding(){
  $("#onboarding").classList.remove("hidden");
  $("#onbName").value = "";
  renderAvatarGrid("#avatarGrid", null, (a)=> { state._onbAvatar = a; });
  state._onbAvatar = AVATARS[0];
}

function renderAvatarGrid(targetSel, selected, onPick){
  const grid = $(targetSel);
  grid.innerHTML = "";
  AVATARS.forEach(a=>{
    const b = document.createElement("button");
    b.className = "avatarPick" + (a===selected ? " is-selected" : "");
    b.type = "button";
    b.textContent = a;
    b.addEventListener("click", ()=>{
      grid.querySelectorAll(".avatarPick").forEach(x=> x.classList.remove("is-selected"));
      b.classList.add("is-selected");
      onPick(a);
    });
    grid.appendChild(b);
  });
  const first = grid.querySelector(".avatarPick");
  if(first) first.classList.add("is-selected");
}

function openProfileEdit(){
  $("#profileEdit").classList.remove("hidden");
  $("#editName").value = state.user.name;
  renderAvatarGrid("#avatarGridEdit", state.user.avatar, (a)=> { state._editAvatar = a; });
  state._editAvatar = state.user.avatar;
}

function closeProfileEdit(){
  $("#profileEdit").classList.add("hidden");
}

// ---------- events ----------
function wire(){
  // bottom nav
  $$(".navBtn").forEach(b=>{
    b.addEventListener("click", ()=> go(b.dataset.go));
  });

  // profile icon
  $("#btnProfile").addEventListener("click", ()=> go("profile"));

  // right-top "•••" -> publish
  const btnMore = $("#btnMore");
  if(btnMore){
    btnMore.addEventListener("click", ()=> go("publish"));
  }

  // fab (compose)
  $("#fabCompose").addEventListener("click", ()=>{
    state.composing = { thumbUrl:"", thumbText:"", blocks:[] };
    $("#thumbPreview").classList.add("hidden");
    go("compose");
    resetScroll();

    // 保険：composeを開いた瞬間にもトップへ
    window.scrollTo(0, 0);
    const main = document.querySelector(".main");
    if(main) main.scrollTop = 0;
  });

  // compose toolbar
  $$(".tool").forEach(t=>{
    t.addEventListener("click", ()=>{
      const type = t.dataset.add;
      state.composing.blocks.push(newBlock(type));
      renderBlocks();
    });
  });

  $("#thumbUrl").addEventListener("input", ()=>{
    state.composing.thumbUrl = $("#thumbUrl").value.trim();
    const img = $("#thumbPreview");
    if(state.composing.thumbUrl){
      img.src = state.composing.thumbUrl;
      img.classList.remove("hidden");
    }else{
      img.classList.add("hidden");
    }
  });

  $("#thumbFile").addEventListener("change", async ()=>{
    const f = $("#thumbFile").files?.[0];
    if(!f) return;
    const dataUrl = await fileToDataURL(f);
    state.composing.thumbUrl = dataUrl;
    $("#thumbUrl").value = "";
    const img = $("#thumbPreview");
    img.src = dataUrl;
    img.classList.remove("hidden");
  });

  $("#thumbText").addEventListener("input", ()=>{
    state.composing.thumbText = $("#thumbText").value;
  });

  $("#btnCancelCompose").addEventListener("click", ()=> go("timeline"));

  $("#btnPublish").addEventListener("click", ()=>{
    const post = {
      id: uid(),
      authorId: state.user.id,
      createdAt: nowISO(),
      thumb: { url: state.composing.thumbUrl || "", text: state.composing.thumbText || "" },
      blocks: state.composing.blocks || []
    };
    state.posts.push(post);
    savePosts(state.posts);
    go("timeline");
  });

  $("#btnBackDetail").addEventListener("click", ()=> go("timeline"));

  $("#searchInput").addEventListener("input", renderSearch);

  // onboarding done
  $("#btnOnbDone").addEventListener("click", ()=>{
    const name = ($("#onbName").value || "").trim();
    const avatar = state._onbAvatar || AVATARS[0];
    if(!name){ alert("名前を入力してください"); return; }
    const user = { id: uid(), name, avatar };
    state.user = user;
    saveUser(user);
    $("#onboarding").classList.add("hidden");
    renderProfile();
    renderFeed();
  });

  // profile edit
  $("#btnEditProfile").addEventListener("click", openProfileEdit);
  $("#btnEditCancel").addEventListener("click", closeProfileEdit);

  $("#btnEditSave").addEventListener("click", ()=>{
    const name = ($("#editName").value || "").trim();
    if(!name){ alert("名前を入力してください"); return; }
    state.user.name = name;
    state.user.avatar = state._editAvatar || state.user.avatar;
    saveUser(state.user);
    closeProfileEdit();
    renderProfile();
    renderFeed();
  });

  $("#btnResetAll").addEventListener("click", ()=>{
    const ok = confirm("全部初期化します。よろしいですか？");
    if(!ok) return;
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_POSTS);
    localStorage.removeItem(LS_DMS);
    localStorage.removeItem(LS_PUBLISH);
    location.reload();
  });

  // ===== DM events =====
  $("#btnNewDM")?.addEventListener("click", openNewDMModal);
  $("#btnCloseNewDM")?.addEventListener("click", closeNewDMModal);
  $("#dmUserSearch")?.addEventListener("input", renderDMUserList);

  $("#btnBackDM")?.addEventListener("click", closeDMChat);

  // send DM (text)
  const send = ()=>{
    const text = ($("#dmInput").value || "").trim();
    if(!text) return;
    $("#dmInput").value = "";
    sendDM({ text, image: "" });
  };
  $("#btnSendDM")?.addEventListener("click", send);
  $("#dmInput")?.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){
      e.preventDefault();
      send();
    }
  });

  // send DM (image upload)
  $("#dmImageFile")?.addEventListener("change", async ()=>{
    const f = $("#dmImageFile").files?.[0];
    if(!f) return;
    const dataUrl = await fileToDataURL(f);
    // 画像のみ送信（テキスト空でもOK）
    sendDM({ text: "", image: dataUrl });
    $("#dmImageFile").value = "";
  });

  // ===== Publish page events =====
  $("#btnBackPublish")?.addEventListener("click", ()=> go("timeline"));
  $("#btnGoEditor")?.addEventListener("click", ()=>{
    const ids = state.publish.selectedIds || [];
    if(ids.length === 0) return;

    // 仮URL：あとで専用エディタのURLに差し替え
    const url = "https://example.com/editor?ids=" + encodeURIComponent(ids.join(","));
    window.open(url, "_blank", "noopener");
  });
}

// ---------- boot ----------
function boot(){
  state.user = loadUser();
  state.posts = loadPosts();
  state.dms = loadDMs();
  state.publish.selectedIds = loadPublishSelection();

  wire();

  if(!state.user){
    showOnboarding();
  }else{
    $("#meAvatarMini").textContent = state.user.avatar;
    renderFeed();
  }
  go("timeline");
}

boot();
