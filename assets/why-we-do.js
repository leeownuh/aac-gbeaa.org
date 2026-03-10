document.addEventListener("DOMContentLoaded", function () {

    fetch("/data/why-we-do.json")
        .then(res => res.json())
        .then(data => {

            const container = document.getElementById("swiper-wrapper-c543929da511ccb10");

            data.items.forEach((item, index) => {

                // Build scripture reference string
                const references = item.scriptures
                    .map(s => s.reference)
                    .join(" | ");
                // Rotate images 1–17
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
            if (swiper) swiper.update();

        })
        .catch(err => console.error("Error loading sermons:", err));

});

document.addEventListener("DOMContentLoaded", function () {

    const params = new URLSearchParams(window.location.search);
    const postId = parseInt(params.get("id"));

    fetch("/data/why-we-do.json")
        .then(res => res.json())
        .then(data => {

            const posts = data.items;

            const postIndex = posts.findIndex(p => p.id === postId);

            if (postIndex === -1) return;

            const post = posts[postIndex];

            document.getElementById("post-title").textContent = post.title;
            document.getElementById("post-excerpt").textContent = post.description;

            document.getElementById("post-author").textContent = data.organization;
            document.getElementById("post-date").textContent =
                new Date().toLocaleDateString();


            // MAIN CONTENT
            let contentHTML = "";

            post.scriptures.forEach(s => {
                contentHTML += `
<p><strong>${s.reference}</strong><br>${s.text}</p>
`;
            });

            document.getElementById("post-content").innerHTML = contentHTML;


            // TAG
            document.getElementById("post-tags").innerHTML =
                `<span class="badge bg-primary">${data.sectionTitle}</span>`;


            // PREVIOUS ARTICLE
            if (postIndex > 0) {

                const prev = posts[postIndex - 1];

                document.getElementById("prev-title").textContent = prev.title;
                document.getElementById("prev-link").href =
                    `why-we-do-what-we-do.html?id=${prev.id}`;

            }


            // NEXT ARTICLE
            if (postIndex < posts.length - 1) {

                const next = posts[postIndex + 1];

                document.getElementById("next-title").textContent = next.title;
                document.getElementById("next-link").href =
                    `why-we-do-what-we-do.html?id=${next.id}`;

            }

        })
        .catch(err => console.error("Error loading article:", err));

});