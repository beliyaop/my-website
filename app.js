/* ============================================================
   app.js · 「每日日记」全部逻辑
   ------------------------------------------------------------
   它管四件事：
     1. 读写浏览器本地存储（localStorage，键名 diary.entries）
     2. 把日记渲染成页面上的列表
     3. 处理点击：保存、进详情、返回、收藏
     4. 出错时如实告诉用户，绝不假装保存成功

   一条日记长这样（字段与 PRD §6 一一对应）：
     {
       id:        "a1b2c3…",            // 唯一标识，用户看不到
       date:      "2026-10-02",         // 记录所属日期
       text:      "今天学会写验收标准",   // 正文
       favorite:  false,                // 是否收藏
       createdAt: "2026-10-02T23:10:00" // 保存时刻，同一天多条时用来排序
     }

   全程不联网：数据只进这台设备的浏览器。
   ============================================================ */

'use strict';

/* ---------- 1. 常量与运行状态 ---------- */

var STORAGE_KEY = 'diary.entries';   // 本地存储的键名（技术设计已定，别改）
var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

var entries = [];        // 内存里的全部日记
var currentId = null;    // 详情视图正在看哪一条（null = 在列表视图）

/* ---------- 2. 把页面上要用到的元素一次抓齐 ---------- */
// 名字必须和 index.html 里的 id 完全一致，写错了会是 undefined。
var els = {
  viewList:     document.getElementById('view-list'),
  viewDetail:   document.getElementById('view-detail'),
  form:         document.getElementById('entry-form'),
  input:        document.getElementById('entry-input'),
  saveBtn:      document.getElementById('save-btn'),
  warning:      document.getElementById('storage-warning'),
  emptyState:   document.getElementById('empty-state'),
  entryList:    document.getElementById('entry-list'),
  entryTpl:     document.getElementById('entry-template'),
  backBtn:      document.getElementById('back-btn'),
  detailDate:   document.getElementById('detail-date'),
  detailText:   document.getElementById('detail-text'),
  detailFavBtn: document.getElementById('detail-fav-btn')
};

/* ---------- 3. 小工具 ---------- */

// 今天日期，格式 2026-10-02（用本地时间，不用 UTC）
function todayStr() {
  var d = new Date();
  var p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// 此刻时间，格式 2026-10-02T23:10:00
function nowLocalISO() {
  var d = new Date();
  var p = function (n) { return String(n).padStart(2, '0'); };
  return todayStr() + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// 生成唯一标识。crypto.randomUUID 只在 https 或 localhost 下可用，所以留个兜底。
function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID().replace(/-/g, '');
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// 把 "2026-10-02" 显示成 "2026年10月2日 周五"
function formatDate(dateStr) {
  var parts = String(dateStr).split('-').map(Number);
  // 用「年, 月, 日」三个数字构造日期，避免被时区挪走一天
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAYS[d.getDay()];
}

/* ---------- 4. 存储层：所有读写 localStorage 的动作都关在这里 ---------- */

// 探测本地存储能不能用（隐私模式、被禁用时会失败）
function storageAvailable() {
  try {
    localStorage.setItem('__diary_probe__', '1');
    localStorage.removeItem('__diary_probe__');
    return true;
  } catch (err) {
    return false;
  }
}

// 读全部日记；读不出来就当作空列表，不让页面白屏
function loadEntries() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // 顺手过滤掉字段不全的脏数据，防止点了没反应
    return list.filter(function (it) {
      return it && typeof it.id === 'string' && typeof it.text === 'string';
    });
  } catch (err) {
    console.warn('读取本地日记失败：', err);
    return [];
  }
}

// 写全部日记。返回是否成功——成败由调用方决定怎么告诉用户。
function saveEntries(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return { ok: true };
  } catch (err) {
    // 常见原因：存储满了（约 5MB）
    console.warn('写入本地日记失败：', err);
    return { ok: false, error: err };
  }
}

// 排序：日期新的在前；同一天里，后写的在前
function sortEntries(list) {
  return list.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/* ---------- 5. 提示区 ---------- */

function showWarning(msg) {
  els.warning.textContent = msg;
  els.warning.hidden = false;
}

function hideWarning() {
  els.warning.hidden = true;
}

/* ---------- 6. 渲染 ---------- */

function render() {
  renderList();
  if (currentId) renderDetail();
}

function renderList() {
  var sorted = sortEntries(entries);

  els.entryList.textContent = '';                  // 先清空
  els.emptyState.hidden = sorted.length > 0;       // 一条都没有时显示「写下第一句吧」

  sorted.forEach(function (entry) {
    // 照模板复制一份，再把内容填进去
    var node = els.entryTpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = entry.id;

    node.querySelector('.entry-date').textContent = formatDate(entry.date);
    // 用 textContent 而不是 innerHTML：用户写的内容永远被当纯文字，不会被当成代码执行
    node.querySelector('.entry-text').textContent = entry.text;

    var favBtn = node.querySelector('.entry-fav');
    favBtn.textContent = entry.favorite ? '★' : '☆';
    favBtn.classList.toggle('is-fav', entry.favorite);
    favBtn.setAttribute('aria-label', entry.favorite ? '取消收藏' : '收藏');

    els.entryList.appendChild(node);
  });
}

function renderDetail() {
  var entry = entries.find(function (it) { return it.id === currentId; });
  if (!entry) { showList(); return; }              // 找不到就退回列表，不白屏

  els.detailDate.textContent = formatDate(entry.date);
  els.detailText.textContent = entry.text;
  els.detailFavBtn.textContent = entry.favorite ? '★ 已收藏' : '☆ 收藏';
  els.detailFavBtn.classList.toggle('is-fav', entry.favorite);
}

/* ---------- 7. 两个视图之间切换 ---------- */

function openDetail(id) {
  var entry = entries.find(function (it) { return it.id === id; });
  if (!entry) { showList(); return; }

  currentId = id;
  renderDetail();
  els.viewList.hidden = true;
  els.viewDetail.hidden = false;
  window.scrollTo(0, 0);
}

function showList() {
  currentId = null;
  els.viewDetail.hidden = true;
  els.viewList.hidden = false;
}

/* ---------- 8. 动作：保存 / 收藏 ---------- */

function updateSaveButton() {
  // 空的、或只有空格 → 按钮置灰（PRD F1 边界要求）
  els.saveBtn.disabled = els.input.value.trim() === '';
}

function handleSubmit(e) {
  e.preventDefault();                              // 拦住 form 的默认提交，否则页面会刷新

  var text = els.input.value.trim();
  if (!text) return;                               // 空内容不保存

  var entry = {
    id: makeId(),
    date: todayStr(),
    text: text,
    favorite: false,
    createdAt: nowLocalISO()
  };

  var next = entries.concat(entry);
  var result = saveEntries(next);

  if (!result.ok) {
    // 写失败：内容留在输入框里，明确报错，绝不伪装成已保存（PRD §7 硬条款）
    showWarning('没存上——浏览器的本地存储可能满了。你写的内容还在输入框里，先复制保存一下，清理后可以重试。');
    return;
  }

  entries = next;
  els.input.value = '';                            // 清空输入框，引导语仍显示在上方
  hideWarning();
  updateSaveButton();
  els.input.focus();
  render();
}

function toggleFavorite(id) {
  var entry = entries.find(function (it) { return it.id === id; });
  if (!entry) return;

  entry.favorite = !entry.favorite;
  var result = saveEntries(entries);

  if (!result.ok) {
    entry.favorite = !entry.favorite;              // 写失败就还原，不让星标骗人
    showWarning('这次收藏没存住——浏览器的本地存储可能满了。');
  }

  render();
}

/* ---------- 9. 事件绑定 ---------- */

function onListClick(e) {
  var favBtn = e.target.closest('.entry-fav');
  if (favBtn) {
    toggleFavorite(favBtn.closest('.entry').dataset.id);
    return;
  }

  var openBtn = e.target.closest('.entry-open');
  if (openBtn) {
    openDetail(openBtn.closest('.entry').dataset.id);
  }
}

/* ---------- 10. 启动 ---------- */

function init() {
  // 本地存储不可用：禁用写入口并说明原因（PRD §7）
  if (!storageAvailable()) {
    els.input.disabled = true;
    els.saveBtn.disabled = true;
    showWarning('当前浏览器无法保存日记（可能是隐私模式，或禁用了本地存储）。');
    return;
  }

  entries = loadEntries();

  els.input.addEventListener('input', updateSaveButton);
  els.form.addEventListener('submit', handleSubmit);
  els.entryList.addEventListener('click', onListClick);
  els.backBtn.addEventListener('click', showList);
  els.detailFavBtn.addEventListener('click', function () {
    if (currentId) toggleFavorite(currentId);
  });

  updateSaveButton();
  render();
}

init();
