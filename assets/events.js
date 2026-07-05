document.addEventListener('DOMContentLoaded', function () {
  /** =========================
   * EVENTS DATA
   * ========================= */
  const container = document.getElementById('event-list');
  const holyCommunionContainer = document.getElementById('holy-communion-list');
  const sliderContainer = document.querySelector('.blessed-event-slider .swiper-wrapper');
  const categoryButtons = document.querySelectorAll('.btn-tag-outline');
  const EVENTS_PER_PAGE = 4;

  let events = [];
  let currentPage = 1;
  let currentCategory = null;
  let sliderInstance = null;
  const defaultEventTimeZone = 'Africa/Harare';
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const preferredTimeZones = [
    browserTimeZone,
    defaultEventTimeZone,
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Nairobi',
    'Europe/London',
    'Europe/Paris',
    'Asia/Kolkata',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'UTC',
  ];
  const fallbackTimeZones = [
    browserTimeZone,
    'Africa/Harare',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Nairobi',
    'Europe/London',
    'Europe/Paris',
    'Asia/Kolkata',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'UTC',
  ];
  let selectedTimeZone = localStorage.getItem('preferredEventTimeZone') || browserTimeZone;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function getSupportedTimeZones() {
    const supportedTimeZones = typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : fallbackTimeZones;

    const timeZones = [...new Set([...preferredTimeZones, ...supportedTimeZones])]
      .filter(Boolean)
      .sort((a, b) => {
        const aIndex = preferredTimeZones.indexOf(a);
        const bIndex = preferredTimeZones.indexOf(b);

        if (aIndex !== -1 || bIndex !== -1) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }

        return a.localeCompare(b);
      });

    if (!timeZones.includes(selectedTimeZone)) {
      timeZones.unshift(selectedTimeZone);
    }

    return timeZones;
  }

  function getTimeZoneLabel(timeZone) {
    if (timeZone === browserTimeZone) return `${timeZone} (your local time)`;
    if (timeZone === defaultEventTimeZone) return `${timeZone} (church default)`;

    return timeZone.replace(/_/g, ' ');
  }

  function getTimeZoneOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const utcLike = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    return utcLike - date.getTime();
  }

  function zonedDateTimeToUtc(dateValue, timeValue, timeZone) {
    if (!dateValue || !timeValue || !timeZone) return '';

    const [year, month, day] = dateValue.split('-').map(Number);
    const [hour, minute] = timeValue.split(':').map(Number);
    const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offset = getTimeZoneOffsetMs(baseUtc, timeZone);
    const candidate = new Date(baseUtc.getTime() - offset);
    const correctedOffset = getTimeZoneOffsetMs(candidate, timeZone);

    return new Date(baseUtc.getTime() - correctedOffset).toISOString();
  }

  function toTimeInputValue(hour, minute, meridiem) {
    let normalizedHour = Number(hour);
    const normalizedMeridiem = meridiem.toUpperCase();

    if (normalizedMeridiem === 'PM' && normalizedHour !== 12) normalizedHour += 12;
    if (normalizedMeridiem === 'AM' && normalizedHour === 12) normalizedHour = 0;

    return `${String(normalizedHour).padStart(2, '0')}:${minute}`;
  }

  function parseLegacyEventTimes(event) {
    const match = String(event.time || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)(?:\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M))?/i);
    if (!match || !event.date) return { startAt: '', endAt: '' };

    const timeZone = event.timezone || defaultEventTimeZone;
    const startTime = toTimeInputValue(match[1], match[2], match[3]);
    const endTime = match[4] ? toTimeInputValue(match[4], match[5], match[6]) : '';

    return {
      startAt: zonedDateTimeToUtc(event.date, startTime, timeZone),
      endAt: endTime ? zonedDateTimeToUtc(event.end_date || event.date, endTime, timeZone) : '',
    };
  }

  function formatEventTime(event) {
    const legacyTimes = parseLegacyEventTimes(event);
    const startAt = event.start_at || event.startAt || legacyTimes.startAt;
    const endAt = event.end_at || event.endAt || legacyTimes.endAt;
    if (!startAt) return event.time || '';

    const options = {
      timeZone: selectedTimeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    };
    const start = new Intl.DateTimeFormat(undefined, options).format(new Date(startAt));
    const end = endAt ? new Intl.DateTimeFormat(undefined, options).format(new Date(endAt)) : '';

    return end ? `${start} - ${end}` : start;
  }

  function renderTimeZoneSelector() {
    if (document.getElementById('event-timezone-control')) return;

    const anchor = container || holyCommunionContainer || sliderContainer;
    if (!anchor || !anchor.parentElement) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'event-timezone-control';
    wrapper.className = 'event-timezone-control d-flex flex-wrap justify-content-end align-items-center gap-2 mb-4';
    wrapper.innerHTML = `
      <label for="event-timezone-select" class="fs-8 mb-0">Event times shown in</label>
      <select id="event-timezone-select" class="form-select form-select-sm w-auto">
        ${getSupportedTimeZones().map(timeZone => `
          <option value="${escapeHtml(timeZone)}" ${timeZone === selectedTimeZone ? 'selected' : ''}>
            ${escapeHtml(getTimeZoneLabel(timeZone))}
          </option>
        `).join('')}
      </select>
    `;

    anchor.parentElement.insertBefore(wrapper, anchor);
    wrapper.querySelector('select').addEventListener('change', event => {
      selectedTimeZone = event.target.value;
      localStorage.setItem('preferredEventTimeZone', selectedTimeZone);
      renderEvents(currentCategory);
      renderHolyCommunion();
      renderSlider();
    });
  }

  const normalizeEventsPayload = (payload) => {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  };

  const fetchEvents = async () => {
    const sources = ['/api/events', '/data/events.json', 'data/events.json'];
    for (const source of sources) {
      try {
        const res = await fetch(source);
        if (!res.ok) {
          continue;
        }
        const payload = await res.json();
        const normalized = normalizeEventsPayload(payload);
        if (normalized.length > 0) {
          return normalized;
        }
      } catch {
      }
    }

    try {
      return JSON.parse(localStorage.getItem('events')) || [];
    } catch {
      return [];
    }
  };

  // Fetch Events with fallback
  fetchEvents()
    .then(data => {
      events = data.sort((a, b) => new Date(a.date) - new Date(b.date));
      localStorage.setItem('events', JSON.stringify(events));
      renderTimeZoneSelector();
      renderEvents();
      renderHolyCommunion();
      renderSlider();
    })
    .catch(err => console.error('Failed to load events:', err));

  // Paginate Events
  function paginate(eventsArray, page) {
    const start = (page - 1) * EVENTS_PER_PAGE;
    return eventsArray.slice(start, start + EVENTS_PER_PAGE);
  }

  // Render Pagination
  function renderPagination(filteredEvents) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let html = `
      <li class="page-item text-center fs-6 pe-2">
        <a class="page-link size-48" href="javascript:" id="prev-page">
          <i data-feather="arrow-left" class="size-12"></i>
        </a>
      </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
      html += `
        <li class="page-item text-center fs-6 pe-2 ${i === currentPage ? 'active' : ''}">
          <a class="page-link size-48" href="javascript:" data-page="${i}">${i}</a>
        </li>
      `;
    }

    html += `
      <li class="page-item text-center fs-6 pe-2">
        <a class="page-link size-48" href="javascript:" id="next-page">
          <i data-feather="arrow-right" class="size-12"></i>
        </a>
      </li>
    `;

    paginationContainer.innerHTML = html;

    // Add event listeners
    document.querySelectorAll('.page-link[data-page]').forEach(link => {
      link.addEventListener('click', () => {
        currentPage = parseInt(link.dataset.page);
        renderEvents(currentCategory);
      });
    });

    document.getElementById('prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderEvents(currentCategory);
      }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderEvents(currentCategory);
      }
    });
  }

  // Render Main Event List
  function renderEvents(filterCategory = null) {
    currentCategory = filterCategory;
    if (!container) return;

    const filtered = filterCategory ? events.filter(e => e.category === filterCategory) : events;
    const paginated = paginate(filtered, currentPage);

    container.innerHTML = paginated.map(event => `
      <div class="col-lg-6 d-flex mb-4" data-category="${event.category}">
        <div class="position-relative w-100 event-card-1 hover-up d-flex flex-column justify-content-between">
          <div class="content-event rounded p-3 d-flex flex-column h-100">
            <span class="badge bg-primary mb-2">${event.category}</span>
            <h4 class="mt-2 fw-medium">
              <a href="/event-details?id=${event.id}">${event.title}</a>
            </h4>
            <p class="content-p pb-2">${event.description}</p>
            <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between">
              <div class="times mb-2">
                <p class="time fs-8 mb-1"><i data-feather="clock" class="size-12"></i> <span>${formatEventTime(event)}</span></p>
                <p class="location fs-8"><i data-feather="map-pin" class="size-12"></i> <span>${event.location}</span></p>
              </div>
              <div class="button mb-2">
                <a href="/event-details?id=${event.id}" class="d-inline-flex rounded-5 tc-btn-md fs-8 text-center">
                  <span>View Details</span><i data-feather="arrow-right" class="size-12"></i>
                </a>
              </div>
              <div class="date fs-8 text-white d-flex flex-column justify-content-center position-absolute top-0 end-0 m-2  rounded p-1 text-center">
                <h4 class="text-white mb-0 lh-1">${new Date(event.date).getDate()}</h4>
                <span class="fs-8">${new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                <span>${new Date(event.date).getFullYear()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    renderPagination(filtered);
    if (typeof feather !== 'undefined') feather.replace();
  }

  // Category Filter Buttons
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      categoryButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      currentPage = 1;
      const cat = button.textContent.trim();
      renderEvents(cat === "View All" ? null : cat);
    });
  });

  // Holy Communion Sidebar
  function renderHolyCommunion() {
    if (!holyCommunionContainer) return;

    const holyEvents = events
      .filter(e => e.category === "Holy Communion")
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    holyCommunionContainer.innerHTML = holyEvents.map(event => {
      const start = new Date(event.date);
      const end = event.end_date ? new Date(event.end_date) : start;
      const convertedTime = (event.start_at || event.startAt) ? ` | ${formatEventTime(event)}` : '';

      return `
        <li class="pt-3 pb-3">
          <div class="d-flex gap-3">
            <div class="event-date rounded-1 text-center">
              <h4 class="date mb-0 lh-1">${start.getDate()}</h4>
              <span class="fs-8">${start.toLocaleString('default', { month: 'short' })}</span>
              <span class="fs-8">${start.getFullYear()}</span>
            </div>
            <div class="content">
              <p class="fs-6 mb-1">
                <a href="/event-details?id=${event.id}" class="text-black">${event.title}</a>
              </p>
              <span class="event-meta fs-8">
                <i class="fa fa-clock me-1"></i>
                ${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}${convertedTime}
              </span>
            </div>
          </div>
        </li>
      `;
    }).join('');
  }

  // Swiper Slider Render
  function renderSlider() {
    if (!sliderContainer) return;

    sliderContainer.innerHTML = events.map(event => {
      const date = new Date(event.date);
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();

      return `
        <div class="swiper-slide">
          <div class="postion-relative">
        <div class="event-style-2">
          <div class="card-items hover-up">
            <div class="d-flex flex-column flex-lg-row align-items-lg-center">
          <div class="thumb-img position-relative mb-3 mb-lg-0">
            <img class="rounded-2" src="assets/images/home2/img-sec-2-2.png" alt="${event.title}">
            <div class="date fs-8 text-white d-flex flex-column justify-content-center position-absolute">
              <h4 class="text-white mb-0 lh-0">${day}</h4>
              <span class="fs-8">${month}</span>
              <span>${year}</span>
            </div>
          </div>
          <div class="titles ms-lg-4">
            <div class="cat text-uppercase fs-8 mb-1"><span>${event.category}</span></div>
            <h5 class="title fs-5 mb-3">
              <a href="/event-details?id=${event.id}" class="fs-5 text-dark text-hover-primary font-body fw-normal">${event.title}</a>
            </h5>
            <p class="time fs-8 mb-1"><i class="size-12" data-feather="clock"></i> <span>${formatEventTime(event)}</span></p>
            <p class="location fs-8"><i class="size-12" data-feather="map-pin"></i> <span>${event.location}</span></p>
            <a href="/event-details?id=${event.id}" class="d-inline-flex rounded-5 tc-btn-xs fs-8">
              <span>More Info</span> <i data-feather="arrow-right" class="size-12"></i>
            </a>
          </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      `;
    }).join('');

    if (typeof Swiper !== 'undefined') {
      if (sliderInstance && typeof sliderInstance.destroy === 'function') {
        sliderInstance.destroy(true, true);
      }

      sliderInstance = new Swiper('.blessed-event-slider', {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: true,
        pagination: { el: '.blessed-event-slider-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        breakpoints: {
          768: { slidesPerView: 2 },
          992: { slidesPerView: 3 },
        },
      });
    }

    if (typeof feather !== 'undefined') feather.replace();
  }
});
