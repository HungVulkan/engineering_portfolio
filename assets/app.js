/* Portfolio renderer: reads data/*.json, sorts newest first, draws cards. */
(function (root) {
  "use strict";

  /* ---------- pure helpers (also used by the test) ---------- */

  // Newest first. Primary key: `date` (ISO "YYYY-MM-DD" or "YYYY-MM").
  // Tie-break / no date: later position in the JSON file counts as newer.
  function sortNewest(items) {
    return items
      .map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) {
        var da = a.it.date || "", db = b.it.date || "";
        if (da !== db) return da < db ? 1 : -1;
        return b.i - a.i;
      })
      .map(function (x) { return x.it; });
  }

  function formatDate(d) {
    if (!d) return "";
    var m = /^(\d{4})-(\d{2})/.exec(d);
    return m ? m[2] + "/" + m[1] : d;
  }

  function tagsOf(item) {
    if (Array.isArray(item.tags) && item.tags.length) return item.tags;
    return item.issuer ? [item.issuer] : [];
  }

  function matches(item, query, tag) {
    if (tag && tagsOf(item).indexOf(tag) === -1) return false;
    if (!query) return true;
    var hay = [item.title, item.issuer, item.desc].concat(tagsOf(item)).join(" ").toLowerCase();
    return hay.indexOf(query.toLowerCase()) !== -1;
  }

  root.PortfolioLogic = { sortNewest: sortNewest, formatDate: formatDate, tagsOf: tagsOf, matches: matches };

  if (typeof document === "undefined") return; // running under node (tests)

  /* ---------- DOM ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function placeholder(title) {
    var p = el("div", "ph", (title || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase() || "{ }");
    return p;
  }

  function buildMedia(item) {
    var box = el(item.image ? "a" : "div", "media");
    if (!item.image) { box.appendChild(placeholder(item.title)); return box; }
    box.href = item.image; box.target = "_blank"; box.rel = "noopener";
    var img = el("img");
    img.src = item.image; img.alt = item.title; img.loading = "lazy";
    img.onerror = function () { box.replaceChildren(placeholder(item.title)); box.removeAttribute("href"); };
    box.appendChild(img);
    return box;
  }

  function button(label, href) {
    var a = el("a", "btn", label);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  function buildCard(item, kind) {
    var card = el("article", "card");
    card.appendChild(buildMedia(item));
    var body = el("div", "card-body");

    var meta = kind === "certificate" ? item.issuer : (item.role || "");
    if (meta) body.appendChild(el("div", "meta", meta));
    body.appendChild(el("h3", "", item.title));
    if (item.desc) body.appendChild(el("p", "", item.desc));

    if (kind === "project" && Array.isArray(item.tags) && item.tags.length) {
      var t = el("div", "tags");
      item.tags.forEach(function (x) { t.appendChild(el("span", "tag", x)); });
      body.appendChild(t);
    }

    var foot = el("div", "card-foot");
    foot.appendChild(el("span", "date", formatDate(item.date)));
    var actions = el("div", "actions");
    if (item.link) actions.appendChild(button(kind === "certificate" ? "View ↗" : "Open ↗", item.link));
    if (item.github) actions.appendChild(button("GitHub ↗", item.github));
    foot.appendChild(actions);
    body.appendChild(foot);

    card.appendChild(body);
    return card;
  }

  function emptyBox(kind, filtered) {
    var d = el("div", "empty");
    if (filtered) { d.textContent = "No matches. Try another keyword or filter."; return d; }
    var file = kind === "certificate" ? "data/certificates.json" : "data/projects.json";
    d.appendChild(document.createTextNode("Nothing here yet. Add an entry to "));
    d.appendChild(el("code", "", file));
    d.appendChild(document.createTextNode("."));
    return d;
  }

  function load(url) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(url + " → " + r.status); return r.json(); })
      .then(function (arr) { return Array.isArray(arr) ? arr : []; })
      .catch(function (e) { console.error(e); return []; });
  }

  function mount(box) {
    var kind = box.dataset.kind;                       // "certificate" | "project"
    var url = kind === "certificate" ? "data/certificates.json" : "data/projects.json";
    var limit = parseInt(box.dataset.limit || "0", 10); // 0 = show all
    var interactive = box.dataset.interactive === "true";

    load(url).then(function (raw) {
      var items = sortNewest(raw);
      var state = { q: "", tag: "" };
      var counter = document.querySelector("[data-count='" + kind + "']");
      var toolbar = interactive ? document.getElementById("toolbar-" + kind) : null;

      function draw() {
        var list = items.filter(function (it) { return matches(it, state.q, state.tag); });
        var total = list.length;
        if (limit) list = list.slice(0, limit);
        box.replaceChildren();
        if (!list.length) box.appendChild(emptyBox(kind, items.length > 0));
        list.forEach(function (it) { box.appendChild(buildCard(it, kind)); });
        if (counter) counter.textContent = total + (total === 1 ? " item" : " items") + (items.length !== total ? " (of " + items.length + ")" : "");
      }

      if (toolbar) {
        var input = toolbar.querySelector("input");
        var chipsBox = toolbar.querySelector(".chips");
        var freq = {};
        items.forEach(function (it) { tagsOf(it).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; }); });
        var top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a] || a.localeCompare(b); }).slice(0, 12);

        function chip(label, value) {
          var c = el("button", "chip" + (value === state.tag ? " on" : ""), label);
          c.type = "button";
          c.onclick = function () {
            state.tag = value;
            chipsBox.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
            c.classList.add("on");
            draw();
          };
          return c;
        }
        if (top.length) {
          chipsBox.appendChild(chip("All", ""));
          top.forEach(function (t) { chipsBox.appendChild(chip(t, t)); });
        }
        input.addEventListener("input", function () { state.q = input.value.trim(); draw(); });
      }
      draw();

      var statEl = document.querySelector("[data-stat='" + kind + "']");
      if (statEl) statEl.textContent = items.length;
    });
  }

  document.querySelectorAll("[data-kind]").forEach(mount);
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined") module.exports = globalThis.PortfolioLogic;
