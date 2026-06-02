// src/calendar-page.ts
// -----------------------------------------------------------------------------
// Static HTML for the GHL Task Calendar widget, served at GET /calendar.
// Same-origin with the /api/cal/* routes, so there is no CORS to deal with.
// FullCalendar loads from CDN — no build step, no extra dependency.
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
  body{margin:0;padding:12px;background:#fff;color:#1f2937;}
  .bar{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}
  .bar label{font-size:13px;color:#6b7280;}
  select{padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;}
  #status{font-size:12px;color:#9ca3af;margin-left:auto;}
  #cal{width:100%;}
  .fc .fc-button-primary{background:#2563eb;border-color:#2563eb;}
  .fc .fc-button-primary:hover{background:#1d4ed8;border-color:#1d4ed8;}
  .fc-event{cursor:grab;font-size:12px;}
  .fc-event.saving{opacity:.5;}
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
  function setStatus(m){ document.getElementById("status").textContent = m || ""; }
  function apiQS(extra){
    var s = Q && Q.length ? Q : "";
    if(extra){ s += (s.indexOf("?")>=0 ? "&" : "?") + extra; }
    return s;
  }
  var who = document.getElementById("who");
  who.value = "";                            // default to the viewing user's tasks

  var calendar = new FullCalendar.Calendar(document.getElementById("cal"), {
    initialView: "dayGridMonth",
    timeZone: "local",
    height: "auto",
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
    eventDrop: function(info){ onDrop(info); }
  });
  calendar.render();

  who.addEventListener("change", function(){ calendar.refetchEvents(); });

  // Populate the assignee dropdown with the team
  fetch("/api/cal/users" + apiQS())
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d.users) return;
      d.users.forEach(function(u){
        var o = document.createElement("option");
        o.value = u.id; o.textContent = u.name;
        who.appendChild(o);
      });
    }).catch(function(){});

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
