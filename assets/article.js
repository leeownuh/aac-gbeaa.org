let news = [];
let articleCategories = [];
const postsPerPage = 3;
let currentPage = 1;
let filteredPosts = [];

const container = document.getElementById("blog-container");
const paginationContainer = document.getElementById("pagination");
const fallbackArticleImage = "assets/images/home2/hero-2-bg2-optimized.jpg";

const normalizeId = (value) => String(value || "").trim().toLowerCase();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function normalizeArticlesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function getArticleImage(post) {
  return post?.imageUrl || post?.image || fallbackArticleImage;
}

const fetchArticles = async () => {
  const sources = ["/api/articles", "/data/article.json", "data/article.json"];
  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        continue;
      }
      const normalized = normalizeArticlesPayload(await response.json());
      if (normalized.length > 0) {
        return normalized;
      }
    } catch {
    }
  }
  return [];
};

const fetchArticleCategories = async () => {
  try {
    const response = await fetch("/api/article-categories");
    if (!response.ok) return [];
    return normalizeArticlesPayload(await response.json());
  } catch {
    return [];
  }
};

function getCategoryNames() {
  const defined = articleCategories.map(category => category.name).filter(Boolean);
  const used = news.map(post => post.category).filter(Boolean);
  return [...new Set([...defined, ...used])];
}

async function loadNews() {
  try {
    const [posts, categories] = await Promise.all([
      fetchArticles(),
      fetchArticleCategories()
    ]);

    news = posts;
    articleCategories = categories;
    filteredPosts = [...news];
    renderCategories();
    renderPosts();
  } catch (error) {
    console.error("Error loading articles:", error);
  }
}

function renderPosts(page = currentPage) {
  if (!container) return;

  container.innerHTML = "";
  const start = (page - 1) * postsPerPage;
  const end = start + postsPerPage;
  const postsToRender = filteredPosts.slice(start, end);

  postsToRender.forEach(post => {
    const id = encodeURIComponent(post.id);
    container.insertAdjacentHTML("beforeend", `
      <div class="col-lg-4 col-md-6 col-12 mb-4">
        <div class="card-blog-1 rounded-2 overflow-hidden bg-white shadow-1 hover-up">
          <a href="/blog-details?id=${id}" class="article-card-image d-block">
            <img src="${escapeAttr(getArticleImage(post))}" alt="${escapeAttr(post.title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${fallbackArticleImage}';">
          </a>
          <div class="card-body p-4">
            <h5 class="font-body text-dark fs-5 lh-base">
              <a href="/blog-details?id=${id}">${escapeHtml(post.title)}</a>
            </h5>
            <div class="meta-1 fs-7 mb-3">
              <span class="author">by ${escapeHtml(post.author)}</span><br>
              <span class="date ms-1">${escapeHtml(post.date)}</span>
              <span class="badge bg-primary ms-2">${escapeHtml(post.category)}</span>
            </div>
            <p class="fs-7 mb-4 text-dark">${escapeHtml(post.excerpt)}</p>
            <a href="/blog-details?id=${id}" class="text-decoration-underline fs-7">Read More</a>
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

  categoryContainer.innerHTML = `
    <a href="javascript:" class="btn rounded-5 btn-tag-outline active" data-category="all">
      <span>All</span>
    </a>
  `;

  getCategoryNames().forEach(category => {
    categoryContainer.insertAdjacentHTML("beforeend", `
      <a href="javascript:" class="btn rounded-5 btn-tag-outline" data-category="${escapeAttr(category)}">
        <span>${escapeHtml(category)}</span>
      </a>
    `);
  });

  categoryContainer.querySelectorAll("[data-category]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#category-container .btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      const category = btn.dataset.category;

      filteredPosts = category === "all"
        ? [...news]
        : news.filter(post => post.category === category);

      currentPage = 1;
      renderPosts();
    });
  });
}

function renderBlogPosts() {
  const blogContainer = document.getElementById("blog-container");
  if (!blogContainer) return;

  const latestPosts = news.slice(-3).reverse();

  blogContainer.innerHTML = latestPosts.map(post => {
    const id = encodeURIComponent(post.id);
    return `
      <div class="col-lg-4 col-md-6 col-12">
        <div class="card-blog-1 mb-4 mb-lg-0 rounded-2 overflow-hidden bg-white shadow-1 hover-up">
          <a href="/blog-details?id=${id}" class="article-card-image d-block">
            <img src="${escapeAttr(getArticleImage(post))}" alt="${escapeAttr(post.title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${fallbackArticleImage}';">
          </a>
          <div class="card-body p-4">
            <h5 class="font-body text-dark fs-5 lh-base">
              <a href="/blog-details?id=${id}">${escapeHtml(post.title)}</a>
            </h5>
            <div class="meta-1 fs-7 mb-3">
              <span class="author">
                by <a href="/blog-details?id=${id}" class="text-decoration-underline">${escapeHtml(post.author)}</a>
              </span>
              <span class="date ms-1">${escapeHtml(post.date)}</span>
              <span class="badge bg-primary ms-2">${escapeHtml(String(post.category || "").toUpperCase())}</span>
            </div>
            <p class="fs-7 mb-4 text-dark">${escapeHtml(post.excerpt)}</p>
            <a href="/blog-details?id=${id}" class="text-decoration-underline fs-7">Read More</a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderPagination() {
  if (!paginationContainer) return;

  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

  for (let i = 1; i <= totalPages; i++) {
    paginationContainer.insertAdjacentHTML("beforeend", `
      <li class="page-item ${currentPage === i ? "active" : ""}">
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

  document.getElementById("post-title").textContent = post.title || "";
  document.getElementById("post-author").textContent = post.author || "";
  document.getElementById("post-date").textContent = post.date || "";
  document.getElementById("post-excerpt").textContent = post.excerpt || "";

  const articleImage = document.getElementById("post-image");
  if (articleImage) {
    articleImage.src = getArticleImage(post);
    articleImage.alt = post.title || "Article image";
    articleImage.onerror = () => {
      articleImage.onerror = null;
      articleImage.src = fallbackArticleImage;
    };
  }

  const formattedContent = String(post.content || "")
    .split("\n\n")
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("");

  document.getElementById("post-content").innerHTML = formattedContent;

  const index = posts.findIndex(p => normalizeId(p.id) === postId);
  const prevPost = posts[index - 1];
  if (prevPost) {
    document.getElementById("prev-link").href = `/blog-details?id=${encodeURIComponent(prevPost.id)}`;
    document.getElementById("prev-title").textContent = prevPost.title || "";
  } else {
    document.getElementById("prev-link").style.display = "none";
  }

  const nextPost = posts[index + 1];
  if (nextPost) {
    document.getElementById("next-link").href = `/blog-details?id=${encodeURIComponent(nextPost.id)}`;
    document.getElementById("next-title").textContent = nextPost.title || "";
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
