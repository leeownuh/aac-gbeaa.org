(function () {
  "use strict";

  const SLIDE_INTERVAL_MS = 7000;
  const FALLBACK_IMAGE = "assets/images/home2/hero-2-bg-optimized.jpg";

  const normalizeImageUrl = (value) => {
    if (!value) return "";
    return String(value).trim();
  };

  const preloadImage = (src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => resolve(null);
    image.src = src;
  });

  const setLayerImage = (layer, src) => {
    layer.style.backgroundImage = `url("${src.replace(/"/g, '\\"')}")`;
  };

  const startHeroSlider = async () => {
    const hero = document.querySelector("[data-hero-slider]");
    if (!hero) return;

    const layers = [
      hero.querySelector(".hero-slide-bg-a"),
      hero.querySelector(".hero-slide-bg-b")
    ].filter(Boolean);

    if (layers.length < 2) return;

    setLayerImage(layers[0], FALLBACK_IMAGE);
    setLayerImage(layers[1], FALLBACK_IMAGE);

    let slides = [];
    try {
      const response = await fetch("/api/hero-slides", { credentials: "same-origin" });
      const data = await response.json();
      slides = Array.isArray(data.slides)
        ? data.slides.map(slide => normalizeImageUrl(slide.imageUrl)).filter(Boolean)
        : [];
    } catch {
      slides = [];
    }

    const uniqueSlides = [...new Set(slides)];
    if (uniqueSlides.length === 0) return;

    const usableSlides = (await Promise.all(uniqueSlides.map(preloadImage))).filter(Boolean);
    if (usableSlides.length === 0) return;

    setLayerImage(layers[0], usableSlides[0]);
    if (usableSlides.length === 1) return;

    let activeLayerIndex = 0;
    let slideIndex = 0;

    window.setInterval(() => {
      slideIndex = (slideIndex + 1) % usableSlides.length;
      const nextLayerIndex = activeLayerIndex === 0 ? 1 : 0;
      setLayerImage(layers[nextLayerIndex], usableSlides[slideIndex]);
      layers[nextLayerIndex].classList.add("is-active");
      layers[activeLayerIndex].classList.remove("is-active");
      activeLayerIndex = nextLayerIndex;
    }, SLIDE_INTERVAL_MS);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startHeroSlider);
  } else {
    startHeroSlider();
  }
})();
