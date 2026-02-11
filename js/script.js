/* =========================
   Smooth scrolling (anchors)
========================= */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ==========================================
   Business Hours (America/New_York schedule)
   Mon–Sat 7:30 AM – 6:00 PM Eastern
   Displayed in visitor's local time zone
========================================== */
(function initBusinessHours() {
  const tableWrap = document.getElementById('hoursTableWrap');
  if (!tableWrap) return; // Only runs on business page

  const userTzPill = document.getElementById('userTzPill');
  const openStatus = document.getElementById('openStatus');
  const nextOpen = document.getElementById('nextOpen');

  const BUSINESS_TZ = 'America/New_York';

  // 0=Sun..6=Sat (JS), schedule is Mon-Sat open
  const schedule = {
    0: null, // Sunday closed
    1: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } }, // Monday
    2: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } }, // Tuesday
    3: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } }, // Wednesday
    4: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } }, // Thursday
    5: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } }, // Friday
    6: { open: { h: 7, m: 30 }, close: { h: 18, m: 0 } }, // Saturday
  };

  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const userTZ =
    (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Local time';
  userTzPill.textContent = `Your time zone: ${userTZ}`;

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

  // Convert a wall-clock time in a given IANA TZ to a real Date (UTC instant).
  // This handles DST correctly because it relies on Intl timeZone rules.
  function zonedTimeToDate({ y, m, d, hh, mm }, timeZone) {
    // Start with a UTC guess at the same components
    const utcGuessMs = Date.UTC(y, m - 1, d, hh, mm, 0);
    const guessDate = new Date(utcGuessMs);

    // What wall-clock time is that guess *in the target zone*?
    const p = getParts(guessDate, timeZone);

    // Compute how far off the guess is, as if both were UTC component timestamps
    const guessAsIfUtcMs = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0);
    const desiredAsIfUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

    // Adjust by the observed offset
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

  function getNYNowParts() {
    return getParts(new Date(), BUSINESS_TZ);
  }

  function getNYWeekdayIndexNow() {
    // Determine weekday index in NY by formatting weekday
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'long' }).format(new Date());
    return weekdayNames.indexOf(wd);
  }

  function getNextOccurrenceDatePartsForWeekday(targetWday) {
    // Build a date "today in NY", then offset days to reach target weekday
    const now = new Date();
    const ny = getParts(now, BUSINESS_TZ);
    const currentWday = getNYWeekdayIndexNow();

    let delta = targetWday - currentWday;
    if (delta < 0) delta += 7;

    // Create a UTC date at NY midnight for the current NY date, then add delta days.
    const nyMidnightUtc = zonedTimeToDate({ y: ny.y, m: ny.m, d: ny.d, hh: 0, mm: 0 }, BUSINESS_TZ);
    const targetUtc = new Date(nyMidnightUtc.getTime() + delta * 24 * 60 * 60 * 1000);

    // Return the calendar date parts *in NY* for that target day
    return getParts(targetUtc, BUSINESS_TZ);
  }

  function buildHoursTable() {
    const rows = [];

    for (let wday = 0; wday <= 6; wday++) {
      const dayName = weekdayNames[wday];
      const rule = schedule[wday];

      if (!rule) {
        rows.push(`
          <tr>
            <td class="day-col">${dayName}</td>
            <td class="time-col muted">Closed</td>
          </tr>
        `);
        continue;
      }

      const occ = getNextOccurrenceDatePartsForWeekday(wday);

      const openUtc = zonedTimeToDate(
        { y: occ.y, m: occ.m, d: occ.d, hh: rule.open.h, mm: rule.open.m },
        BUSINESS_TZ
      );

      const closeUtc = zonedTimeToDate(
        { y: occ.y, m: occ.m, d: occ.d, hh: rule.close.h, mm: rule.close.m },
        BUSINESS_TZ
      );

      const timeRange = formatTimeRangeInUserTZ(openUtc, closeUtc);

      rows.push(`
        <tr>
          <td class="day-col">${dayName}</td>
          <td class="time-col">${timeRange}</td>
        </tr>
      `);
    }

    tableWrap.innerHTML = `
      <table class="hours-table" role="table" aria-label="Business hours table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Hours (your local time)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    `;
  }

  function computeOpenStatusAndNextOpen() {
    const now = new Date();
    const nyWday = getNYWeekdayIndexNow();
    const nyNow = getParts(now, BUSINESS_TZ);

    const ruleToday = schedule[nyWday];

    let isOpen = false;
    let closesAtUtc = null;

    if (ruleToday) {
      const openUtc = zonedTimeToDate(
        { y: nyNow.y, m: nyNow.m, d: nyNow.d, hh: ruleToday.open.h, mm: ruleToday.open.m },
        BUSINESS_TZ
      );

      const closeUtc = zonedTimeToDate(
        { y: nyNow.y, m: nyNow.m, d: nyNow.d, hh: ruleToday.close.h, mm: ruleToday.close.m },
        BUSINESS_TZ
      );

      if (now >= openUtc && now < closeUtc) {
        isOpen = true;
        closesAtUtc = closeUtc;
      }
    }

    if (isOpen) {
      openStatus.innerHTML = `Status: <span class="status-open">Open</span> — closes at <strong>${formatDateTimeInUserTZ(closesAtUtc)}</strong>`;
      nextOpen.textContent = '';
      return;
    }

    openStatus.innerHTML = `Status: <span class="status-closed">Closed</span>`;

    // Find next opening (scan next 8 days to be safe)
    for (let i = 0; i < 8; i++) {
      const probeUtc = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const probeNY = getParts(probeUtc, BUSINESS_TZ);
      const probeWdayName = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'long' }).format(probeUtc);
      const probeWday = weekdayNames.indexOf(probeWdayName);

      const rule = schedule[probeWday];
      if (!rule) continue;

      const openUtc = zonedTimeToDate(
        { y: probeNY.y, m: probeNY.m, d: probeNY.d, hh: rule.open.h, mm: rule.open.m },
        BUSINESS_TZ
      );

      // If it's today, only count if opening time is in the future
      if (openUtc > now) {
        nextOpen.innerHTML = `Next opening: <strong>${formatDateTimeInUserTZ(openUtc)}</strong>`;
        return;
      }
    }

    nextOpen.textContent = 'Next opening: unavailable';
  }

  buildHoursTable();
  computeOpenStatusAndNextOpen();

  // Keep status fresh
  setInterval(computeOpenStatusAndNextOpen, 30 * 1000);
})();
