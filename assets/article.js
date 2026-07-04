let news = [];
const postsPerPage = 3;
let currentPage = 1;
let filteredPosts = [];

const container = document.getElementById("blog-container");
const paginationContainer = document.getElementById("pagination");

const normalizeId = (value) => String(value || "").trim().toLowerCase();

const fetchArticles = async () => {
  const sources = ["/api/articles", "/data/article.json", "data/article.json"];
  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (Array.isArray(payload)) {
        return payload;
      }
      if (payload && Array.isArray(payload.data)) {
        return payload.data;
      }
    } catch {
    }
  }
  return [];
};

async function loadNews() {
  try {
    news = await fetchArticles();
    filteredPosts = [...news];
    renderCategories();  
    renderPosts();
  } catch (error) {
    console.error("Error loading articles:", error);
  }
}

function renderPosts(page = 1) {
  container.innerHTML = "";
  const start = (page - 1) * postsPerPage;
  const end = start + postsPerPage;
  const postsToRender = filteredPosts.slice(start, end);

  postsToRender.forEach(post => {
    container.insertAdjacentHTML('beforeend', `
      <div class="col-lg-4 col-md-6 col-12 mb-4">
        <div class="card-blog-1 rounded-2 overflow-hidden bg-white shadow-1 hover-up">
          <div class="card-body p-4">
            <h5 class="font-body text-dark fs-5 lh-base">
              <a href="/blog-details?id=${post.id}">${post.title}</a>
            </h5>
            <div class="meta-1 fs-7 mb-3">
              <span class="author">by ${post.author}</span><br>
              <span class="date ms-1">${post.date}</span>
              <span class="badge bg-primary ms-2">${post.category}</span>
            </div>
            <p class="fs-7 mb-4 text-dark">${post.excerpt}</p>
            <a href="/blog-details?id=${post.id}" class="text-decoration-underline fs-7">Read More</a>
          </div>
        </div>
      </div>
    `);
  });

  renderPagination();
}
function renderCategories() {
  const categoryContainer = document.getElementById("category-container");

  if (!categoryContainer) return;

  const categories = [...new Set(news.map(post => post.category))];

  categoryContainer.innerHTML = `
    <a href="javascript:" class="btn rounded-5 btn-tag-outline active" data-category="all">
      <span>All</span>
    </a>
  `;

  categories.forEach(category => {
    categoryContainer.insertAdjacentHTML("beforeend", `
      <a href="javascript:" class="btn rounded-5 btn-tag-outline" data-category="${category}">
        <span>${category}</span>
      </a>
    `);
  });

  // Click events
  categoryContainer.querySelectorAll("[data-category]").forEach(btn => {
    btn.addEventListener("click", () => {

      document.querySelectorAll("#category-container .btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      const category = btn.dataset.category;

      if (category === "all") {
        filteredPosts = [...news];
      } else {
        filteredPosts = news.filter(post => post.category === category);
      }

      currentPage = 1;
      renderPosts();
    });
  });
} 
function renderBlogPosts() {
    const container = document.getElementById("blog-container");

    // Show latest 3 posts
    const latestPosts = news.slice(-3).reverse();

    container.innerHTML = latestPosts.map(post => `
        <div class="col-lg-4 col-md-6 col-12">
            <div class="card-blog-1 mb-4 mb-lg-0 rounded-2 overflow-hidden bg-white shadow-1 hover-up">
                <div class="card-body p-4">
                    <h5 class="font-body text-dark fs-5 lh-base">
                        <a href="/blog-details?id=${post.id}">${post.title}</a>
                    </h5>
                    <div class="meta-1 fs-7 mb-3">
                        <span class="author">
                            by <a href="/blog-details?id=${post.id}" class="text-decoration-underline">${post.author}</a>
                        </span>
                        <span class="date ms-1">${post.date}</span>
                        <span class="badge bg-primary ms-2">${post.category.toUpperCase()}</span>
                    </div>
                    <p class="fs-7 mb-4 text-dark">${post.excerpt}</p>
                    <a href="/blog-details?id=${post.id}" class="text-decoration-underline fs-7">Read More</a>
                </div>
            </div>
        </div>
    `).join("");
}

function renderPagination() {
  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

  for (let i = 1; i <= totalPages; i++) {
    paginationContainer.insertAdjacentHTML('beforeend', `
      <li class="page-item ${currentPage === i ? 'active' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="goToPage(${i})">${i}</a>
      </li>
    `);
  }
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderPosts(currentPage);
}

// Blog details page
async function loadPostDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = normalizeId(urlParams.get("id"));

  if (!postId) return;

  const posts = await fetchArticles();
  const post = posts.find(p => normalizeId(p.id) === postId);

  if (!post) {
    document.getElementById("post-title").textContent = "Post not found";
    return;
  }

  document.getElementById("post-title").textContent = post.title;
  document.getElementById("post-author").textContent = post.author;
  document.getElementById("post-date").textContent = post.date;
  document.getElementById("post-excerpt").textContent = post.excerpt;

  const formattedContent = post.content
    .split("\n\n")
    .map(p => `<p>${p}</p>`)
    .join("");

  document.getElementById("post-content").innerHTML = formattedContent;
  // Find current index
const index = posts.findIndex(p => String(p.id) === String(postId));

// Previous post
const prevPost = posts[index - 1];
if (prevPost) {
  document.getElementById("prev-link").href = `/blog-details?id=${prevPost.id}`;
  document.getElementById("prev-title").textContent = prevPost.title;
} else {
  document.getElementById("prev-link").style.display = "none";
}

// Next post
const nextPost = posts[index + 1];
if (nextPost) {
  document.getElementById("next-link").href = `/blog-details?id=${nextPost.id}`;
  document.getElementById("next-title").textContent = nextPost.title;
} else {
  document.getElementById("next-link").style.display = "none";
}
}
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("blog-container")) {
    loadNews();
  }
  if (document.getElementById("post-title")) {
    loadPostDetails();
  }
});
