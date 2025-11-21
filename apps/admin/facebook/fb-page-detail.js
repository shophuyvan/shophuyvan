// =======================================
// FB PAGE DETAIL JS
// =======================================

// get query param
function getQuery(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

const pageId = getQuery("page_id");
if (!pageId) {
  alert("Thiếu page_id trong URL");
}

// DOM refs
const pageNameEl = document.getElementById("pageName");
const pageIdEl = document.getElementById("pageId");
const pageAvatarEl = document.getElementById("pageAvatar");
const pageTokenStatusEl = document.getElementById("pageTokenStatus");

// LOAD FANPAGE INFO
async function loadFanpageInfo() {
  try {
    const res = await Admin.api(`/facebook/page/info?page_id=${pageId}`);
    if (!res.ok) throw new Error(res.message);

    const p = res.page;

    pageNameEl.textContent = p.name;
    pageIdEl.textContent = pageId;
    pageAvatarEl.src = p.avatar || "";
    pageTokenStatusEl.textContent = p.token_status || "unknown";

  } catch (err) {
    pageNameEl.textContent = "Lỗi tải dữ liệu!";
    console.error(err);
  }
}

// TAB SWITCH
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

    tab.classList.add("active");
    const id = tab.getAttribute("data-tab");
    document.getElementById(`tab-${id}`).classList.add("active");

    if (id === "ads") loadAdsModule();
    if (id === "post") loadPostModule();
    if (id === "autoreply") loadAutoReplyModule();
    if (id === "creative") loadCreativeModule();
    if (id === "settings") loadSettings();
  });
});

// LOAD OVERVIEW
async function loadOverview() {
  document.getElementById("overviewContainer").innerHTML = "Đang tải dữ liệu...";

  const res = await Admin.api(`/facebook/page/overview?page_id=${pageId}`);
  if (!res.ok) {
    document.getElementById("overviewContainer").innerHTML = "Lỗi tải dữ liệu!";
    return;
  }

  const d = res.data;

  document.getElementById("overviewContainer").innerHTML = `
    <div class="row">
      <div class="col card">
        <h4>Bài viết gần đây</h4>
        <pre>${JSON.stringify(d.posts, null, 2)}</pre>
      </div>

      <div class="col card">
        <h4>Chiến dịch Ads</h4>
        <pre>${JSON.stringify(d.ads, null, 2)}</pre>
      </div>
    </div>
  `;
}

// LOAD ADS MODULE
async function loadAdsModule() {
  const el = document.getElementById("adsContainer");
  el.innerHTML = "Đang tải giao diện Ads...";

  el.innerHTML = `
    <iframe src="./ads.html?page_id=${pageId}" style="width:100%;height:1200px;border:0;border-radius:12px;background:white;"></iframe>
  `;
}

// LOAD POST MODULE
async function loadPostModule() {
  const el = document.getElementById("postContainer");
  el.innerHTML = `
    <iframe src="./ads.html?mode=post&page_id=${pageId}" style="width:100%;height:1200px;border:0;background:white;border-radius:12px;"></iframe>
  `;
}

// LOAD AUTO REPLY MODULE
async function loadAutoReplyModule() {
  const el = document.getElementById("autoReplyContainer");
  el.innerHTML = `
    <iframe src="./fanpages.html?mode=autoreply&page_id=${pageId}" style="width:100%;height:1200px;border:0;background:white;border-radius:12px;"></iframe>
  `;
}

// LOAD CREATIVE LIBRARY
async function loadCreativeModule() {
  const el = document.getElementById("creativeContainer");
  el.innerHTML = `
    <iframe src="./ads.html?mode=creative&page_id=${pageId}" style="width:100%;height:1200px;border:0;background:white;border-radius:12px;"></iframe>
  `;
}

// LOAD SETTINGS
async function loadSettings() {
  const el = document.getElementById("settingsContainer");

  const res = await Admin.api(`/facebook/page/settings?page_id=${pageId}`);

  if (!res.ok) {
    el.innerHTML = "Không tải được cài đặt!";
    return;
  }

  const s = res.settings;

  el.innerHTML = `
    <label>Page ID</label>
    <input class="input" value="${pageId}" readonly>

    <label>Page Token</label>
    <textarea class="input" rows="4">${s.page_token || ""}</textarea>

    <button class="btn primary" style="margin-top:12px;">Lưu thay đổi</button>
  `;
}

// INIT
loadFanpageInfo();
loadOverview();
