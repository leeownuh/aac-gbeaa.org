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
              <a href="event-details.html?id=${event.id}">${event.title}</a>
            </h4>
            <p class="content-p pb-2">${event.description}</p>
            <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between">
              <div class="times mb-2">
                <p class="time fs-8 mb-1"><i data-feather="clock" class="size-12"></i> <span>${event.time}</span></p>
                <p class="location fs-8"><i data-feather="map-pin" class="size-12"></i> <span>${event.location}</span></p>
              </div>
              <div class="button mb-2">
                <a href="event-details.html?id=${event.id}" class="d-inline-flex rounded-5 tc-btn-md fs-8 text-center">
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
                <a href="event-details.html?id=${event.id}" class="text-black">${event.title}</a>
              </p>
              <span class="event-meta fs-8">
                <i class="fa fa-clock me-1"></i>
                ${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}
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
              <a href="event-details.html?id=${event.id}" class="fs-5 text-dark text-hover-primary font-body fw-normal">${event.title}</a>
            </h5>
            <p class="time fs-8 mb-1"><i class="size-12" data-feather="clock"></i> <span>${event.time}</span></p>
            <p class="location fs-8"><i class="size-12" data-feather="map-pin"></i> <span>${event.location}</span></p>
            <a href="event-details.html?id=${event.id}" class="d-inline-flex rounded-5 tc-btn-xs fs-8">
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

    new Swiper('.blessed-event-slider', {
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

    if (typeof feather !== 'undefined') feather.replace();
  }
});
