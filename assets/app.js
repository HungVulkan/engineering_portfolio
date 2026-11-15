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

  // Full date for blog posts: "2026-11-15" → "15/11/2026". Falls back to "MM/YYYY", then to the raw text.
  function formatFullDate(d) {
    if (!d) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : formatDate(d);
  }

  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  // Link id of a post: `id` if given, otherwise built from date + title ("2026-11-15-bai-viet-dau-tien").
  function postId(post) {
    if (post.id) return slugify(post.id);
    return slugify(String(post.date || "").slice(0, 10) + " " + post.title);
  }

  function blocksOf(post) {
    return Array.isArray(post.content) ? post.content : [];
  }

  // Card image: `cover` if given, otherwise the first image inside the post.
  function coverOf(post) {
    if (post.cover) return post.cover;
    var b = blocksOf(post).filter(function (x) { return x && x.image; })[0];
    return b ? b.image : "";
  }

  // Card text: `summary` if given, otherwise the start of the first paragraph.
  function excerptOf(post, max) {
    if (post.summary) return post.summary;
    var p = blocksOf(post).filter(function (x) { return typeof x === "string" && x.trim(); })[0] || "";
    p = p.replace(/\s+/g, " ").trim();
    max = max || 160;
    if (p.length <= max) return p;
    var cut = p.slice(0, max), sp = cut.lastIndexOf(" ");
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?-]+$/, "") + "…";
  }

  function tagsOf(item) {
    return Array.isArray(item.tags) ? item.tags.filter(Boolean).map(String) : [];
  }

  // Free-text search over title, issuer, description and tags.
  function matches(item, query) {
    if (!query) return true;
    var body = blocksOf(item).filter(function (b) { return typeof b === "string"; });
    var hay = [item.title, item.issuer, item.desc, item.summary].concat(tagsOf(item), body).join(" ").toLowerCase();
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
    formatFullDate: formatFullDate, postId: postId, coverOf: coverOf, excerptOf: excerptOf,
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
    if (item.image_pos) img.style.objectPosition = item.image_pos; // e.g. "center top", "50% 20%"
    img.onerror = function () { box.replaceChildren(placeholder(item.title)); box.removeAttribute("href"); };
    box.appendChild(img);
    return box;
  }

  function button(label, href) {
    var a = el("a", "btn", label);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  var DATA = { certificate: "data/certificates.json", project: "data/projects.json", blog: "data/blog.json" };

  // Blog card: cover image + title + short summary + date. Click opens post.html?p=<id>.
  function buildBlogCard(item) {
    var href = "post.html?p=" + encodeURIComponent(postId(item));
    var card = el("article", "card blog-card");

    var media = el("a", "media");
    media.href = href;
    var cover = coverOf(item);
    if (cover) {
      var img = el("img");
      img.src = cover; img.alt = item.title; img.loading = "lazy";
      if (item.image_pos) img.style.objectPosition = item.image_pos;
      img.onerror = function () { media.replaceChildren(placeholder(item.title)); };
      media.appendChild(img);
    } else {
      media.appendChild(placeholder(item.title));
    }
    card.appendChild(media);

    var body = el("div", "card-body");
    body.appendChild(el("h3", "", item.title));
    var text = excerptOf(item);
    if (text) body.appendChild(el("p", "", text));

    var foot = el("div", "card-foot");
    foot.appendChild(el("span", "date", formatFullDate(item.date)));
    var actions = el("div", "actions");
    var more = el("a", "btn", "Read →");
    more.href = href;
    actions.appendChild(more);
    foot.appendChild(actions);
    body.appendChild(foot);

    card.appendChild(body);
    return card;
  }

  function buildCard(item, kind) {
    if (kind === "blog") return buildBlogCard(item);
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
    d.appendChild(document.createTextNode("Nothing here yet. Add an entry to "));
    d.appendChild(el("code", "", DATA[kind]));
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
    var kind = box.dataset.kind;                       // "certificate" | "project" | "blog"
    var url = DATA[kind];
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

  /* ----- single post page (post.html?p=<id>) ----- */
  // Image + caption right under it (caption is italic, see .post-fig figcaption in style.css).
  function buildFigure(b) {
    var fig = el("figure", "post-fig");
    var a = el("a");
    a.href = b.image; a.target = "_blank"; a.rel = "noopener";
    var img = el("img");
    img.src = b.image; img.alt = b.caption || b.alt || ""; img.loading = "lazy";
    img.onerror = function () {
      a.removeAttribute("href");
      a.replaceChildren(el("div", "img-missing", "Image not found: " + b.image));
    };
    a.appendChild(img);
    fig.appendChild(a);
    if (b.caption) fig.appendChild(el("figcaption", "", b.caption));
    return fig;
  }

  function mountPost(box) {
    load(DATA.blog, []).then(function (list) {
      var id = new URLSearchParams(location.search).get("p") || "";
      var post = list.filter(function (it) { return it && postId(it) === id; })[0];
      box.replaceChildren();

      if (!post) {
        var d = el("div", "empty");
        d.appendChild(document.createTextNode("Post not found. "));
        var back = el("a", "", "Back to all posts");
        back.href = "blog.html";
        d.appendChild(back);
        box.appendChild(d);
        return;
      }

      document.title = post.title + " · Vũ Quốc Hùng";
      box.appendChild(el("p", "eyebrow", "// BLOG"));
      box.appendChild(el("h1", "", post.title));
      box.appendChild(el("p", "date post-date", formatFullDate(post.date)));

      var content = el("div", "post-body");
      blocksOf(post).forEach(function (b) {
        if (typeof b === "string") content.appendChild(el("p", "", b));
        else if (b && b.heading) content.appendChild(el("h2", "", b.heading));
        else if (b && b.image) content.appendChild(buildFigure(b));
      });
      box.appendChild(content);
    });
  }

  document.querySelectorAll("[data-kind]").forEach(mount);
  document.querySelectorAll("[data-post]").forEach(mountPost);
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined") module.exports = globalThis.PortfolioLogic;
