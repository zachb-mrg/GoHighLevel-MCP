// src/calendar-page.ts
// -----------------------------------------------------------------------------
// Static HTML for the GHL Task Calendar widget, served at GET /calendar.
// Same-origin with the /api/cal/* routes, so there is no CORS to deal with.
// FullCalendar loads from CDN — no build step, no extra dependency.
//
// Features: day/week/month views, assignee filter, drag-to-reschedule,
// inline checkbox to mark complete, click-a-task for details + open contact,
// and per-user task colors with an editable color key (stored in the
// browser's localStorage, keyed by the viewing user's id).
// -----------------------------------------------------------------------------
export const CALENDAR_PAGE = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Task Calendar</title>
<link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.css" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>
<style>
  :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  html,body{height:100%;}
  body{margin:0;padding:12px;background:#fff;color:#1f2937;box-sizing:border-box;display:flex;flex-direction:column;}
  .bar{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;flex:0 0 auto;}
  .bar label{font-size:13px;color:#6b7280;}
  select{padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;}
  #status{font-size:12px;color:#9ca3af;margin-left:auto;}
  .mini-btn{padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;}
  #legend{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px;flex:0 0 auto;}
  #legend .lg{display:flex;align-items:center;gap:5px;font-size:12px;color:#374151;}
  #legend .sw{width:12px;height:12px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.15);}
  .editor{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px;flex:0 0 auto;}
  .editor .erow{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
  .editor input[type=text]{flex:1 1 auto;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;}
  .editor input[type=color]{width:34px;height:28px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;padding:0;}
  .editor .del{background:#fee2e2;border:0;color:#991b1b;border-radius:6px;padding:5px 9px;cursor:pointer;}
  .editor .add{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px;margin-top:4px;}
  #cal{width:100%;flex:1 1 auto;min-height:0;}
  .fc .fc-button-primary{background:#2563eb;border-color:#2563eb;}
  .fc .fc-button-primary:hover{background:#1d4ed8;border-color:#1d4ed8;}
  .fc-event{cursor:pointer;font-size:12px;}
  .fc-event.saving{opacity:.5;}
  .cal-chk{cursor:pointer;flex:0 0 auto;padding:0 2px;}
  .cal-evt{display:flex;align-items:center;gap:4px;overflow:hidden;}
  .cal-evt .cal-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  /* modal */
  #cal-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;}
  #cal-modal .card{background:#fff;border-radius:12px;max-width:440px;width:90%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.2);font-size:14px;}
  #cal-modal .ttl{font-weight:600;font-size:16px;margin-bottom:8px;}
  #cal-modal .body{color:#374151;white-space:pre-wrap;margin-bottom:10px;}
  #cal-modal .meta{color:#6b7280;margin-bottom:4px;}
  #cal-modal .contact{background:#f9fafb;border:1px solid #eef0f2;border-radius:8px;padding:8px 10px;margin:8px 0 10px;font-size:13px;}
  #cal-modal .contact .c-name{font-weight:600;color:#111;margin-bottom:2px;}
  #cal-modal .contact .c-line{color:#374151;line-height:1.5;}
  #cal-modal .contact a{color:#2563eb;text-decoration:none;}
  #cal-modal .lbl{font-size:12px;color:#6b7280;margin:10px 0 4px;}
  #cal-modal .swatches{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
  #cal-modal .swatch{width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,.2);cursor:pointer;}
  #cal-modal .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}
  #cal-modal a.btn,#cal-modal button.btn{border:0;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:14px;text-decoration:none;}
  #cal-modal .btn-open{background:#2563eb;color:#fff;}
  #cal-modal .btn-done{background:#16a34a;color:#fff;}
  #cal-modal .btn-close{background:#e5e7eb;color:#111;}
  #cal-modal .btn-create{background:#16a34a;color:#fff;}
  #cal-modal .fld{margin-bottom:10px;}
  #cal-modal .fld label{display:block;font-size:12px;color:#6b7280;margin-bottom:3px;}
  #cal-modal .fld input,#cal-modal .fld select,#cal-modal .fld textarea{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d1d5db;border-radius:7px;font-size:14px;font-family:inherit;}
  #cal-modal #cResults{border:1px solid #e5e7eb;border-radius:7px;margin-top:4px;max-height:170px;overflow:auto;display:none;}
  #cal-modal #cResults .ci{padding:7px 9px;cursor:pointer;border-bottom:1px solid #f3f4f6;}
  #cal-modal #cResults .ci:hover{background:#f3f4f6;}
</style></head>
<body>
  <div class="bar">
    <label for="who">Assignee</label>
    <select id="who"><option value="">My tasks</option><option value="all">Whole team</option></select>
    <button id="newBtn" class="mini-btn">+ New task</button>
    <button id="keyBtn" class="mini-btn">Edit key</button>
    <span id="status"></span>
  </div>
  <div id="legend"></div>
  <div id="keyEditor" class="editor" style="display:none;"></div>
  <div id="cal"></div>
<script>
  var Q = window.location.search;            // ?userId=...&k=...
  var P = new URLSearchParams(Q);
  var MY_ID = P.get("userId") || "";
  var userMap = {};                          // userId -> name, filled from /api/cal/users

  // ---- per-user color config (localStorage, keyed by the viewing user) ----
  var STORE_KEY = "taskcal_" + (MY_ID || "anon");
  function loadCfg(){
    try { var raw = localStorage.getItem(STORE_KEY); if(raw){ return JSON.parse(raw); } } catch(e){}
    return null;
  }
  var cfg = loadCfg() || { palette: [
    { label: "Urgent",    color: "#ef4444" },
    { label: "Follow-up", color: "#3b82f6" },
    { label: "Showing",   color: "#22c55e" },
    { label: "Admin",     color: "#f59e0b" }
  ], taskColors: {} };
  if(!cfg.palette) cfg.palette = [];
  if(!cfg.taskColors) cfg.taskColors = {};
  function saveCfg(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch(e){} }

  function setStatus(m){ document.getElementById("status").textContent = m || ""; }
  function apiQS(extra){
    var s = Q && Q.length ? Q : "";
    if(extra){ s += (s.indexOf("?")>=0 ? "&" : "?") + extra; }
    return s;
  }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]; }); }
  var who = document.getElementById("who");
  who.value = "";                            // default to the viewing user's tasks

  var calendar = new FullCalendar.Calendar(document.getElementById("cal"), {
    initialView: "dayGridMonth",
    timeZone: "local",
    height: "100%",
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" },
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    events: function(info, ok, fail){
      var sel = who.value;                   // "" => my id, "all" => team, else specific id
      var assignee = sel === "" ? MY_ID : sel;
      setStatus("Loading...");
      fetch("/api/cal/tasks" + apiQS("assignedTo=" + encodeURIComponent(assignee)))
        .then(function(r){ return r.json(); })
        .then(function(d){
          setStatus("");
          if(d.error){ setStatus("Error: " + (d.status||d.error)); ok([]); return; }
          var evs = d.events || [];
          evs.forEach(function(e){ var c = cfg.taskColors[e.id]; if(c){ e.backgroundColor = c; e.borderColor = c; } });
          ok(evs);
        })
        .catch(function(e){ setStatus("Network error"); fail(e); });
    },
    // Render each event as a checkbox + title. Checkbox completes; rest opens details.
    eventContent: function(arg){
      var wrap = document.createElement("div");
      wrap.className = "cal-evt";
      var box = document.createElement("span");
      box.className = "cal-chk";
      box.textContent = "☐";            // empty checkbox
      box.title = "Mark complete";
      box.addEventListener("click", function(ev){ ev.stopPropagation(); ev.preventDefault(); completeTask(arg.event); });
      var t = document.createElement("span");
      t.className = "cal-title";
      t.textContent = arg.event.title;
      wrap.appendChild(box); wrap.appendChild(t);
      return { domNodes: [wrap] };
    },
    eventClick: function(info){ info.jsEvent.preventDefault(); openDetails(info.event); },
    dateClick: function(info){ openCreate((info.dateStr || "").slice(0,10)); },
    eventDrop: function(info){ onDrop(info); }
  });
  calendar.render();

  who.addEventListener("change", function(){ calendar.refetchEvents(); });
  document.getElementById("newBtn").addEventListener("click", function(){ openCreate(todayStr()); });

  function todayStr(){ var d = new Date(); var m = ("0"+(d.getMonth()+1)).slice(-2); var day = ("0"+d.getDate()).slice(-2); return d.getFullYear()+"-"+m+"-"+day; }

  function openCreate(prefillDate){
    closeModal();
    var ov = document.createElement("div"); ov.id = "cal-modal";
    ov.addEventListener("click", function(e){ if(e.target === ov) closeModal(); });
    var card = document.createElement("div"); card.className = "card";
    card.innerHTML =
      "<div class='ttl'>New task</div>" +
      "<div class='fld'><label>Contact</label><input id='cQuery' placeholder='Search name, phone, or email' autocomplete='off'/><div id='cResults'></div></div>" +
      "<div class='fld'><label>Title</label><input id='tTitle' placeholder='e.g. Call about 901 4th St NE'/></div>" +
      "<div class='fld'><label>Due date</label><input id='tDue' type='date'/></div>" +
      "<div class='fld'><label>Assignee</label><select id='tWho'></select></div>" +
      "<div class='fld'><label>Notes (optional)</label><textarea id='tBody' rows='3'></textarea></div>";
    var row = document.createElement("div"); row.className = "row";
    var createBtn = document.createElement("button"); createBtn.className = "btn btn-create"; createBtn.textContent = "Create task";
    var cancelBtn = document.createElement("button"); cancelBtn.className = "btn btn-close"; cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeModal);
    row.appendChild(createBtn); row.appendChild(cancelBtn);
    card.appendChild(row); ov.appendChild(card); document.body.appendChild(ov);

    document.getElementById("tDue").value = prefillDate || todayStr();
    var sel = document.getElementById("tWho");
    var optU = document.createElement("option"); optU.value = ""; optU.textContent = "Unassigned"; sel.appendChild(optU);
    Object.keys(userMap).forEach(function(id){ var o = document.createElement("option"); o.value = id; o.textContent = userMap[id]; if(id === MY_ID) o.selected = true; sel.appendChild(o); });

    var selectedContact = null;
    var q = document.getElementById("cQuery");
    var resBox = document.getElementById("cResults");
    var tmr = null;
    q.addEventListener("input", function(){
      selectedContact = null;
      var term = q.value.trim();
      if(tmr) clearTimeout(tmr);
      if(term.length < 2){ resBox.style.display = "none"; resBox.innerHTML = ""; return; }
      tmr = setTimeout(function(){
        fetch("/api/cal/contacts/search" + apiQS("query=" + encodeURIComponent(term)))
          .then(function(r){ return r.json(); })
          .then(function(d){
            resBox.innerHTML = ""; var list = d.contacts || [];
            if(!list.length){ resBox.style.display = "none"; return; }
            list.forEach(function(c){
              var it = document.createElement("div"); it.className = "ci";
              var sub = [c.phone, c.email].filter(Boolean).join(" \\u00b7 ");
              it.innerHTML = "<div>" + esc(c.name) + "</div>" + (sub ? "<div style='font-size:12px;color:#6b7280'>" + esc(sub) + "</div>" : "");
              it.addEventListener("click", function(){ selectedContact = { id: c.id, name: c.name }; q.value = c.name; resBox.style.display = "none"; resBox.innerHTML = ""; });
              resBox.appendChild(it);
            });
            resBox.style.display = "block";
          }).catch(function(){ resBox.style.display = "none"; });
      }, 300);
    });

    createBtn.addEventListener("click", function(){
      var title = document.getElementById("tTitle").value.trim();
      var dStr = document.getElementById("tDue").value;
      var who2 = document.getElementById("tWho").value;
      var notes = document.getElementById("tBody").value;
      if(!selectedContact){ alert("Pick a contact from the search results."); return; }
      if(!title){ alert("Enter a task title."); return; }
      if(!dStr){ alert("Pick a due date."); return; }
      var due = new Date(dStr + "T12:00:00").toISOString();
      var payload = { contactId: selectedContact.id, title: title, dueDate: due, assignedTo: who2 || undefined, body: notes || undefined };
      createBtn.disabled = true; createBtn.textContent = "Creating...";
      fetch("/api/cal/task/create" + apiQS(), { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(payload) })
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
        .then(function(res){
          if(!res.ok){ createBtn.disabled = false; createBtn.textContent = "Create task"; alert("Could not create: " + JSON.stringify(res.j)); return; }
          closeModal(); calendar.refetchEvents(); setStatus("Task created");
          setTimeout(function(){ setStatus(""); }, 1500);
        })
        .catch(function(){ createBtn.disabled = false; createBtn.textContent = "Create task"; alert("Network error"); });
    });
  }

  // Populate the assignee dropdown + the userId->name map for the details popup
  fetch("/api/cal/users" + apiQS())
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d.users) return;
      d.users.forEach(function(u){
        userMap[u.id] = u.name;
        var o = document.createElement("option");
        o.value = u.id; o.textContent = u.name;
        who.appendChild(o);
      });
    }).catch(function(){});

  // ---- color key (legend + editor) ----
  function renderLegend(){
    var el = document.getElementById("legend");
    el.innerHTML = "";
    cfg.palette.forEach(function(p){
      var d = document.createElement("div"); d.className = "lg";
      var sw = document.createElement("span"); sw.className = "sw"; sw.style.background = p.color;
      var lb = document.createElement("span"); lb.textContent = p.label || "(unnamed)";
      d.appendChild(sw); d.appendChild(lb); el.appendChild(d);
    });
  }
  function renderKeyEditor(){
    var el = document.getElementById("keyEditor");
    el.innerHTML = "";
    cfg.palette.forEach(function(p, i){
      var row = document.createElement("div"); row.className = "erow";
      var col = document.createElement("input"); col.type = "color"; col.value = p.color;
      col.addEventListener("input", function(){ cfg.palette[i].color = col.value; saveCfg(); renderLegend(); });
      var txt = document.createElement("input"); txt.type = "text"; txt.value = p.label; txt.placeholder = "Label (e.g. Hot lead)";
      txt.addEventListener("input", function(){ cfg.palette[i].label = txt.value; saveCfg(); renderLegend(); });
      var del = document.createElement("button"); del.className = "del"; del.textContent = "Delete";
      del.addEventListener("click", function(){ cfg.palette.splice(i,1); saveCfg(); renderLegend(); renderKeyEditor(); });
      row.appendChild(col); row.appendChild(txt); row.appendChild(del); el.appendChild(row);
    });
    var add = document.createElement("button"); add.className = "add"; add.textContent = "+ Add color";
    add.addEventListener("click", function(){ cfg.palette.push({ label: "New", color: "#9ca3af" }); saveCfg(); renderLegend(); renderKeyEditor(); });
    el.appendChild(add);
  }
  document.getElementById("keyBtn").addEventListener("click", function(){
    var e = document.getElementById("keyEditor");
    var show = e.style.display === "none";
    e.style.display = show ? "block" : "none";
    document.getElementById("keyBtn").textContent = show ? "Done" : "Edit key";
    if(show) renderKeyEditor();
  });
  renderLegend();

  function setTaskColor(ev, color){
    if(color){ cfg.taskColors[ev.id] = color; ev.setProp("backgroundColor", color); ev.setProp("borderColor", color); }
    else { delete cfg.taskColors[ev.id]; ev.setProp("backgroundColor", ""); ev.setProp("borderColor", ""); }
    saveCfg();
  }

  function closeModal(){ var m = document.getElementById("cal-modal"); if(m) m.remove(); }

  function openDetails(ev){
    var p = ev.extendedProps || {};
    var name = userMap[p.assignedTo] || "";
    var due = p.dueDate ? new Date(p.dueDate).toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric", year:"numeric" }) : "";
    closeModal();
    var ov = document.createElement("div"); ov.id = "cal-modal";
    ov.addEventListener("click", function(e){ if(e.target === ov) closeModal(); });
    var card = document.createElement("div"); card.className = "card";
    var html = "";
    html += "<div class='ttl'>" + esc(ev.title) + "</div>";
    html += "<div id='cal-contact' class='contact'>Loading contact...</div>";
    if(p.body) html += "<div class='body'>" + esc(p.body) + "</div>";
    if(due)    html += "<div class='meta'>Due: " + esc(due) + "</div>";
    if(name)   html += "<div class='meta'>Assigned to: " + esc(name) + "</div>";
    card.innerHTML = html;

    // color picker row
    var lbl = document.createElement("div"); lbl.className = "lbl"; lbl.textContent = "Color";
    card.appendChild(lbl);
    var sw = document.createElement("div"); sw.className = "swatches";
    cfg.palette.forEach(function(pl){
      var s = document.createElement("div"); s.className = "swatch"; s.style.background = pl.color; s.title = pl.label;
      s.addEventListener("click", function(){ setTaskColor(ev, pl.color); refreshSwatchSelection(sw, pl.color); });
      sw.appendChild(s);
    });
    var custom = document.createElement("input"); custom.type = "color"; custom.title = "Custom color";
    custom.value = cfg.taskColors[ev.id] || "#3b82f6";
    custom.style.cssText = "width:28px;height:28px;border:1px solid #d1d5db;border-radius:5px;padding:0;cursor:pointer;";
    custom.addEventListener("input", function(){ setTaskColor(ev, custom.value); refreshSwatchSelection(sw, custom.value); });
    var clear = document.createElement("button"); clear.className = "btn btn-close"; clear.textContent = "Clear"; clear.style.padding = "4px 8px";
    clear.addEventListener("click", function(){ setTaskColor(ev, ""); refreshSwatchSelection(sw, null); });
    sw.appendChild(custom); sw.appendChild(clear);
    card.appendChild(sw);
    refreshSwatchSelection(sw, cfg.taskColors[ev.id] || null);

    var row = document.createElement("div"); row.className = "row";
    if(p.contactUrl){
      var openBtn = document.createElement("a");
      openBtn.className = "btn btn-open";
      openBtn.textContent = "Open contact in GHL ↗";
      openBtn.href = p.contactUrl; openBtn.target = "_blank"; openBtn.rel = "noopener";
      row.appendChild(openBtn);
    }
    var doneBtn = document.createElement("button");
    doneBtn.className = "btn btn-done"; doneBtn.textContent = "Mark complete";
    doneBtn.addEventListener("click", function(){ completeTask(ev); });
    row.appendChild(doneBtn);
    var closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-close"; closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", closeModal);
    row.appendChild(closeBtn);
    card.appendChild(row); ov.appendChild(card); document.body.appendChild(ov);
    loadContact(p.contactId);
  }

  function loadContact(contactId){
    var el = document.getElementById("cal-contact"); if(!el) return;
    if(!contactId){ el.textContent = "No contact linked to this task"; return; }
    fetch("/api/cal/contact" + apiQS("contactId=" + encodeURIComponent(contactId)))
      .then(function(r){ return r.json(); })
      .then(function(d){
        var c = d.contact;
        if(!c){ el.textContent = "Contact unavailable"; return; }
        var h = "";
        h += "<div class='c-name'>" + esc(c.name || "Unknown contact") + "</div>";
        if(c.companyName) h += "<div class='c-line'>" + esc(c.companyName) + "</div>";
        if(c.phone) h += "<div class='c-line'>Phone: <a href='tel:" + esc(c.phone) + "'>" + esc(c.phone) + "</a></div>";
        if(c.email) h += "<div class='c-line'>Email: <a href='mailto:" + esc(c.email) + "'>" + esc(c.email) + "</a></div>";
        if(!c.phone && !c.email) h += "<div class='c-line'>No phone or email on file</div>";
        el.innerHTML = h;
      })
      .catch(function(){ el.textContent = "Contact unavailable"; });
  }

  function refreshSwatchSelection(container, color){
    var nodes = container.querySelectorAll(".swatch");
    for(var i=0;i<nodes.length;i++){
      var match = color && nodes[i].style.background && color.toLowerCase() === rgbToHex(nodes[i].style.background);
      nodes[i].style.outline = match ? "3px solid #111" : "none";
      nodes[i].style.outlineOffset = "1px";
    }
  }
  function rgbToHex(s){
    if(!s) return "";
    if(s.charAt(0) === "#") return s.toLowerCase();
    var m = s.match(/\\d+/g); if(!m || m.length < 3) return s.toLowerCase();
    function h(n){ var x = parseInt(n,10).toString(16); return x.length===1 ? "0"+x : x; }
    return ("#" + h(m[0]) + h(m[1]) + h(m[2])).toLowerCase();
  }

  function completeTask(ev){
    var p = ev.extendedProps || {};
    if(!p.contactId){ alert("This task is not linked to a contact, so it cannot be updated from here."); return; }
    setStatus("Completing...");
    var body = { contactId: p.contactId, taskId: ev.id, completed: true };
    fetch("/api/cal/task" + apiQS(), { method:"PUT", headers:{"content-type":"application/json"}, body: JSON.stringify(body) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        if(!res.ok){ setStatus("Failed"); alert("Could not complete: " + JSON.stringify(res.j)); return; }
        ev.remove(); closeModal(); setStatus("Completed");
        setTimeout(function(){ setStatus(""); }, 1500);
      })
      .catch(function(){ setStatus("Failed"); });
  }

  function onDrop(info){
    var e = info.event;
    var props = e.extendedProps;
    if(!props.contactId){ alert("This task is not linked to a contact, so it cannot be rescheduled from here."); info.revert(); return; }
    // Keep the original time-of-day; only move the date to the dropped day.
    var orig = props.dueDate ? new Date(props.dueDate) : new Date(e.start);
    var nd = e.start;
    orig.setFullYear(nd.getFullYear(), nd.getMonth(), nd.getDate());
    var newDue = orig.toISOString();
    var body = { contactId: props.contactId, taskId: e.id, title: e.title, dueDate: newDue };
    e.setProp("classNames", ["saving"]);
    setStatus("Saving...");
    fetch("/api/cal/task" + apiQS(), { method:"PUT", headers:{"content-type":"application/json"}, body: JSON.stringify(body) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        e.setProp("classNames", []);
        if(!res.ok){ setStatus("Save failed"); alert("Reschedule failed: " + JSON.stringify(res.j)); info.revert(); return; }
        props.dueDate = newDue; setStatus("Saved");
        setTimeout(function(){ setStatus(""); }, 1500);
      })
      .catch(function(){ e.setProp("classNames", []); setStatus("Save failed"); info.revert(); });
  }
</script>
</body></html>`;
