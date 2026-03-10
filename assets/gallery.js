document.addEventListener("DOMContentLoaded", function () {

    const filterContainer = document.getElementById("gallery-filters");
    const galleryContainer = document.getElementById("gallery-container");
    const paginationContainer = document.querySelector(".pagination");

    const itemsPerPage = 12;
    let currentPage = 1;
    let currentFilter = "*";
    let allImages = [];
    let categories = [];

    fetch("/data/gallery.json")
        .then(res => res.json())
        .then(data => {

            categories = data.categories;
            allImages = data.images;

            // Sort newest → oldest
            allImages.sort((a, b) => new Date(b.date) - new Date(a.date));

            generateFilters();
            renderGallery();
        })
        .catch(err => console.error("Gallery load error:", err));

    function generateFilters() {

        filterContainer.innerHTML = `
            <button data-filter="*" class="btn rounded-5 btn-tag-outline active">
                Show All
            </button>
        `;

        categories.forEach(cat => {
            filterContainer.innerHTML += `
                <button data-filter="${cat.slug}" class="btn rounded-5 btn-tag-outline">
                    ${cat.name}
                </button>
            `;
        });

        filterContainer.addEventListener("click", function (e) {

            if (e.target.tagName === "BUTTON") {

                document.querySelectorAll("#gallery-filters button")
                    .forEach(btn => btn.classList.remove("active"));

                e.target.classList.add("active");

                currentFilter = e.target.dataset.filter;
                currentPage = 1;

                renderGallery();

                window.scrollTo({
                    top: galleryContainer.offsetTop - 100,
                    behavior: "smooth"
                });
            }
        });
    }

    function renderGallery() {

        galleryContainer.innerHTML = "";

        let filtered = currentFilter === "*"
            ? allImages
            : allImages.filter(img => img.category === currentFilter);

        if (filtered.length === 0) {
            galleryContainer.innerHTML = `
                <div class="col-12 text-center mt-5">
                    <h5>No images found in this category.</h5>
                </div>`;
            paginationContainer.innerHTML = "";
            return;
        }

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const paginatedItems = filtered.slice(start, start + itemsPerPage);

        paginatedItems.forEach(img => {

            const category = categories.find(c => c.slug === img.category);
            const imagePath = `/assets/images/gallery/${category.folder}/${img.file}`;

            galleryContainer.innerHTML += `
                <div class="col-lg-3 col-md-4 col-sm-6 col-12 mb-4">
                    <div class="project-card-item8 shine-animate-item">
                        <div class="project-card-thumb">
                            <a class="shine-animate image-popup" href="${imagePath}">
                                <img class="w-100 rounded"
                                     style="height:280px; object-fit:cover;"
                                     src="${imagePath}"
                                     alt="${img.title}">
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });

        generatePagination(totalPages);

        if (window.$ && $.fn.magnificPopup) {
            $('.image-popup').magnificPopup({
                type: 'image',
                gallery: { enabled: true }
            });
        }
    }

    function generatePagination(totalPages) {

        paginationContainer.innerHTML = "";

        if (totalPages <= 1) return;

        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);

        if (currentPage <= 3) {
            startPage = 1;
            endPage = Math.min(totalPages, maxVisible);
        }

        if (currentPage >= totalPages - 2) {
            endPage = totalPages;
            startPage = Math.max(1, totalPages - maxVisible + 1);
        }

        // Previous
        paginationContainer.innerHTML += `
            <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
                <a class="page-link size-48" href="#" data-page="${currentPage - 1}">
                    &laquo;
                </a>
            </li>
        `;

        if (startPage > 1) {
            paginationContainer.innerHTML += pageItem(1);
            if (startPage > 2) {
                paginationContainer.innerHTML += ellipsisItem();
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.innerHTML += pageItem(i);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationContainer.innerHTML += ellipsisItem();
            }
            paginationContainer.innerHTML += pageItem(totalPages);
        }

        // Next
        paginationContainer.innerHTML += `
            <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
                <a class="page-link size-48" href="#" data-page="${currentPage + 1}">
                    &raquo;
                </a>
            </li>
        `;

        paginationContainer.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", function (e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (!isNaN(page) && page >= 1 && page <= totalPages) {
                    currentPage = page;
                    renderGallery();
                    window.scrollTo({
                        top: galleryContainer.offsetTop - 100,
                        behavior: "smooth"
                    });
                }
            });
        });
    }

    function pageItem(page) {
        return `
            <li class="page-item ${page === currentPage ? "active" : ""}">
                <a class="page-link size-48" href="#" data-page="${page}">
                    ${page}
                </a>
            </li>
        `;
    }

    function ellipsisItem() {
        return `
            <li class="page-item disabled">
                <span class="page-link size-48">...</span>
            </li>
        `;
    }

});