const fetchPrinciples = async () => {
    const sources = ["/api/principles", "/data/why-we-do.json", "data/why-we-do.json"];
    for (const source of sources) {
        try {
            const res = await fetch(source);
            if (!res.ok) {
                continue;
            }
            const data = await res.json();
            if (data && Array.isArray(data.items)) {
                return data;
            }
        } catch {
        }
    }
    return { sectionTitle: "", organization: "", items: [] };
};

document.addEventListener("DOMContentLoaded", function () {
    fetchPrinciples()
        .then(data => {
            const container = document.getElementById("swiper-wrapper-c543929da511ccb10");
            if (!container || !Array.isArray(data.items)) {
                return;
            }

            data.items.forEach((item, index) => {
                const references = (item.scriptures || [])
                    .map(s => s.reference)
                    .join(" | ");
                const imageNumber = (index % 17) + 1;
                const imagePath = `assets/images/wwdwwd/${imageNumber}.jpg`;

                const slide = document.createElement("div");
                slide.className = "swiper-slide";

                slide.innerHTML = `
        <div class="postion-relative">
            <div class="project__item-four">
                <div class="project__thumb-four">
                    <a href="why-we-do-what-we-do.html?id=${item.id}">
                        <img src="${imagePath}" alt="${item.title}">
                    </a>
                </div>
                <div class="project__content-four">
                    <div class="left-content">
                        <h4 class="title text-white">
                            <a href="why-we-do-what-we-do.html?id=${item.id}">
                                ${item.title}
                            </a>
                        </h4>
                        <p class="fs-7 text-white des">
                            ${item.description}
                        </p>
                        <span>${references}</span>
                    </div>
                    <div class="more-details d-flex gap-2 mt-4">
                        <a href="why-we-do-what-we-do.html?id=${item.id}"
                            class="btn d-flex gap-1 btn-rounded-1">
                            <span>View Details</span>
                            <svg xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="feather feather-arrow-right size-12">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        `;

                container.appendChild(slide);
            });

            const swiper = document.querySelector(".blessed-sermon-slider-one")?.swiper;
            if (swiper) {
                swiper.update();
            }
        })
        .catch(err => console.error("Error loading sermons:", err));
});

document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const rawId = (params.get("id") || "").trim();
    const postId = parseInt(rawId.replace(/[^0-9]/g, ""), 10);

    fetchPrinciples()
        .then(data => {
            const posts = data.items || [];
            const postIndex = posts.findIndex(p => p.id === postId);

            if (Number.isNaN(postId) || postIndex === -1) {
                return;
            }

            const post = posts[postIndex];

            const postTitle = document.getElementById("post-title");
            const postExcerpt = document.getElementById("post-excerpt");
            const postAuthor = document.getElementById("post-author");
            const postDate = document.getElementById("post-date");
            const postContent = document.getElementById("post-content");
            const postTags = document.getElementById("post-tags");
            const prevTitle = document.getElementById("prev-title");
            const prevLink = document.getElementById("prev-link");
            const nextTitle = document.getElementById("next-title");
            const nextLink = document.getElementById("next-link");

            if (!postTitle || !postExcerpt || !postAuthor || !postDate || !postContent || !postTags) {
                return;
            }

            postTitle.textContent = post.title;
            postExcerpt.textContent = post.description;
            postAuthor.textContent = data.organization;
            postDate.textContent = new Date().toLocaleDateString();

            let contentHTML = "";
            (post.scriptures || []).forEach(s => {
                contentHTML += `<p><strong>${s.reference}</strong><br>${s.text}</p>`;
            });
            postContent.innerHTML = contentHTML;
            postTags.innerHTML = `<span class="badge bg-primary">${data.sectionTitle}</span>`;

            if (postIndex > 0 && prevTitle && prevLink) {
                const prev = posts[postIndex - 1];
                prevTitle.textContent = prev.title;
                prevLink.href = `why-we-do-what-we-do.html?id=${prev.id}`;
            }

            if (postIndex < posts.length - 1 && nextTitle && nextLink) {
                const next = posts[postIndex + 1];
                nextTitle.textContent = next.title;
                nextLink.href = `why-we-do-what-we-do.html?id=${next.id}`;
            }
        })
        .catch(err => console.error("Error loading article:", err));
});
