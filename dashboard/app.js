// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail drawer with the model's own arithmetic and the board's farm plan,
// the live-token tab, and the method page. No fetch, no network: every byte
// the page shows comes from data.js or this file.
//
// State lives in the hash, so a view is a link: #tab=live, #cat=Lending,
// #q=veda, #detail=steakhouse-financial.

(function () {
  'use strict';
  var DATA = window.RADAR;
  var WATCH = {};
  DATA.rows.forEach(function (r) { WATCH[r.slug] = true; });
  var watchlist = new Set(DATA.watchlist_slugs || []);
  var state = { q: '', category: 'all', chain: 'all', sort: 'implied', watchonly: false, tab: 'board', detail: null };

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }
  function pctClass(n) { return n === null || n === undefined ? 'muted' : n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted'; }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    var out = { q: '', category: 'all', chain: 'all', sort: 'implied', watchonly: false, tab: 'board', detail: null };
    if (!h) return out;
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      var k = kv[0];
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'q') out.q = v;
      else if (k === 'cat') out.category = v;
      else if (k === 'chain') out.chain = v;
      else if (k === 'sort') out.sort = v;
      else if (k === 'watchonly') out.watchonly = v === '1';
      else if (k === 'tab') out.tab = v;
      else if (k === 'detail') out.detail = v;
    });
    return out;
  }
  function writeHash() {
    var parts = [];
    if (state.tab !== 'board') parts.push('tab=' + state.tab);
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.sort !== 'implied') parts.push('sort=' + state.sort);
    if (state.watchonly) parts.push('watchonly=1');
    if (state.detail) parts.push('detail=' + encodeURIComponent(state.detail));
    var next = parts.length ? '#' + parts.join('&') : '';
    if (window.location.hash !== next) window.history.replaceState(null, '', next || window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchonly && !watchlist.has(r.slug)) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d === null ? -Infinity : b.change_7d) - (a.change_7d === null ? -Infinity : a.change_7d);
      if (key === 'age') return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      if (key === 'name') return a.name.localeCompare(b.name);
      return a.rank - b.rank;
    });
  }

  function renderStats() {
    var total = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var top = DATA.rows[0];
    $('stats').innerHTML =
      '<div class="stat"><b>' + DATA.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + '</b><span>on the watchlist</span></div>' +
      '<div class="stat"><b>' + money(total) + '</b><span>total implied value</span></div>' +
      '<div class="stat"><b>' + esc(top ? top.name : '—') + '</b><span>top pick · ' + money(top ? top.implied_value_usd : 0) + '</span></div>' +
      '<div class="stat"><b>' + DATA.live_size + '</b><span>already trading, set apart</span></div>';
    $('meta').textContent = 'Snapshot ' + DATA.as_of + ' · DefiLlama protocols at $5M+ TVL · watchlist floor ' + money(DATA.floor_usd) + ' · model ' + DATA.model_version;
    $('model-ver').textContent = DATA.model_version;
    $('as-of').textContent = DATA.as_of;
    $('provenance').textContent = 'Source: ' + DATA.source + ', fetched ' + DATA.as_of + '. The snapshot is frozen: every run of the program reads the same bytes.';
  }

  function renderBoard() {
    var list = sortedRows(filteredRows());
    var tbody = $('rows');
    tbody.innerHTML = '';
    $('empty').hidden = list.length > 0;
    $('count').textContent = list.length + ' of ' + DATA.board_size + ' protocols' +
      (state.watchonly ? ' · watchlist only' : '') +
      (state.category !== 'all' ? ' · ' + state.category : '') +
      (state.chain !== 'all' ? ' · ' + state.chain : '');
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.detail === r.slug) tr.className = 'selected';
      tr.tabIndex = 0;
      tr.setAttribute('data-slug', r.slug);
      tr.innerHTML =
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b>' + (watchlist.has(r.slug) ? '<span class="badge">WATCHLIST</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || 'Other') + '</td>' +
        '<td class="muted">' + esc(r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '')) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>';
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } });
      tbody.appendChild(tr);
    });
  }

  function renderLive() {
    var tbody = $('live-rows');
    tbody.innerHTML = '';
    DATA.live.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="name"><b>' + esc(r.name) + '</b><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || 'Other') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.mcap_tvl === null ? '—' : r.mcap_tvl.toFixed(2) + '×') + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderSetAside() {
    var ul = $('set-aside');
    ul.innerHTML = '';
    DATA.set_aside.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = s.label + ': ' + s.count + ' protocol' + (s.count === 1 ? '' : 's');
      ul.appendChild(li);
    });
  }

  function openDetail(slug) {
    state.detail = slug;
    writeHash();
    renderDetail();
    renderBoard();
  }
  function closeDetail() {
    state.detail = null;
    writeHash();
    $('detail').hidden = true;
    renderBoard();
  }

  function renderDetail() {
    var drawer = $('detail');
    var body = $('detail-body');
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.detail) row = r; });
    if (!row) { drawer.hidden = true; return; }
    drawer.hidden = false;
    var m = DATA.model;
    var tvl = row.tvl_usd;
    var steps = row.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    body.innerHTML =
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="slug">#' + row.rank + ' · ' + esc(row.slug) + ' · ' + esc(row.category || 'Other') + ' · ' + esc(row.chains.join(', ')) + '</p>' +
      '<div class="kv">' +
        '<div><span>Implied value</span><b>' + money(row.implied_value_usd) + '</b></div>' +
        '<div><span>TVL</span><b>' + money(tvl) + '</b></div>' +
        '<div><span>7-day change</span><b class="' + pctClass(row.change_7d) + '">' + pct(row.change_7d) + '</b></div>' +
        '<div><span>Age</span><b>' + ageText(row.age_days) + '</b></div>' +
      '</div>' +
      '<div class="modelbox"><h3>How the value is built</h3><table>' +
        '<tr><td>TVL</td><td class="num">' + money(tvl) + '</td></tr>' +
        '<tr><td>× category multiple (' + esc(row.category || 'Other') + ')</td><td class="num">' + row.category_multiple.toFixed(3) + '×</td></tr>' +
        '<tr><td>× growth (' + pct(row.change_7d) + ' over 7d)</td><td class="num">' + row.growth_multiplier.toFixed(3) + '×</td></tr>' +
        '<tr><td>× maturity (' + ageText(row.age_days) + ' old)</td><td class="num">' + row.maturity_multiplier.toFixed(3) + '×</td></tr>' +
        '<tr><td>× chains (' + row.chains.length + ')</td><td class="num">' + row.chain_multiplier.toFixed(3) + '×</td></tr>' +
        '<tr><td>Implied value</td><td class="num">' + money(row.implied_value_usd) + '</td></tr>' +
      '</table></div>' +
      '<h3>Farm plan — six steps</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<p class="note">This protocol <b>records no token</b> in the snapshot. That is the record, not proof it has none — and a launch, if one ever comes, is not predicted here.</p>';
  }

  function renderTabs() {
    var tabs = { board: 'view-board', live: 'view-live', method: 'view-method' };
    Object.keys(tabs).forEach(function (t) {
      $('view-' + t).hidden = state.tab !== t;
      $('tab-' + t).classList.toggle('active', state.tab === t);
    });
  }

  function fillSelects() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var catSel = $('cat');
    cats.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      catSel.appendChild(o);
    });
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
    var chainSel = $('chain');
    chains.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      chainSel.appendChild(o);
    });
  }

  function syncControls() {
    $('q').value = state.q;
    $('cat').value = state.category;
    $('chain').value = state.chain;
    $('sort').value = state.sort;
    $('watchonly').checked = state.watchonly;
  }

  function render() {
    renderTabs();
    renderBoard();
    renderDetail();
  }

  function init() {
    state = readHash();
    fillSelects();
    syncControls();
    renderStats();
    renderLive();
    renderSetAside();
    render();

    $('q').addEventListener('input', function () { state.q = $('q').value; writeHash(); renderBoard(); });
    $('cat').addEventListener('change', function () { state.category = $('cat').value; writeHash(); renderBoard(); });
    $('chain').addEventListener('change', function () { state.chain = $('chain').value; writeHash(); renderBoard(); });
    $('sort').addEventListener('change', function () { state.sort = $('sort').value; writeHash(); renderBoard(); });
    $('watchonly').addEventListener('change', function () { state.watchonly = $('watchonly').checked; writeHash(); renderBoard(); });
    $('clear').addEventListener('click', function () {
      state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchonly = false;
      syncControls(); writeHash(); renderBoard();
    });
    ['board', 'live', 'method'].forEach(function (t) {
      $('tab-' + t).addEventListener('click', function () { state.tab = t; writeHash(); renderTabs(); });
    });
    $('detail-close').addEventListener('click', closeDetail);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
    window.addEventListener('hashchange', function () { state = readHash(); syncControls(); render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
