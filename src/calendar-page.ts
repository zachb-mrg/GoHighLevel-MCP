// src/calendar-page.ts
// -----------------------------------------------------------------------------
// Static HTML for the GHL Task Calendar widget, served at GET /calendar.
// Same-origin with the /api/cal/* routes, so there is no CORS to deal with.
// FullCalendar loads from CDN — no build step, no extra dependency.
//
// Features: day/week/month views, assignee filter, drag-to-reschedule,
// inline checkbox to mark complete, and click-a-task for details + a link
// to open the associated contact in GHL.
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
  #cal-modal .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}
  #cal-modal a.btn,#cal-modal button.btn{border:0;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:14px;text-decoration:none;}
  #cal-modal .btn-open{background:#2563eb;color:#fff;}
  #cal-modal .btn-done{background:#16a34a;color:#fff;}
  #cal-modal .btn-close{background:#e5e7eb;color:#111;}
</style></head>
<body>
  <div class="bar">
    <label for="who">Assignee</label>
    <select id="who"><option value="">My tasks</option><option value="all">Whole team</option></select>
    <span id="status"></span>
  </div>
  <div id="cal"></div>
<script>
  var Q = window.location.search;            // ?userId=...&k=...
  var P = new URLSearchParams(Q);
  var MY_ID = P.get("userId") || "";
  var userMap = {};                          // userId -> name, filled from /api/cal/users
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
        .then(function(d){ setStatus(""); if(d.error){ setStatus("Error: " + (d.status||d.error)); ok([]); } else { ok(d.events||[]); } })
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
    eventDrop: function(info){ onDrop(info); }
  });
  calendar.render();

  who.addEventListener("change", function(){ calendar.refetchEvents(); });

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
    if(p.body) html += "<div class='body'>" + esc(p.body) + "</div>";
    if(due)    html += "<div class='meta'>Due: " + esc(due) + "</div>";
    if(name)   html += "<div class='meta'>Assigned to: " + esc(name) + "</div>";
    card.innerHTML = html;
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
