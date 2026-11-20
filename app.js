// =========================================================
// CONFIGURATION - ඔයාගේ GitHub විස්තර මෙතනට දාන්න
// =========================================================
const GITHUB_USERNAME = "YOUR_GITHUB_USERNAME"; // උදා: "janithprabodha"
const REPO_NAME = "luma-creation";              // ඔයා හදපු Repository එකේ නම
const BRANCH = "main";                          // සාමාන්‍යයෙන් "main"

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
// 1. LOAD PORTFOLIO IMAGES ON PAGE LOAD
// =========================================================
async function loadPortfolio() {
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${BRANCH}/data.json?t=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            portfolioData = await response.json();
        }
    } catch (error) {
        console.log("Loading initial empty portfolio...");
    }
    renderAllCategories();
}

function renderAllCategories() {
    const categories = ["bakery", "coffee", "restaurant", "food"];
    
    categories.forEach(cat => {
        const grid = document.getElementById(`grid-${cat}`);
        grid.innerHTML = "";
        
        const items = portfolioData[cat] || [];
        
        if (items.length === 0) {
            grid.innerHTML = `<div class="empty-placeholder">No designs uploaded yet.</div>`;
            return;
        }

        items.forEach(item => {
            const card = document.createElement("div");
            card.className = "design-card";
            card.innerHTML = `
                <img src="${item.url}" alt="${item.title || 'Design'}" loading="lazy">
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

    if (githubToken) {
        renderAdminImageList();
    }
}

closeLightbox.onclick = () => lightboxModal.style.display = "none";
lightboxModal.onclick = (e) => {
    if (e.target === lightboxModal) lightboxModal.style.display = "none";
};

// =========================================================
// 2. ADMIN LOCK & TOKEN/REPO VERIFICATION
// =========================================================
lockBtn.addEventListener("click", () => {
    adminModal.style.display = "flex";
    loginError.textContent = "";
    verifyChecklist.style.display = "none";

    if (githubToken) {
        showDashboard();
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
    const checks = [
        { label: "Token authentication", ok: false },
        { label: `Repository access (${GITHUB_USERNAME}/${REPO_NAME})`, ok: false },
        { label: "Write permission (push/contents)", ok: false },
        { label: "data.json file found", ok: false }
    ];

    // 1. Check Token User
    const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}` }
    });
    if (!userRes.ok) {
        renderVerifyChecklist(checks);
        throw new Error("Invalid GitHub Token.");
    }
    checks[0].ok = true;

    // 2. Check Repository & Push Permission
    const repoRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}`, {
        headers: { Authorization: `token ${token}` }
    });
    if (!repoRes.ok) {
        renderVerifyChecklist(checks);
        throw new Error("Repository not found or token has no access to it.");
    }
    const repoInfo = await repoRes.json();
    checks[1].ok = true;

    const canPush = Boolean(repoInfo.permissions && repoInfo.permissions.push);
    checks[2].ok = canPush;
    if (!canPush) {
        renderVerifyChecklist(checks);
        throw new Error("Token lacks write permission. Enable 'repo' (Classic) or 'Contents: Read & write' (Fine-grained).");
    }

    // 3. Check data.json existence
    const dataRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json?ref=${BRANCH}`, {
        headers: { Authorization: `token ${token}` }
    });
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
// 3. UPLOAD IMAGE WITH LIVE PROGRESS INDICATOR
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
        // Step 1: Convert Image to Base64
        const base64Content = await toBase64(file);
        const cleanBase64 = base64Content.split(",")[1];
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const fileName = `images/${category}_${Date.now()}.${ext}`;

        // Step 2: Upload Image File to GitHub
        setUploadProgress(45, "Uploading image to GitHub...");
        const imgUploadRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${fileName}`, {
            method: "PUT",
            headers: {
                Authorization: `token ${githubToken}`,
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
            throw new Error(errBody.message || "Image upload failed. Check token write permissions.");
        }

        const rawImageUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${BRANCH}/${fileName}`;

        // Step 3: Update data.json in GitHub
        setUploadProgress(80, "Updating data.json database...");
        await updateDataJson((data) => {
            if (!data[category]) data[category] = [];
            data[category].push({
                id: Date.now(),
                title: title,
                path: fileName,
                url: rawImageUrl
            });
            return data;
        });

        setUploadProgress(100, "Completed!");
        uploadStatus.style.color = "#4caf50";
        uploadStatus.textContent = "Design uploaded successfully!";
        document.getElementById("upload-title").value = "";
        fileInput.value = "";
        
        renderAllCategories();

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
    
    const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, {
        headers: { Authorization: `token ${githubToken}` }
    });
    if (!getRes.ok) {
        throw new Error("Could not read data.json. Check token permissions.");
    }

    const fileData = await getRes.json();
    const decodedText = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ""))));
    const currentContent = JSON.parse(decodedText);
    
    const updatedData = modifierCallback(currentContent);
    portfolioData = updatedData;

    const updatedBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(updatedData, null, 2))));
    
    const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
            Authorization: `token ${githubToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: "Update portfolio data.json",
            content: updatedBase64,
            sha: fileData.sha,
            branch: BRANCH
        })
    });

    if (!putRes.ok) {
        throw new Error("Failed to update data.json. Check token write permissions.");
    }
}

// =========================================================
// 4. DELETE IMAGE FROM ADMIN PANEL
// =========================================================
function renderAdminImageList() {
    const listContainer = document.getElementById("admin-image-list");
    listContainer.innerHTML = "";

    Object.keys(portfolioData).forEach(cat => {
        (portfolioData[cat] || []).forEach(item => {
            const thumb = document.createElement("div");
            thumb.className = "admin-thumb";
            thumb.innerHTML = `
                <img src="${item.url}" alt="thumb">
                <button class="delete-img-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
            `;

            thumb.querySelector(".delete-img-btn").addEventListener("click", async () => {
                if (!confirm("Delete this design?")) return;
                
                thumb.style.opacity = "0.4";
                try {
                    await updateDataJson((data) => {
                        data[cat] = data[cat].filter(i => i.id !== item.id);
                        return data;
                    });
                    renderAllCategories();
                } catch (e) {
                    alert("Error deleting image.");
                    thumb.style.opacity = "1";
                }
            });

            listContainer.appendChild(thumb);
        });
    });
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
