// =========================================================
// CONFIGURATION - ඔයාගේ GitHub විස්තර මෙතනට දාන්න
// =========================================================
const GITHUB_USERNAME = "janithprabodha200511-lab"; // උදා: "janithprabodha"
const REPO_NAME = "Luma-Creation";              // ඔයා හදපු Repository එකේ නම
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
const uploadSubmitBtn = document.getElementById("upload-submit-btn");
const uploadStatus = document.getElementById("upload-status");
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
        // Cache bypass කරන්න timestamp එකක් එකතු කරනවා
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
            // Customer click කළාම ලොකුවට පේන්න
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

// Close Lightbox
closeLightbox.onclick = () => lightboxModal.style.display = "none";
lightboxModal.onclick = (e) => {
    if (e.target === lightboxModal) lightboxModal.style.display = "none";
};

// =========================================================
// 2. ADMIN LOCK & LOGIN LOGIC
// =========================================================
lockBtn.addEventListener("click", () => {
    adminModal.style.display = "flex";
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

loginSubmitBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    if (!token) {
        loginError.textContent = "Please enter your GitHub Token!";
        return;
    }

    loginSubmitBtn.textContent = "Verifying...";
    loginError.textContent = "";

    // GitHub API එකෙන් Token එක ඇත්තද කියලා check කරනවා
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}`, {
            headers: { Authorization: `token ${token}` }
        });

        if (res.ok) {
            githubToken = token;
            localStorage.setItem("luma_gh_token", token);
            tokenInput.value = "";
            showDashboard();
        } else {
            loginError.textContent = "Invalid Token or Repository not found!";
        }
    } catch (err) {
        loginError.textContent = "Network error. Please try again.";
    } finally {
        loginSubmitBtn.textContent = "Unlock Admin Panel";
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
// 3. UPLOAD IMAGE DIRECTLY TO GITHUB
// =========================================================
uploadSubmitBtn.addEventListener("click", async () => {
    const category = document.getElementById("upload-category").value;
    const title = document.getElementById("upload-title").value.trim();
    const fileInput = document.getElementById("upload-file");

    if (!fileInput.files.length) {
        uploadStatus.style.color = "#ff5252";
        uploadStatus.textContent = "Please select an image file first!";
        return;
    }

    const file = fileInput.files[0];
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    uploadStatus.style.color = "#F4B41A";
    uploadStatus.textContent = "Uploading image to GitHub...";

    try {
        // 1. Convert Image to Base64
        const base64Content = await toBase64(file);
        const cleanBase64 = base64Content.split(",")[1];
        
        // Unique file name එකක් හදනවා
        const ext = file.name.split(".").pop();
        const fileName = `images/${category}_${Date.now()}.${ext}`;

        // 2. Upload Image File to GitHub 'images/' folder
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

        if (!imgUploadRes.ok) throw new Error("Image upload failed");

        const rawImageUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${BRANCH}/${fileName}`;

        // 3. Update data.json in GitHub
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

        uploadStatus.style.color = "#4caf50";
        uploadStatus.textContent = "Design uploaded successfully!";
        document.getElementById("upload-title").value = "";
        fileInput.value = "";
        
        renderAllCategories();

    } catch (error) {
        console.error(error);
        uploadStatus.style.color = "#ff5252";
        uploadStatus.textContent = "Error uploading! Check your token permissions.";
    } finally {
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload to GitHub`;
    }
});

// Helper: Update data.json on GitHub
async function updateDataJson(modifierCallback) {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json`;
    
    // Get current file SHA
    const getRes = await fetch(apiUrl, {
        headers: { Authorization: `token ${githubToken}` }
    });
    const fileData = await getRes.json();
    const currentContent = JSON.parse(atob(fileData.content));
    
    // Modify data
    const updatedData = modifierCallback(currentContent);
    portfolioData = updatedData;

    // Save back to GitHub
    const updatedBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(updatedData, null, 2))));
    
    await fetch(apiUrl, {
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

// Convert File to Base64 Helper
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