/* Portfolio renderer: reads data/*.json, sorts newest first, draws cards,
   and builds a grouped filter panel from data/categories.json. */
(function (root) {
  "use strict";

  /* ---------- pure helpers (also used by the test) ---------- */

  function isPresent(v) {
    return typeof v === "string" && /^(present|now|ongoing)$/i.test(v.trim());
  }

  // Sort key. Use `date` if given; otherwise the `end` of a range
  // ("present" or a missing `end` next to a `start` = still ongoing = newest).
  function sortKey(it) {
    if (it.date) return it.date;
    if (it.end) return isPresent(it.end) ? "9999-12" : it.end;
    if (it.start) return "9999-12";
    return "";
  }

  // Newest first. Tie-break / no date: later position in the JSON file counts as newer.
  function sortNewest(items) {
    return items
      .map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) {
        var da = sortKey(a.it), db = sortKey(b.it);
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

  // "02/2026 – 06/2026", "02/2026 – Present", or a single "06/2026".
  function dateLabel(it) {
    if (it.start || it.end) {
      var s = formatDate(it.start);
      var e = (!it.end || isPresent(it.end)) ? "Present" : formatDate(it.end);
      return s ? s + " – " + e : e;
    }
    return formatDate(it.date);
  }

  function tagsOf(item) {
    return Array.isArray(item.tags) ? item.tags.filter(Boolean).map(String) : [];
  }

  // Free-text search over title, issuer, description and tags.
  function matches(item, query) {
    if (!query) return true;
    var hay = [item.title, item.issuer, item.desc].concat(tagsOf(item)).join(" ").toLowerCase();
    return hay.indexOf(query.toLowerCase()) !== -1;
  }

  /* ----- grouped filter logic ----- */
  var OTHER = "Other", ISSUER = "Issuer";

  // categories.json: { "Embedded": ["STM32", ...], "IC Design": [...] }  →  lowercase tag → {group, name}
  function makeLookup(tax) {
    var map = {};
    Object.keys(tax || {}).forEach(function (g) {
      (Array.isArray(tax[g]) ? tax[g] : []).forEach(function (t) {
        map[String(t).toLowerCase()] = { group: g, name: String(t) };
      });
    });
    return map;
  }

  // { group: [tag, ...] } for one item. Unknown tags go to "Other"; a certificate's issuer gets its own group.
  function facetsOf(item, lookup, kind) {
    var f = {};
    function add(g, t) {
      f[g] = f[g] || [];
      if (f[g].indexOf(t) === -1) f[g].push(t);
    }
    if (kind === "certificate") {
      // Certificates are filtered by issuer only (no topic groups).
      if (item.issuer) add(ISSUER, item.issuer);
      return f;
    }
    tagsOf(item).forEach(function (t) {
      var hit = lookup[t.toLowerCase()];
      add(hit ? hit.group : OTHER, hit ? hit.name : t);
    });
    return f;
  }

  // Groups that are actually used by the items, with per-tag counts, in the order of categories.json.
  function buildGroups(items, tax, lookup, kind) {
    var counts = {};
    items.forEach(function (it) {
      var f = facetsOf(it, lookup, kind);
      Object.keys(f).forEach(function (g) {
        counts[g] = counts[g] || {};
        f[g].forEach(function (t) { counts[g][t] = (counts[g][t] || 0) + 1; });
      });
    });
    var out = [];
    Object.keys(tax || {}).concat([ISSUER, OTHER]).forEach(function (g) {
      if (!counts[g]) return;
      var listed = Array.isArray((tax || {})[g]) ? tax[g] : [];
      var tags = Object.keys(counts[g]).sort(function (a, b) {
        var ia = listed.indexOf(a), ib = listed.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
      out.push({ name: g, tags: tags.map(function (t) { return { tag: t, count: counts[g][t] }; }) });
    });
    return out;
  }

  // selected: { group: [tags] }. An item is shown if it has ANY of the selected tags (union),
  // so ticking "Embedded" and "IC Design" together shows both kinds of items.
  function matchesFilters(item, selected, lookup, kind) {
    var keys = Object.keys(selected).filter(function (g) { return selected[g] && selected[g].length; });
    if (!keys.length) return true;
    var f = facetsOf(item, lookup, kind);
    return keys.some(function (g) {
      return (f[g] || []).some(function (t) { return selected[g].indexOf(t) !== -1; });
    });
  }

  root.PortfolioLogic = {
    sortNewest: sortNewest, formatDate: formatDate, dateLabel: dateLabel, tagsOf: tagsOf, matches: matches,
    makeLookup: makeLookup, facetsOf: facetsOf, buildGroups: buildGroups, matchesFilters: matchesFilters
  };

  if (typeof document === "undefined") return; // running under node (tests)

  /* ---------- DOM ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function placeholder(title) {
    return el("div", "ph", (title || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase() || "{ }");
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

    var tags = kind === "project" ? tagsOf(item) : [];
    if (tags.length) {
      var t = el("div", "tags");
      tags.forEach(function (x) { t.appendChild(el("span", "tag", x)); });
      body.appendChild(t);
    }

    var foot = el("div", "card-foot");
    foot.appendChild(el("span", "date", dateLabel(item)));
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

  function load(url, fallback) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(url + " → " + r.status); return r.json(); })
      .then(function (data) {
        if (Array.isArray(fallback)) return Array.isArray(data) ? data : fallback;
        return data && typeof data === "object" && !Array.isArray(data) ? data : fallback;
      })
      .catch(function (e) { console.error(e); return fallback; });
  }

  /* ----- filter panel: [Filter ▾] button + popover with groups + active chips ----- */
  function buildFilter(toolbar, groups, onChange) {
    var chipsBox = toolbar.querySelector(".chips");
    var selected = {};                       // group -> [tags]
    groups.forEach(function (g) { selected[g.name] = []; });

    var btn = el("button", "filter-btn");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.appendChild(document.createTextNode("Filter ▾"));
    var badge = el("span", "badge", "0");
    badge.hidden = true;
    btn.appendChild(badge);

    var panel = el("div", "filter-panel");
    panel.hidden = true;
    var grid = el("div", "fgrid");
    panel.appendChild(grid);

    var groupBoxes = {};                     // name -> {head: input, opts: {tag: input}}
    groups.forEach(function (g) {
      var wrap = el("div", "fgroup");
      var head = el("label", "fhead");
      var hc = el("input"); hc.type = "checkbox";
      head.appendChild(hc);
      head.appendChild(el("span", "", g.name));
      head.appendChild(el("em", "", String(g.tags.length)));
      wrap.appendChild(head);

      var opts = el("div", "fopts");
      var refs = {};
      g.tags.forEach(function (t) {
        var lab = el("label", "opt");
        var cb = el("input"); cb.type = "checkbox"; cb.value = t.tag;
        var sp = el("span", "", t.tag);
        sp.appendChild(el("small", "", String(t.count)));
        lab.appendChild(cb); lab.appendChild(sp);
        cb.addEventListener("change", function () {
          var arr = selected[g.name], i = arr.indexOf(t.tag);
          if (cb.checked && i === -1) arr.push(t.tag);
          if (!cb.checked && i !== -1) arr.splice(i, 1);
          sync();
        });
        opts.appendChild(lab);
        refs[t.tag] = cb;
      });
      wrap.appendChild(opts);

      hc.addEventListener("change", function () {
        var all = selected[g.name].length === g.tags.length;
        selected[g.name] = all ? [] : g.tags.map(function (t) { return t.tag; });
        sync();
      });
      groupBoxes[g.name] = { head: hc, opts: refs };
      grid.appendChild(wrap);
    });

    var foot = el("div", "ffoot");
    var clear = el("button", "btn ghost", "Clear all"); clear.type = "button";
    var done = el("button", "btn", "Done"); done.type = "button";
    foot.appendChild(clear); foot.appendChild(done);
    panel.appendChild(foot);

    function total() {
      return groups.reduce(function (n, g) { return n + selected[g.name].length; }, 0);
    }

    function chip(label, remove) {
      var c = el("button", "chip on", label + "  ×");
      c.type = "button";
      c.title = "Remove filter";
      c.onclick = remove;
      return c;
    }

    function sync() {
      groups.forEach(function (g) {
        var sel = selected[g.name], b = groupBoxes[g.name];
        b.head.checked = sel.length === g.tags.length;
        b.head.indeterminate = sel.length > 0 && sel.length < g.tags.length;
        g.tags.forEach(function (t) { b.opts[t.tag].checked = sel.indexOf(t.tag) !== -1; });
      });
      var n = total();
      badge.textContent = String(n);
      badge.hidden = n === 0;

      chipsBox.replaceChildren();
      groups.forEach(function (g) {
        var sel = selected[g.name];
        if (!sel.length) return;
        if (g.tags.length > 1 && sel.length === g.tags.length) {
          chipsBox.appendChild(chip(g.name + " · all", function () { selected[g.name] = []; sync(); }));
        } else {
          sel.slice().forEach(function (t) {
            chipsBox.appendChild(chip(t, function () {
              selected[g.name].splice(selected[g.name].indexOf(t), 1); sync();
            }));
          });
        }
      });
      onChange(selected);
    }

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function () { setOpen(panel.hidden); });
    done.addEventListener("click", function () { setOpen(false); });
    clear.addEventListener("click", function () {
      groups.forEach(function (g) { selected[g.name] = []; });
      sync();
    });
    document.addEventListener("click", function (e) { if (!toolbar.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });

    toolbar.insertBefore(btn, chipsBox);
    toolbar.appendChild(panel);
    sync();
  }

  function mount(box) {
    var kind = box.dataset.kind;                       // "certificate" | "project"
    var url = kind === "certificate" ? "data/certificates.json" : "data/projects.json";
    var limit = parseInt(box.dataset.limit || "0", 10); // 0 = show all
    var interactive = box.dataset.interactive === "true";

    var needs = [load(url, [])];
    if (interactive && kind === "project") needs.push(load("data/categories.json", {}));

    Promise.all(needs).then(function (res) {
      var items = sortNewest(res[0]);
      var tax = res[1] || {};
      var lookup = makeLookup(tax);
      var state = { q: "", selected: {} };
      var counter = document.querySelector("[data-count='" + kind + "']");
      var toolbar = interactive ? document.getElementById("toolbar-" + kind) : null;

      function draw() {
        var list = items.filter(function (it) {
          return matches(it, state.q) && matchesFilters(it, state.selected, lookup, kind);
        });
        var total = list.length;
        if (limit) list = list.slice(0, limit);
        box.replaceChildren();
        if (!list.length) box.appendChild(emptyBox(kind, items.length > 0));
        list.forEach(function (it) { box.appendChild(buildCard(it, kind)); });
        if (counter) counter.textContent = total + (total === 1 ? " item" : " items") + (items.length !== total ? " (of " + items.length + ")" : "");
      }

      if (toolbar) {
        var input = toolbar.querySelector("input");
        input.addEventListener("input", function () { state.q = input.value.trim(); draw(); });
        var groups = buildGroups(items, tax, lookup, kind);
        if (groups.length) {
          buildFilter(toolbar, groups, function (sel) { state.selected = sel; draw(); });
        }
      }
      draw();

      var statEl = document.querySelector("[data-stat='" + kind + "']");
      if (statEl) statEl.textContent = items.length;
    });
  }

  document.querySelectorAll("[data-kind]").forEach(mount);
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined") module.exports = globalThis.PortfolioLogic;
