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

/* =========================
   Mobile nav toggle
========================= */
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
   Mon–Sat 7:30 AM – 6:00 PM Eastern
   Displayed in visitor's local time zone
========================================== */
(function initBusinessHoursAndHomeBadge() {
  const BUSINESS_TZ = 'America/New_York';

  // 0=Sun..6=Sat (JS)
  const schedule = {
    0: null, // Sunday closed
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

  function getNYWeekdayIndexNow() {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'long' }).format(new Date());
    return weekdayNames.indexOf(wd);
  }

  function getNextOccurrenceDatePartsForWeekday(targetWday) {
    const now = new Date();
    const ny = getParts(now, BUSINESS_TZ);
    const currentWday = getNYWeekdayIndexNow();

    let delta = targetWday - currentWday;
    if (delta < 0) delta += 7;

    const nyMidnightUtc = zonedTimeToDate({ y: ny.y, m: ny.m, d: ny.d, hh: 0, mm: 0 }, BUSINESS_TZ);
    const targetUtc = new Date(nyMidnightUtc.getTime() + delta * 24 * 60 * 60 * 1000);

    return getParts(targetUtc, BUSINESS_TZ);
  }

  function computeOpenNow() {
    const now = new Date();
    const nyWday = getNYWeekdayIndexNow();
    const nyNow = getParts(now, BUSINESS_TZ);
    const ruleToday = schedule[nyWday];

    if (!ruleToday) {
      return { isOpen: false, closesAtUtc: null, opensAtUtc: null, todayRange: null };
    }

    const openUtc = zonedTimeToDate(
      { y: nyNow.y, m: nyNow.m, d: nyNow.d, hh: ruleToday.open.h, mm: ruleToday.open.m },
      BUSINESS_TZ
    );

    const closeUtc = zonedTimeToDate(
      { y: nyNow.y, m: nyNow.m, d: nyNow.d, hh: ruleToday.close.h, mm: ruleToday.close.m },
      BUSINESS_TZ
    );

    const isOpen = now >= openUtc && now < closeUtc;

    return {
      isOpen,
      closesAtUtc: isOpen ? closeUtc : null,
      opensAtUtc: !isOpen ? openUtc : null,
      todayRange: formatTimeRangeInUserTZ(openUtc, closeUtc)
    };
  }

  function findNextOpening() {
    const now = new Date();

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

      if (openUtc > now) return openUtc;
    }

    return null;
  }

  /* =========================
     Home page "Hours Today" badge
  ========================= */
  function updateHomeBadge() {
    const badge = document.getElementById('hoursBadge');
    if (!badge) return;

    const main = document.getElementById('hoursBadgeMain');
    const sub = document.getElementById('hoursBadgeSub');
    const dot = document.getElementById('hoursDot');

    const nowInfo = computeOpenNow();
    const nextOpenUtc = findNextOpening();

    if (nowInfo.todayRange) {
      main.textContent = nowInfo.todayRange;
    } else {
      main.textContent = 'Closed today';
    }

    sub.textContent = `Your time zone: ${userTZ}`;

    if (nowInfo.isOpen) {
      dot.classList.add('open');
      dot.classList.remove('closed');
      if (nowInfo.closesAtUtc) {
        const closesShort = new Intl.DateTimeFormat('en-US', {
          timeZone: userTZ,
          hour: 'numeric',
          minute: '2-digit'
        }).format(nowInfo.closesAtUtc);

        sub.textContent = `Open now • Closes at ${closesShort} (${userTZ})`;
      }
    } else {
      dot.classList.add('closed');
      dot.classList.remove('open');

      if (nextOpenUtc) {
        sub.textContent = `Closed now • Next open: ${formatDateTimeInUserTZ(nextOpenUtc)}`;
      } else {
        sub.textContent = `Closed now • Check Business page for details`;
      }
    }
  }

  /* =========================
     Business page table + status
  ========================= */
  function initBusinessPage() {
    const tableWrap = document.getElementById('hoursTableWrap');
    if (!tableWrap) return;

    const userTzPill = document.getElementById('userTzPill');
    const openStatus = document.getElementById('openStatus');
    const nextOpen = document.getElementById('nextOpen');

    userTzPill.textContent = `Your time zone: ${userTZ}`;

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

    function updateStatus() {
      const nowInfo = computeOpenNow();

      if (nowInfo.isOpen) {
        openStatus.innerHTML = `Status: <span class="status-open">Open</span> — closes at <strong>${formatDateTimeInUserTZ(nowInfo.closesAtUtc)}</strong>`;
        nextOpen.textContent = '';
        return;
      }

      openStatus.innerHTML = `Status: <span class="status-closed">Closed</span>`;

      const nextOpenUtc = findNextOpening();
      if (nextOpenUtc) {
        nextOpen.innerHTML = `Next opening: <strong>${formatDateTimeInUserTZ(nextOpenUtc)}</strong>`;
      } else {
        nextOpen.textContent = 'Next opening: unavailable';
      }
    }

    buildHoursTable();
    updateStatus();
    setInterval(updateStatus, 30 * 1000);
  }

  // Run both (each checks for needed elements)
  updateHomeBadge();
  initBusinessPage();

  // Keep the home badge updated too
  setInterval(updateHomeBadge, 30 * 1000);
})();
