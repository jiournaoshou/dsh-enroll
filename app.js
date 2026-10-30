// 学号登记站前端。表格一律用 textContent 写入，不用 innerHTML 拼用户输入。
var API = window.API_BASE || "";
var STATE = {
  verified:     ["实测满分", "g"],
  local_only:   ["本地判过", "y"],
  has_answer:   ["有成品", "y"],
  params_ready: ["可构造", "b"],
  spec_only:    ["需抓包", "d"]
};
var COV = [];
var ADMIN = false;
var AKEY = (function () {
  var m = /[?&]key=([^&#]+)/.exec(location.search);
  try {
    if (m) sessionStorage.setItem("enroll_key", decodeURIComponent(m[1]));
    return sessionStorage.getItem("enroll_key") || "";
  } catch (e) {
    return m ? m[1] : "";
  }
})();

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

function say(text, kind) {
  var m = document.getElementById("msg");
  m.textContent = text;
  m.className = "msg " + (kind || "");
}

function net(text) {
  document.getElementById("net").textContent = text;
}

function hide(id) {
  var n = document.getElementById(id);
  if (n) n.style.display = "none";
}

function api(path, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (AKEY) opts.headers["X-Admin-Key"] = AKEY;
  return fetch(API + path, opts).then(function (r) {
    return r.text().then(function (txt) {
      var j = {};
      try { j = JSON.parse(txt); } catch (e) {}
      if (!r.ok) {
        var err = new Error(j.error || ("HTTP " + r.status));
        err.status = r.status;
        err.needKey = !!j.need_key;
        throw err;
      }
      return j;
    });
  });
}

function submitForm(ev) {
  ev.preventDefault();
  var xh = document.getElementById("xh").value.trim();
  if (!/^\d{10,14}$/.test(xh)) { say("学号得是 10-14 位数字", "err"); return; }
  var body = {
    xh: xh,
    xm: document.getElementById("xm").value.trim(),
    homework: document.getElementById("homework").value.trim(),
    note: document.getElementById("note").value.trim()
  };
  var btn = document.getElementById("btn");
  btn.disabled = true;
  say("提交中…");
  api("/api/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify(body)
  }).then(function (j) {
    say(j.new ? ("已登记，第 " + j.id + " 号") : ("已更新（累计 " + j.hits + " 次提交）"), "ok");
    if (ADMIN) loadQueue();
  }).catch(function (e) {
    say("失败：" + e.message, "err");
  }).then(function () { btn.disabled = false; });
}

function renderCoverage(data) {
  COV = data.rows || [];
  var sel = document.getElementById("fam");
  var keep = sel.value;
  sel.textContent = "";
  var all = el("option", null, "全部系");
  all.value = "";
  sel.appendChild(all);
  var used = {};
  COV.forEach(function (r) { used[r.fam] = 1; });
  Object.keys(used).sort().forEach(function (f) {
    var o = el("option", null, f);
    o.value = f;
    sel.appendChild(o);
  });
  sel.value = keep || "";
  var c = data.counts || {};
  document.getElementById("covmeta").textContent =
    COV.length + " 题 · 实测满分 " + (c.verified || 0) +
    " · 仅本地判 " + (c.local_only || 0) +
    " · 可构造 " + (c.params_ready || 0) +
    " · 需抓包 " + (c.spec_only || 0) +
    " · exe " + (data.exe_sha256 ? data.exe_sha256.slice(0, 12) + "…" : "未知") +
    " · 派发表 " + (data.spec_at || "?");
  paintCov();
}

function paintCov() {
  var q = document.getElementById("q").value.trim().toLowerCase();
  var f = document.getElementById("fam").value;
  var s = document.getElementById("state").value;
  var tb = document.querySelector("#cov tbody");
  tb.textContent = "";
  var n = 0;
  COV.forEach(function (r) {
    if (n >= 800) return;
    if (f && r.fam !== f) return;
    if (s && r.state !== s) return;
    if (q && r.tkbh.toLowerCase().indexOf(q) < 0 &&
        (r.title || "").toLowerCase().indexOf(q) < 0 &&
        (r.answer || "").toLowerCase().indexOf(q) < 0 &&
        (r.note || "").toLowerCase().indexOf(q) < 0) return;
    n++;
    var tr = el("tr");
    tr.appendChild(el("td", "mono", r.tkbh));
    var head = r.title || r.answer || "—";
    var td = el("td");
    td.appendChild(el("div", "title", head));
    if (r.answer && head !== r.answer) td.appendChild(el("div", "sub", r.answer));
    if (r.verify) td.appendChild(el("div", "sub", r.verify));
    else if (r.note && head !== r.note) td.appendChild(el("div", "sub", r.note));
    tr.appendChild(td);
    tr.appendChild(el("td", "num", r.items));
    tr.appendChild(el("td", "num", r.jbfz === null || r.jbfz === undefined ? "—" : r.jbfz));
    var st = STATE[r.state] || [r.state, "d"];
    var ctd = el("td");
    ctd.appendChild(el("span", "badge " + st[1], st[0]));
    tr.appendChild(ctd);
    tb.appendChild(tr);
  });
  document.getElementById("cown").textContent = n + " / " + COV.length + " 题";
}

function renderQueue(data) {
  var tb = document.querySelector("#queue tbody");
  tb.textContent = "";
  if (data.hidden) {
    document.getElementById("qcount").textContent = "";
    document.getElementById("qhint").textContent = "名单只对管理员开放（网址后加 ?key=…）。";
    return;
  }
  document.getElementById("qhint").textContent = "共 " + data.items.length + " 条（最多显示 500）";
  document.getElementById("qcount").textContent = data.items.length + " 人";
  data.items.forEach(function (r) {
    var tr = el("tr");
    tr.appendChild(el("td", "mono", r.xh));
    tr.appendChild(el("td", "", r.xm || "—"));
    tr.appendChild(el("td", "", r.homework || "—"));
    tr.appendChild(el("td", "note", r.note || "—"));
    tr.appendChild(el("td", "num", r.hits));
    tr.appendChild(el("td", "mono", r.updated_at));
    tb.appendChild(tr);
  });
}

function loadCoverage() {
  return api("/api/coverage").then(function (d) {
    renderCoverage(d);
    return true;
  }, function (e) {
    hide("covcard");
    net("服务在线，但读不到题库覆盖：" + e.message);
    return false;
  });
}

function loadQueue() {
  return api("/api/queue").then(renderQueue, function () {});
}

function offline(reason) {
  var detail = API ? ("连不上后端 " + API + "：" + reason) : ("读不到服务：" + reason);
  net(location.protocol === "file:"
      ? "静态模式：file:// 打开只能看页面。要么本机起后端服务，要么在 config.js 里填好 API_BASE。"
      : detail);
  hide("covcard");
  hide("queuecard");
}

function boot() {
  document.getElementById("f").addEventListener("submit", submitForm);
  document.getElementById("refresh").addEventListener("click", function () {
    loadCoverage().then(function (ok) { if (ok) loadQueue(); });
  });
  document.getElementById("xh").addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9]/g, "");
  });
  ["q", "fam", "state"].forEach(function (id) {
    var n = document.getElementById(id);
    n.addEventListener(id === "q" ? "input" : "change", paintCov);
  });
  api("/api/ping").then(function (p) {
    ADMIN = !!p.admin;
    net(ADMIN ? "服务在线，管理员视图。"
              : "服务在线，可提交。名单与题库覆盖需 ?key= 才显示。");
    if (ADMIN) { loadCoverage(); loadQueue(); }
    else { hide("covcard"); hide("queuecard"); }
  }, function (e) {
    offline(e.message);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else { boot(); }
