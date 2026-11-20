// =========================================================
// CONFIGURATION - ඔයාගේ GitHub විස්තර මෙතනට දාන්න
// =========================================================
const GITHUB_USERNAME = "janithprabodha200511-lab
"; // උදා: "janithprabodha"
const REPO_NAME = "Luma-Creation";              // ඔයා හදපු Repository එකේ නම
let BRANCH = "main";                            // Auto-detected on verify/load if different

// =========================================================
// APP STATE & DOM ELEMENTS
// =========================================================
let portfolioData = {
    bakery: [],
    coffee: [],
    restaurant: [],
    food: []
};

let githubToken = localStorage.getItem("luma_gh_token") || "";

// DOM Elements
const lockBtn = document.getElementById("admin-lock-btn");
const adminModal = document.getElementById("admin-modal");
const closeAdminBtn = document.getElementById("close-admin");
const loginView = document.getElementById("admin-login-view");
const dashboardView = document.getElementById("admin-dashboard-view");
const tokenInput = document.getElementById("github-token-input");
const loginSubmitBtn = document.getElementById("login-submit-btn");
const loginError = document.getElementById("login-error");
const verifyChecklist = document.getElementById("verify-checklist");

const uploadSubmitBtn = document.getElementById("upload-submit-btn");
const uploadStatus = document.getElementById("upload-status");
const progressWrap = document.getElementById("upload-progress-wrap");
const progressBar = document.getElementById("upload-progress-bar");
const progressPercent = document.getElementById("upload-percent");
const uploadStatusText = document.getElementById("upload-status-text");
const logoutBtn = document.getElementById("logout-btn");

// Lightbox Elements
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImg = document.getElementById("lightbox-img");
const closeLightbox = document.querySelector(".close-lightbox");

// =========================================================
// HELPER: UTF-8 BASE64 ENCODE / DECODE
// =========================================================
function decodeBase64Utf8(base64Str) {
    const clean = (base64Str || "").replace(/\n/g, "");
    const binaryStr = atob(clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
}

function encodeUtf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function normalizePortfolioData(raw) {
    const safe = raw && typeof raw === "object" ? raw : {};
    return {
        bakery: Array.isArray(safe.bakery) ? safe.bakery : [],
        coffee: Array.isArray(safe.coffee) ? safe.coffee : [],
        restaurant: Array.isArray(safe.restaurant) ? safe.restaurant : [],
        food: Array.isArray(safe.food) ? safe.food : []
    };
}

// =========================================================
// 1. FETCH LATEST DATA.JSON & RENDER PORTFOLIO + ADMIN LIST
// =========================================================
async function fetchLatestDataJson(token = "") {
    const headers = {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `token ${token}` } : {})
    };

    const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json?ref=${encodeURIComponent(BRANCH)}&t=${Date.now()}`;
    let res = await fetch(apiUrl, { headers, cache: "no-store" });

    // If configured branch doesn't match, try without ref (uses repo default branch)
    if (!res.ok && res.status === 404) {
        const fallbackUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json?t=${Date.now()}`;
        res = await fetch(fallbackUrl, { headers, cache: "no-store" });
    }

    if (!res.ok) {
        throw new Error(`Could not load data.json (HTTP ${res.status}).`);
    }

    const fileData = await res.json();
    const jsonText = decodeBase64Utf8(fileData.content);
    const parsed = JSON.parse(jsonText);

    return {
        sha: fileData.sha,
        data: normalizePortfolioData(parsed)
    };
}

async function loadPortfolio() {
    try {
        const latest = await fetchLatestDataJson(githubToken);
        portfolioData = latest.data;
    } catch (error) {
        console.warn("API fetch fallback to raw:", error.message);
        try {
            const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${BRANCH}/data.json?t=${Date.now()}`;
            const response = await fetch(rawUrl, { cache: "no-store" });
            if (response.ok) {
                const rawJson = await response.json();
                portfolioData = normalizePortfolioData(rawJson);
            }
        } catch (e) {
            console.log("Initial portfolio load fallback:", e.message);
        }
    }

    renderAllCategories();
    if (githubToken) {
        renderAdminImageList();
    }
}

function renderAllCategories() {
    const categories = ["bakery", "coffee", "restaurant", "food"];

    categories.forEach(cat => {
        const grid = document.getElementById(`grid-${cat}`);
        if (!grid) return;

        grid.innerHTML = "";
        const items = portfolioData[cat] || [];

        if (items.length === 0) {
            grid.innerHTML = `<div class="empty-placeholder">No designs uploaded yet.</div>`;
            return;
        }

        items.forEach(item => {
            const card = document.createElement("div");
            card.className = "design-card";
            const imgSrc = item.url.includes("?") ? `${item.url}&v=${item.id || Date.now()}` : `${item.url}?v=${item.id || Date.now()}`;

            card.innerHTML = `
                <img src="${imgSrc}" alt="${item.title || 'Design'}" loading="lazy">
                <div class="card-overlay">
                    <span>${item.title || 'View Design'}</span>
                </div>
            `;

            card.addEventListener("click", () => {
                lightboxModal.style.display = "flex";
                lightboxImg.src = item.url;
            });

            grid.appendChild(card);
        });
    });
}

closeLightbox.onclick = () => lightboxModal.style.display = "none";
lightboxModal.onclick = (e) => {
    if (e.target === lightboxModal) lightboxModal.style.display = "none";
};

// =========================================================
// 2. ADMIN LOCK & TOKEN/REPO VERIFICATION
// =========================================================
lockBtn.addEventListener("click", async () => {
    adminModal.style.display = "flex";
    loginError.textContent = "";
    verifyChecklist.style.display = "none";

    if (githubToken) {
        showDashboard();
        await loadPortfolio();
        renderAdminImageList();
    } else {
        loginView.style.display = "block";
        dashboardView.style.display = "none";
    }
});

closeAdminBtn.addEventListener("click", () => {
    adminModal.style.display = "none";
});

function renderVerifyChecklist(checks) {
    verifyChecklist.style.display = "block";
    verifyChecklist.innerHTML = checks.map(c => `
        <div class="verify-item ${c.ok ? "verify-ok" : "verify-fail"}">
            <i class="fa-solid ${c.ok ? "fa-circle-check" : "fa-circle-xmark"}"></i>
            <span>${c.label}</span>
        </div>
    `).join("");
}

async function verifyTokenAndRepo(token) {
    const headers = {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json"
    };

    const checks = [
        { label: "Token authentication", ok: false },
        { label: `Repository access (${GITHUB_USERNAME}/${REPO_NAME})`, ok: false },
        { label: "Write permission (push/contents)", ok: false },
        { label: "data.json file found", ok: false }
    ];

    const userRes = await fetch("https://api.github.com/user", { headers });
    if (!userRes.ok) {
        renderVerifyChecklist(checks);
        throw new Error("Invalid GitHub Token.");
    }
    checks[0].ok = true;

    const repoRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}`, { headers });
    if (!repoRes.ok) {
        renderVerifyChecklist(checks);
        throw new Error("Repository not found or token has no access to it.");
    }
    const repoInfo = await repoRes.json();
    if (repoInfo.default_branch) {
        BRANCH = repoInfo.default_branch;
    }
    checks[1].ok = true;

    const canPush = Boolean(repoInfo.permissions && repoInfo.permissions.push);
    checks[2].ok = canPush;
    if (!canPush) {
        renderVerifyChecklist(checks);
        throw new Error("Token lacks write permission. Enable 'repo' (Classic) or 'Contents: Read & write' (Fine-grained).");
    }

    const dataRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json?ref=${encodeURIComponent(BRANCH)}`, { headers });
    checks[3].ok = dataRes.ok;
    renderVerifyChecklist(checks);

    if (!dataRes.ok) {
        throw new Error("data.json was not found in the repository root.");
    }

    return true;
}

loginSubmitBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    if (!token) {
        loginError.textContent = "Please enter your GitHub Token!";
        return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;
    loginError.textContent = "";
    verifyChecklist.style.display = "none";

    try {
        await verifyTokenAndRepo(token);
        githubToken = token;
        localStorage.setItem("luma_gh_token", token);
        tokenInput.value = "";
        showDashboard();
        await loadPortfolio();
        renderAdminImageList();
    } catch (err) {
        loginError.textContent = err.message || "Verification failed.";
    } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> Verify & Unlock Admin Panel`;
    }
});

function showDashboard() {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    renderAdminImageList();
}

logoutBtn.addEventListener("click", () => {
    githubToken = "";
    localStorage.removeItem("luma_gh_token");
    adminModal.style.display = "none";
});

// =========================================================
// 3. UPLOAD IMAGE WITH LIVE PROGRESS & VERIFIED SAVE
// =========================================================
function setUploadProgress(percent, text) {
    progressWrap.style.display = "block";
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    uploadStatusText.textContent = text;
}

uploadSubmitBtn.addEventListener("click", async () => {
    const category = document.getElementById("upload-category").value;
    const title = document.getElementById("upload-title").value.trim();
    const fileInput = document.getElementById("upload-file");

    uploadStatus.textContent = "";

    if (!githubToken) {
        uploadStatus.style.color = "#ff5252";
        uploadStatus.textContent = "Session expired. Please unlock Admin Panel again.";
        return;
    }

    if (!fileInput.files.length) {
        uploadStatus.style.color = "#ff5252";
        uploadStatus.textContent = "Please select an image file first!";
        return;
    }

    const file = fileInput.files[0];
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    setUploadProgress(15, "Reading image file...");

    try {
        const base64Content = await toBase64(file);
        const cleanBase64 = base64Content.split(",")[1];
        const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const uniqueId = Date.now();
        const fileName = `images/${category}_${uniqueId}.${ext || "png"}`;

        setUploadProgress(45, "Uploading image to GitHub...");
        const imgUploadRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${fileName}`, {
            method: "PUT",
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Upload ${fileName}`,
                content: cleanBase64,
                branch: BRANCH
            })
        });

        if (!imgUploadRes.ok) {
            const errBody = await imgUploadRes.json().catch(() => ({}));
            throw new Error(errBody.message || "Image upload failed.");
        }

        const rawImageUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${BRANCH}/${fileName}`;

        setUploadProgress(80, "Saving to data.json...");
        await updateDataJson((data) => {
            if (!Array.isArray(data[category])) data[category] = [];
            data[category].push({
                id: uniqueId,
                title: title,
                path: fileName,
                url: rawImageUrl
            });
            return data;
        });

        setUploadProgress(100, "Saved & Verified!");
        uploadStatus.style.color = "#4caf50";
        uploadStatus.textContent = "Design uploaded and saved to GitHub!";
        document.getElementById("upload-title").value = "";
        fileInput.value = "";

        renderAllCategories();
        renderAdminImageList();

    } catch (error) {
        console.error(error);
        progressWrap.style.display = "none";
        uploadStatus.style.color = "#ff5252";
        uploadStatus.textContent = `Error: ${error.message}`;
    } finally {
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload to GitHub`;
    }
});

async function updateDataJson(modifierCallback) {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json`;

    const latest = await fetchLatestDataJson(githubToken);
    const updatedData = normalizePortfolioData(modifierCallback(latest.data));
    const jsonString = JSON.stringify(updatedData, null, 2);
    const updatedBase64 = encodeUtf8ToBase64(jsonString);

    const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: "Update portfolio data.json",
            content: updatedBase64,
            sha: latest.sha,
            branch: BRANCH
        })
    });

    if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update data.json.");
    }

    // Re-fetch from GitHub to confirm persistence
    const confirmed = await fetchLatestDataJson(githubToken);
    portfolioData = confirmed.data;
}

// =========================================================
// 4. DELETE IMAGE FROM ADMIN PANEL
// =========================================================
function renderAdminImageList() {
    const listContainer = document.getElementById("admin-image-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";
    const categories = ["bakery", "coffee", "restaurant", "food"];
    let totalCount = 0;

    categories.forEach(cat => {
        (portfolioData[cat] || []).forEach(item => {
            totalCount++;
            const thumb = document.createElement("div");
            thumb.className = "admin-thumb";
            const imgSrc = item.url.includes("?") ? `${item.url}&v=${item.id || Date.now()}` : `${item.url}?v=${item.id || Date.now()}`;

            thumb.innerHTML = `
                <img src="${imgSrc}" alt="${item.title || 'thumb'}" loading="lazy">
                <button class="delete-img-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
            `;

            thumb.querySelector(".delete-img-btn").addEventListener("click", async () => {
                if (!confirm("Delete this design?")) return;

                thumb.style.opacity = "0.4";
                try {
                    await updateDataJson((data) => {
                        data[cat] = (data[cat] || []).filter(i => i.id !== item.id);
                        return data;
                    });
                    renderAllCategories();
                    renderAdminImageList();
                } catch (e) {
                    alert(`Error deleting image: ${e.message}`);
                    thumb.style.opacity = "1";
                }
            });

            listContainer.appendChild(thumb);
        });
    });

    if (totalCount === 0) {
        listContainer.innerHTML = `<p style="grid-column: 1 / -1; color: #888; font-size: 0.82rem;">No uploaded images found.</p>`;
    }
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Start App
loadPortfolio();
