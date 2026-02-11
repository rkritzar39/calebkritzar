/* =========================================================
   Caleb Kritzar Site JS
   - Theme toggle (ember/ocean/light) w/ localStorage
   - Mobile nav toggle
   - Business hours: timezone conversion + status banner + countdown
   - Hours table: highlights today
   - Copy hours + Add to Calendar (next opening)
   - Home: Hours Today badge
========================================================= */

/* -----------------------------
   Theme (ember/ocean/light)
----------------------------- */
(function themeInit(){
  const THEMES = ["ember", "ocean", "light"];
  const STORAGE_KEY = "ck_theme";

  function applyTheme(theme){
    const t = THEMES.includes(theme) ? theme : "ember";
    document.documentElement.setAttribute("data-theme", t === "ember" ? "" : t);
    // For default theme we keep attribute empty for cleaner DOM,
    // but still store the choice.
  }

  function getCurrentTheme(){
    const attr = document.documentElement.getAttribute("data-theme");
    if (!attr) return "ember";
    return attr;
  }

  function setTheme(theme){
    if (theme === "ember"){
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem(STORAGE_KEY, theme);
    updateThemeButton(theme);
  }

  function updateThemeButton(theme){
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    const label = btn.querySelector(".theme-label");
    if (!label) return;

    if (theme === "ember") label.textContent = "Theme: Ember";
    if (theme === "ocean") label.textContent = "Theme: Ocean";
    if (theme === "light") label.textContent = "Theme: Light";
  }

  // Init: apply saved theme
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved || "ember");

  // Set label on load
  updateThemeButton(saved || "ember");

  // Toggle cycle
  const btn = document.getElementById("themeToggle");
  if (btn){
    btn.addEventListener("click", () => {
      const current = getCurrentTheme();
      const idx = THEMES.indexOf(current);
      const next = THEMES[(idx + 1) % THEMES.length];
      setTheme(next);
    });
  }
})();

/* -----------------------------
   Mobile nav toggle
----------------------------- */
(function navToggle() {
  const btn = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });
})();

/* ==========================================
   Business Hours (America/New_York schedule)
   Mon–Sat 7:30 AM – 6:00 PM Eastern, Sun closed
   Displayed in visitor's local time zone
========================================== */
(function hoursModule() {
  const BUSINESS_TZ = 'America/New_York';

  // 0=Sun..6=Sat (JS)
  const schedule = {
    0: null,
    1: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } },
    2: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } },
    3: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } },
    4: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } },
    5: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } },
    6: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } },
  };

  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const userTZ = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Local time';

  function getParts(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return {
      y: Number(map.year),
      m: Number(map.month),
      d: Number(map.day),
      hh: Number(map.hour),
      mm: Number(map.minute),
    };
  }

  // Convert wall-clock time in IANA TZ to a real Date
  function zonedTimeToDate({ y, m, d, hh, mm }, timeZone) {
    const utcGuessMs = Date.UTC(y, m - 1, d, hh, mm, 0);
    const guessDate = new Date(utcGuessMs);

    const p = getParts(guessDate, timeZone);
    const guessAsIfUtcMs = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0);
    const desiredAsIfUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

    const offsetMs = guessAsIfUtcMs - utcGuessMs;
    const finalUtcMs = desiredAsIfUtcMs - offsetMs;

    return new Date(finalUtcMs);
  }

  function formatTimeRangeInUserTZ(openDateUtc, closeDateUtc) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: userTZ,
      hour: 'numeric',
      minute: '2-digit'
    });
    return `${fmt.format(openDateUtc)} – ${fmt.format(closeDateUtc)}`;
  }

  function formatDateTimeInUserTZ(dateUtc) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: userTZ,
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    return fmt.format(dateUtc);
  }

  function formatTimeInUserTZ(dateUtc){
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: userTZ,
      hour: 'numeric',
      minute: '2-digit'
    });
    return fmt.format(dateUtc);
  }

  function getNYWeekdayIndex(dateObj = new Date()) {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'long' }).format(dateObj);
    return weekdayNames.indexOf(wd);
  }

  function getNYTodayParts(dateObj = new Date()){
    return getParts(dateObj, BUSINESS_TZ);
  }

  function getNextOccurrenceDatePartsForWeekday(targetWday) {
    const now = new Date();
    const ny = getParts(now, BUSINESS_TZ);
    const currentWday = getNYWeekdayIndex(now);

    let delta = targetWday - currentWday;
    if (delta < 0) delta += 7;

    const nyMidnightUtc = zonedTimeToDate({ y: ny.y, m: ny.m, d: ny.d, hh: 0, mm: 0 }, BUSINESS_TZ);
    const targetUtc = new Date(nyMidnightUtc.getTime() + delta * 24 * 60 * 60 * 1000);

    return getParts(targetUtc, BUSINESS_TZ);
  }

  function computeTodayOpenCloseUtc(now = new Date()){
    const nyWday = getNYWeekdayIndex(now);
    const nyNow = getNYTodayParts(now);
    const ruleToday = schedule[nyWday];

    if (!ruleToday) return { openUtc: null, closeUtc: null, nyWday };

    const openUtc = zonedTimeToDate(
      { y: nyNow.y, m: nyNow.m, d: nyNow.d, hh: ruleToday.open.h, mm: ruleToday.open.m },
      BUSINESS_TZ
    );
    const closeUtc = zonedTimeToDate(
      { y: nyNow.y, m: nyNow.m, d: nyNow.d, hh: ruleToday.close.h, mm: ruleToday.close.m },
      BUSINESS_TZ
    );

    return { openUtc, closeUtc, nyWday };
  }

  function isOpenNow(now = new Date()){
    const { openUtc, closeUtc, nyWday } = computeTodayOpenCloseUtc(now);
    if (!openUtc || !closeUtc) return { isOpen: false, openUtc: null, closeUtc: null, nyWday };
    return { isOpen: now >= openUtc && now < closeUtc, openUtc, closeUtc, nyWday };
  }

  function findNextOpeningUtc(now = new Date()){
    // scan up to 8 days
    for (let i = 0; i < 8; i++){
      const probe = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const probeNY = getParts(probe, BUSINESS_TZ);
      const probeWday = getNYWeekdayIndex(probe);
      const rule = schedule[probeWday];
      if (!rule) continue;

      const openUtc = zonedTimeToDate(
        { y: probeNY.y, m: probeNY.m, d: probeNY.d, hh: rule.open.h, mm: rule.open.m },
        BUSINESS_TZ
      );
      if (openUtc > now) return openUtc;
    }
    return null;
  }

  function msToCountdown(ms){
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /* -----------------------------
     Home badge
  ----------------------------- */
  function updateHomeBadge(){
    const badge = document.getElementById('hoursBadge');
    if (!badge) return;

    const main = document.getElementById('hoursBadgeMain');
    const sub = document.getElementById('hoursBadgeSub');
    const dot = document.getElementById('hoursDot');

    const now = new Date();
    const openInfo = isOpenNow(now);

    // Determine today's range (if open today)
    if (openInfo.openUtc && openInfo.closeUtc){
      main.textContent = formatTimeRangeInUserTZ(openInfo.openUtc, openInfo.closeUtc);
    } else {
      main.textContent = 'Closed today';
    }

    if (openInfo.isOpen){
      dot.classList.add('open');
      dot.classList.remove('closed');
      sub.textContent = `Open now • Closes at ${formatTimeInUserTZ(openInfo.closeUtc)} (${userTZ})`;
    } else {
      dot.classList.add('closed');
      dot.classList.remove('open');
      const nextOpen = findNextOpeningUtc(now);
      sub.textContent = nextOpen
        ? `Closed now • Next open: ${formatDateTimeInUserTZ(nextOpen)}`
        : `Closed now • See Business page`;
    }
  }

  /* -----------------------------
     Business page UI
  ----------------------------- */
  function initBusinessPage(){
    const tableWrap = document.getElementById('hoursTableWrap');
    if (!tableWrap) return;

    const userTzPill = document.getElementById('userTzPill');
    const openStatus = document.getElementById('openStatus');
    const nextOpenEl = document.getElementById('nextOpen');

    const bannerTitle = document.getElementById('bannerTitle');
    const bannerSub = document.getElementById('bannerSub');
    const statusDot = document.getElementById('statusDot');

    const copyBtn = document.getElementById('copyHoursBtn');
    const calBtn = document.getElementById('addCalendarBtn');

    userTzPill.textContent = `Shown in your time zone: ${userTZ} • Schedule set in Eastern Time`;

    function buildTable(){
      const now = new Date();
      const todayNY = getNYWeekdayIndex(now);

      const rows = [];
      for (let wday = 0; wday <= 6; wday++){
        const name = weekdayNames[wday];
        const rule = schedule[wday];

        if (!rule){
          rows.push(`
            <tr class="${wday === todayNY ? "today-row" : ""}">
              <td class="day-col">${name}</td>
              <td class="time-col muted">Closed</td>
            </tr>
          `);
          continue;
        }

        const occ = getNextOccurrenceDatePartsForWeekday(wday);
        const openUtc = zonedTimeToDate({ y: occ.y, m: occ.m, d: occ.d, hh: rule.open.h, mm: rule.open.m }, BUSINESS_TZ);
        const closeUtc = zonedTimeToDate({ y: occ.y, m: occ.m, d: occ.d, hh: rule.close.h, mm: rule.close.m }, BUSINESS_TZ);

        const range = formatTimeRangeInUserTZ(openUtc, closeUtc);
        rows.push(`
          <tr class="${wday === todayNY ? "today-row" : ""}">
            <td class="day-col">${name}</td>
            <td class="time-col">${range}</td>
          </tr>
        `);
      }

      tableWrap.innerHTML = `
        <table class="hours-table" role="table" aria-label="Business hours">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Hours (your local time)</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      `;
    }

    function updateStatus(){
      const now = new Date();
      const openInfo = isOpenNow(now);

      if (openInfo.isOpen){
        openStatus.innerHTML = `Status: <span class="status-open">Open</span>`;
        const closesIn = msToCountdown(openInfo.closeUtc - now);

        statusDot?.classList.add('open');
        statusDot?.classList.remove('closed');

        if (bannerTitle) bannerTitle.textContent = `Open — closes in ${closesIn}`;
        if (bannerSub) bannerSub.textContent = `Closes at ${formatDateTimeInUserTZ(openInfo.closeUtc)}`;

        nextOpenEl.textContent = '';
      } else {
        openStatus.innerHTML = `Status: <span class="status-closed">Closed</span>`;

        statusDot?.classList.add('closed');
        statusDot?.classList.remove('open');

        const nextOpen = findNextOpeningUtc(now);
        if (nextOpen){
          const opensIn = msToCountdown(nextOpen - now);
          if (bannerTitle) bannerTitle.textContent = `Closed — opens in ${opensIn}`;
          if (bannerSub) bannerSub.textContent = `Next opening: ${formatDateTimeInUserTZ(nextOpen)}`;
          nextOpenEl.innerHTML = `Next opening: <strong>${formatDateTimeInUserTZ(nextOpen)}</strong>`;
        } else {
          if (bannerTitle) bannerTitle.textContent = `Closed`;
          if (bannerSub) bannerSub.textContent = `Next opening unavailable`;
          nextOpenEl.textContent = 'Next opening: unavailable';
        }
      }
    }

    function buildCopyText(){
      // Simple, clear copy (ET)
      return [
        "Business Hours (Eastern Time):",
        "Mon–Sat: 7:30 AM – 6:00 PM",
        "Sun: Closed"
      ].join("\n");
    }

    async function handleCopy(){
      const text = buildCopyText();
      try{
        await navigator.clipboard.writeText(text);
        if (bannerSub) bannerSub.textContent = "Copied hours to clipboard ✅";
        setTimeout(updateStatus, 1200);
      } catch (e){
        // fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        if (bannerSub) bannerSub.textContent = "Copied hours to clipboard ✅";
        setTimeout(updateStatus, 1200);
      }
    }

    function downloadICS(){
      const now = new Date();
      const nextOpen = findNextOpeningUtc(now);
      if (!nextOpen){
        if (bannerSub) bannerSub.textContent = "No next opening found.";
        return;
      }

      // Create a 30-minute reminder event starting at next open time
      const start = new Date(nextOpen.getTime());
      const end = new Date(nextOpen.getTime() + 30 * 60 * 1000);

      function toICSDate(d){
        // UTC format: YYYYMMDDTHHMMSSZ
        const pad = (n) => String(n).padStart(2, "0");
        return (
          d.getUTCFullYear() +
          pad(d.getUTCMonth()+1) +
          pad(d.getUTCDate()) + "T" +
          pad(d.getUTCHours()) +
          pad(d.getUTCMinutes()) +
          pad(d.getUTCSeconds()) + "Z"
        );
      }

      const uid = `ck-hours-${Date.now()}@busarmydude.org`;
      const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Caleb Kritzar//Business Hours//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${toICSDate(new Date())}
DTSTART:${toICSDate(start)}
DTEND:${toICSDate(end)}
SUMMARY:Caleb’s Business Opens
DESCRIPTION:Next opening time (shown in your time zone on the website).
END:VEVENT
END:VCALENDAR`;

      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "caleb-business-next-opening.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (bannerSub) bannerSub.textContent = "Downloaded calendar file ✅";
      setTimeout(updateStatus, 1200);
    }

    copyBtn?.addEventListener("click", handleCopy);
    calBtn?.addEventListener("click", downloadICS);

    buildTable();
    updateStatus();
    setInterval(() => {
      updateStatus();
      // keep "today highlight" correct if user keeps page open across midnight NY time
      buildTable();
    }, 30 * 1000);
  }

  // Run
  updateHomeBadge();
  initBusinessPage();
  setInterval(updateHomeBadge, 30 * 1000);
})();
