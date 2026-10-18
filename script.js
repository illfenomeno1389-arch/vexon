"use strict";

/* ==========================================
   VEXON - Automatic Gaming News
   Auto Update, Search, Categories, Language
   ========================================== */

document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // 1. عناصر HTML
    // ==========================================

    const languageBtn = document.getElementById("languageBtn");
    const themeBtn = document.getElementById("themeBtn");
    const searchInput = document.getElementById("searchInput");
    const refreshBtn = document.getElementById("refreshBtn");
    const newsContainer = document.getElementById("newsContainer");
    const newsStatus = document.getElementById("newsStatus");
    const noResults = document.getElementById("noResults");

    const categoryButtons = document.querySelectorAll(
        ".category-button"
    );

    // بررسی وجود عناصر ضروری
    if (
        !languageBtn ||
        !themeBtn ||
        !searchInput ||
        !refreshBtn ||
        !newsContainer ||
        !newsStatus ||
        !noResults
    ) {
        console.error(
            "VEXON: بعضی از عناصر HTML پیدا نشدند. index.html را بررسی کن."
        );
        return;
    }

    // ==========================================
    // 2. تنظیمات اولیه
    // ==========================================

    let currentLanguage =
        localStorage.getItem("vexon-language") || "fa";

    let currentTheme =
        localStorage.getItem("vexon-theme") || "dark";

    let selectedCategory = "all";

    let allNews = [];

    let isLoading = false;

    // زمان آخرین درخواست دریافت اخبار
    let lastFetchTime = 0;

    // فاصله به‌روزرسانی خودکار: 5 دقیقه
    const UPDATE_INTERVAL = 5 * 60 * 1000;

    // ==========================================
    // 3. منابع اخبار
    // ==========================================

    const newsFeeds = [
        {
            name: "IGN",
            url: "https://feeds.feedburner.com/ign/news"
        },
        {
            name: "The Verge",
            url: "https://www.theverge.com/rss/games/index.xml"
        },
        {
            name: "PC Gamer",
            url: "https://www.pcgamer.com/rss/"
        }
    ];

    // ==========================================
    // 4. پیام‌های فارسی و انگلیسی
    // ==========================================

    const messages = {
        loading: {
            fa: "در حال دریافت جدیدترین اخبار...",
            en: "Loading the latest gaming news..."
        },

        loaded: {
            fa: "اخبار با موفقیت دریافت شدند.",
            en: "News loaded successfully."
        },

        failed: {
            fa: "اخبار دریافت نشدند. اتصال اینترنت یا سرویس خبر را بررسی کن.",
            en: "Could not load news. Check your internet connection or news service."
        },

        noResults: {
            fa: "نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کن.",
            en: "No results found. Try another search."
        },

        refreshing: {
            fa: "در حال به‌روزرسانی اخبار...",
            en: "Refreshing news..."
        },

        partial: {
            fa: "بعضی منابع در دسترس نبودند؛ اخبار منابع دیگر نمایش داده شده‌اند.",
            en: "Some sources were unavailable. Showing available news."
        }
    };

    // ==========================================
    // 5. ایمن‌سازی متن‌ها
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            function (character) {

                const replacements = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                };

                return replacements[character];
            }
        );
    }

    // حذف تگ‌های HTML از توضیحات خبر
    function stripHTML(value) {
        const temporary = document.createElement("div");

        temporary.innerHTML = value || "";

        return (
            temporary.textContent ||
            temporary.innerText ||
            ""
        )
            .replace(/\s+/g, " ")
            .trim();
    }

    // ==========================================
    // 6. بررسی اعتبار لینک‌ها
    // ==========================================

    function isValidLink(value) {
        try {
            const url = new URL(value);

            return (
                url.protocol === "https:" ||
                url.protocol === "http:"
            );

        } catch {
            return false;
        }
    }

    function isValidImageURL(value) {
        return isValidLink(value);
    }

    // ==========================================
    // 7. پیدا کردن عکس خبر
    // ==========================================

    function extractImage(item) {

        // عکس بندانگشتی
        if (
            item.thumbnail &&
            isValidImageURL(item.thumbnail)
        ) {
            return item.thumbnail;
        }

        // عکس پیوست‌شده به خبر
        if (
            item.enclosure &&
            item.enclosure.link &&
            isValidImageURL(item.enclosure.link)
        ) {
            return item.enclosure.link;
        }

        // تلاش برای پیدا کردن عکس در توضیحات خبر
        const description =
            item.description || item.content || "";

        const match = description.match(
            /<img[^>]+src=["']([^"']+)["']/i
        );

        if (
            match &&
            match[1] &&
            isValidImageURL(match[1])
        ) {
            return match[1];
        }

        // اگر عکس پیدا نشد
        return "";
    }

    // ==========================================
    // 8. دسته‌بندی خودکار اخبار
    // ==========================================

    function detectCategory(title, description) {

        const text = (
            title + " " + description
        ).toLowerCase();

        const gtaKeywords = [
            "gta",
            "grand theft auto",
            "rockstar games",
            "rockstar"
        ];

        const playstationKeywords = [
            "playstation",
            "playstation 5",
            "playstation 6",
            "ps5",
            "ps6",
            "ps4",
            "sony"
        ];

        const xboxKeywords = [
            "xbox",
            "game pass",
            "xbox series",
            "microsoft gaming"
        ];

        const pcKeywords = [
            "pc gaming",
            "pc gamer",
            "steam",
            "nvidia",
            "graphics card",
            "gpu",
            "windows gaming",
            "computer gaming"
        ];

        if (
            gtaKeywords.some(keyword =>
                text.includes(keyword)
            )
        ) {
            return "gta";
        }

        if (
            playstationKeywords.some(keyword =>
                text.includes(keyword)
            )
        ) {
            return "playstation";
        }

        if (
            xboxKeywords.some(keyword =>
                text.includes(keyword)
            )
        ) {
            return "xbox";
        }

        if (
            pcKeywords.some(keyword =>
                text.includes(keyword)
            )
        ) {
            return "pc";
        }

        return "all";
    }

    // ==========================================
    // 9. نام دسته‌بندی‌ها
    // ==========================================

    function getCategoryName(category) {

        const names = {
            all: {
                fa: "عمومی",
                en: "General"
            },

            gta: {
                fa: "GTA",
                en: "GTA"
            },

            playstation: {
                fa: "پلی‌استیشن",
                en: "PlayStation"
            },

            xbox: {
                fa: "ایکس‌باکس",
                en: "Xbox"
            },

            pc: {
                fa: "کامپیوتر",
                en: "PC Gaming"
            }
        };

        return (
            names[category]?.[currentLanguage] ||
            names.all[currentLanguage]
        );
    }

    // ==========================================
    // 10. تبدیل تاریخ اخبار
    // ==========================================

    function formatDate(dateValue) {

        if (!dateValue) {
            return "";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        try {

            return new Intl.DateTimeFormat(
                currentLanguage === "fa"
                    ? "fa-IR"
                    : "en-US",

                {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                }

            ).format(date);

        } catch {

            return date.toLocaleDateString();
        }
    }

    // ==========================================
    // 11. تغییر زبان سایت
    // ==========================================

    function changeLanguage(language) {

        currentLanguage = language;

        document.documentElement.lang = language;

        document.documentElement.dir =
            language === "fa" ? "rtl" : "ltr";

        document.querySelectorAll(
            "[data-fa][data-en]"
        ).forEach(function (element) {

            element.textContent =
                language === "fa"
                    ? element.dataset.fa
                    : element.dataset.en;
        });

        document.querySelectorAll(
            "[data-placeholder-fa][data-placeholder-en]"
        ).forEach(function (element) {

            element.placeholder =
                language === "fa"
                    ? element.dataset.placeholderFa
                    : element.dataset.placeholderEn;
        });

        languageBtn.textContent =
            language === "fa" ? "EN" : "FA";

        languageBtn.setAttribute(
            "aria-label",
            language === "fa"
                ? "Switch to English"
                : "تغییر به فارسی"
        );

        localStorage.setItem(
            "vexon-language",
            language
        );

        renderNews();

        updateStatusLanguage();
    }

    // ==========================================
    // 12. تغییر تم سایت
    // ==========================================

    function changeTheme(theme) {

        currentTheme = theme;

        document.body.classList.toggle(
            "neon-mode",
            theme === "neon"
        );

        themeBtn.textContent =
            theme === "neon" ? "☾" : "☀";

        themeBtn.setAttribute(
            "aria-label",
            currentLanguage === "fa"
                ? "تغییر حالت نمایش"
                : "Toggle appearance"
        );

        localStorage.setItem(
            "vexon-theme",
            theme
        );
    }

    // ==========================================
    // 13. به‌روزرسانی پیام وضعیت
    // ==========================================

    function updateStatusLanguage() {

        if (isLoading) {

            newsStatus.textContent =
                messages.refreshing[currentLanguage];

            return;
        }

        if (allNews.length > 0) {

            newsStatus.textContent =
                messages.loaded[currentLanguage];
        }
    }

    // ==========================================
    // 14. دریافت اخبار از یک منبع
    // ==========================================

    async function fetchFeed(feed) {

        const apiURL =
            "https://api.rss2json.com/v1/api.json?rss_url=" +
            encodeURIComponent(feed.url);

        const response = await fetch(apiURL, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        const data = await response.json();

        if (
            data.status !== "ok" ||
            !Array.isArray(data.items)
        ) {
            throw new Error(
                "RSS feed could not be parsed"
            );
        }

        return data.items.map(function (item) {

            const title = stripHTML(
                item.title || ""
            );

            const description = stripHTML(
                item.description || item.content || ""
            );

            return {

                title: title || "Gaming News",

                description: description,

                link: isValidLink(item.link)
                    ? item.link
                    : "",

                date: item.pubDate || "",

                image: extractImage(item),

                source: feed.name,

                category: detectCategory(
                    title,
                    description
                )
            };

        }).filter(function (item) {

            return item.title && item.link;
        });
    }

    // ==========================================
    // 15. دریافت و به‌روزرسانی همه اخبار
    // ==========================================

    async function loadGamingNews() {

        // جلوگیری از درخواست هم‌زمان تکراری
        if (isLoading) {
            return;
        }

        isLoading = true;

        lastFetchTime = Date.now();

        refreshBtn.disabled = true;

        refreshBtn.classList.add("is-loading");

        newsStatus.textContent =
            messages.refreshing[currentLanguage];

        if (allNews.length === 0) {

            newsContainer.innerHTML = `
                <div class="loading-card">
                    <div class="loading-spinner"></div>

                    <p>
                        ${escapeHTML(
                            messages.loading[currentLanguage]
                        )}
                    </p>
                </div>
            `;
        }

        try {

            // دریافت هم‌زمان اخبار از منابع مختلف
            const results = await Promise.allSettled(
                newsFeeds.map(fetchFeed)
            );

            const newNews = [];

            let successfulSources = 0;

            results.forEach(function (result) {

                if (result.status === "fulfilled") {

                    successfulSources++;

                    newNews.push(...result.value);

                } else {

                    console.warn(
                        "دریافت یکی از منابع خبری ناموفق بود:",
                        result.reason
                    );
                }
            });

            // اگر هیچ خبری دریافت نشد، اخبار قبلی حفظ شوند
            if (newNews.length === 0) {

                if (allNews.length === 0) {

                    newsContainer.innerHTML = "";

                    newsStatus.textContent =
                        messages.failed[currentLanguage];

                } else {

                    newsStatus.textContent =
                        messages.failed[currentLanguage];
                }

                renderNews();

                return;
            }

            // حذف اخبار تکراری بر اساس لینک
            const uniqueNews = [];

            const seenLinks = new Set();

            newNews.forEach(function (item) {

                const key = item.link
                    .replace(/\/+$/, "")
                    .toLowerCase();

                if (!seenLinks.has(key)) {

                    seenLinks.add(key);

                    uniqueNews.push(item);
                }
            });

            // مرتب‌سازی از جدیدترین به قدیمی‌ترین
            uniqueNews.sort(function (a, b) {

                const dateA =
                    new Date(a.date).getTime() || 0;

                const dateB =
                    new Date(b.date).getTime() || 0;

                return dateB - dateA;
            });

            // ذخیره اخبار جدید
            allNews = uniqueNews;

            // نمایش اخبار
            renderNews();

            // پیام نتیجه دریافت اخبار
            if (successfulSources < newsFeeds.length) {

                newsStatus.textContent =
                    messages.partial[currentLanguage];

            } else {

                newsStatus.textContent =
                    messages.loaded[currentLanguage];
            }

            console.log(
                "VEXON: تعداد اخبار دریافت‌شده:",
                allNews.length
            );

        } catch (error) {

            console.error(
                "خطا در دریافت اخبار:",
                error
            );

            newsStatus.textContent =
                messages.failed[currentLanguage];

        } finally {

            isLoading = false;

            refreshBtn.disabled = false;

            refreshBtn.classList.remove("is-loading");
        }
    }

    // ==========================================
    // 16. ساخت کارت هر خبر
    // ==========================================

    function createNewsCard(item) {

        let imageHTML = "";

        if (item.image) {

            imageHTML = `
                <div class="news-image-wrapper">

                    <img
                        class="news-image"
                        src="${escapeHTML(item.image)}"
                        alt=""
                        loading="lazy"
                        referrerpolicy="no-referrer"
                    >

                    <div
                        class="image-placeholder"
                        aria-hidden="true"
                    >
                        V
                    </div>

                </div>
            `;

        } else {

            imageHTML = `
                <div class="news-image-wrapper">

                    <div
                        class="image-placeholder"
                        aria-hidden="true"
                    >
                        V
                    </div>

                </div>
            `;
        }

        const description = item.description
            ? item.description.slice(0, 240)
            : "";

        const dateText = formatDate(item.date);

        const readMoreText =
            currentLanguage === "fa"
                ? "خواندن خبر ↗"
                : "Read Story ↗";

        return `
            <article class="news-card">

                ${imageHTML}

                <div class="news-content">

                    <div class="news-meta">

                        <span class="news-source">
                            ${escapeHTML(item.source)}
                        </span>

                        <span>
                            ${escapeHTML(dateText)}
                        </span>

                    </div>

                    <h3 class="news-title">
                        ${escapeHTML(item.title)}
                    </h3>

                    <p class="news-description">
                        ${escapeHTML(description)}
                    </p>

                    <div class="news-footer">

                        <a
                            class="read-more"
                            href="${escapeHTML(item.link)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${escapeHTML(readMoreText)}
                        </a>

                        <span class="news-category-label">
                            ${escapeHTML(
                                getCategoryName(item.category)
                            )}
                        </span>

                    </div>

                </div>

            </article>
        `;
    }

    // ==========================================
    // 17. نمایش و فیلتر اخبار
    // ==========================================

    function renderNews() {

        const query = searchInput.value
            .trim()
            .toLowerCase();

        const filteredNews = allNews.filter(
            function (item) {

                const searchableText = (
                    item.title + " " +
                    item.description + " " +
                    item.source + " " +
                    item.category
                ).toLowerCase();

                const matchesSearch =
                    searchableText.includes(query);

                const matchesCategory =
                    selectedCategory === "all" ||
                    item.category === selectedCategory;

                return (
                    matchesSearch &&
                    matchesCategory
                );
            }
        );

        // اگر خبری برای نمایش وجود نداشت
        if (filteredNews.length === 0) {

            newsContainer.innerHTML = "";

            noResults.hidden = false;

            if (allNews.length === 0) {

                noResults.querySelector("h3").textContent =
                    currentLanguage === "fa"
                        ? "فعلاً خبری برای نمایش نیست"
                        : "No news available yet";

                noResults.querySelector("p").textContent =
                    currentLanguage === "fa"
                        ? "اتصال اینترنت را بررسی کن یا دوباره اخبار را به‌روزرسانی کن."
                        : "Check your internet connection or refresh the news.";

            } else {

                noResults.querySelector("h3").textContent =
                    currentLanguage === "fa"
                        ? "خبری پیدا نشد"
                        : "No news found";

                noResults.querySelector("p").textContent =
                    messages.noResults[currentLanguage];
            }

            return;
        }

        noResults.hidden = true;

        // نمایش حداکثر 30 خبر
        newsContainer.innerHTML = filteredNews
            .slice(0, 30)
            .map(createNewsCard)
            .join("");

        // مدیریت عکس‌هایی که بارگذاری نمی‌شوند
        newsContainer.querySelectorAll(
            ".news-image"
        ).forEach(function (image) {

            image.addEventListener(
                "load",
                function () {

                    const placeholder =
                        image.parentElement.querySelector(
                            ".image-placeholder"
                        );

                    if (placeholder) {
                        placeholder.style.display = "none";
                    }
                }
            );

            image.addEventListener(
                "error",
                function () {

                    // تصویر خراب حذف می‌شود؛
                    // جایگزین V باقی می‌ماند.
                    image.remove();
                }
            );
        });
    }

    // ==========================================
    // 18. دکمه تغییر زبان
    // ==========================================

    languageBtn.addEventListener(
        "click",
        function () {

            changeLanguage(
                currentLanguage === "fa"
                    ? "en"
                    : "fa"
            );
        }
    );

    // ==========================================
    // 19. دکمه تغییر تم
    // ==========================================

    themeBtn.addEventListener(
        "click",
        function () {

            changeTheme(
                currentTheme === "dark"
                    ? "neon"
                    : "dark"
            );
        }
    );

    // ==========================================
    // 20. جست‌وجوی اخبار
    // ==========================================

    searchInput.addEventListener(
        "input",
        renderNews
    );

    // ==========================================
    // 21. دسته‌بندی اخبار
    // ==========================================

    categoryButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    selectedCategory =
                        button.dataset.category || "all";

                    categoryButtons.forEach(
                        function (item) {

                            item.classList.remove("active");
                        }
                    );

                    button.classList.add("active");

                    renderNews();
                }
            );
        }
    );

    // ==========================================
    // 22. به‌روزرسانی دستی
    // ==========================================

    refreshBtn.addEventListener(
        "click",
        function () {

            loadGamingNews();
        }
    );

    // ==========================================
    // 23. اعمال تنظیمات ذخیره‌شده
    // ==========================================

    if (
        currentLanguage !== "fa" &&
        currentLanguage !== "en"
    ) {
        currentLanguage = "fa";
    }

    if (
        currentTheme !== "dark" &&
        currentTheme !== "neon"
    ) {
        currentTheme = "dark";
    }

    changeLanguage(currentLanguage);

    changeTheme(currentTheme);

    // ==========================================
    // 24. دریافت اخبار هنگام ورود به سایت
    // ==========================================

    // این دستور هنگام باز شدن صفحه اجرا می‌شود.
    loadGamingNews();

    // ==========================================
    // 25. به‌روزرسانی خودکار هر 5 دقیقه
    // ==========================================

    setInterval(function () {

        // فقط وقتی تب سایت قابل مشاهده است
        // درخواست جدید ارسال می‌شود.
        if (!document.hidden) {

            loadGamingNews();
        }

    }, UPDATE_INTERVAL);

    // ==========================================
    // 26. بررسی اخبار هنگام بازگشت به سایت
    // ==========================================

    document.addEventListener(
        "visibilitychange",
        function () {

            if (!document.hidden) {

                // جلوگیری از درخواست‌های خیلی نزدیک
                // به آخرین درخواست دریافت اخبار
                const timeSinceLastFetch =
                    Date.now() - lastFetchTime;

                if (
                    timeSinceLastFetch >= 60 * 1000
                ) {
                    loadGamingNews();
                }
            }
        }
    );

});