// ===== 1. 作品資料 =====
// 資料和畫面分開：新增作品只要在陣列加一筆，不用動 HTML。
// 之後接上後端時，這份資料就可以改成用 fetch() 從 API 拿。
const projects = [
  {
    title: "個人網站",
    description: "就是你正在看的這個網站，用純 HTML/CSS/JS 製作。",
    link: "https://github.com/Jason-0723/jason-0723.github.io",
  },
  {
    title: "作品二",
    description: "之後做的留言板、Todo App 等等都可以放在這裡。",
    link: "#",
  },
];

// 把資料轉成 HTML 卡片並放進頁面（DOM 操作）
function renderProjects() {
  const list = document.getElementById("project-list");
  for (const p of projects) {
    const card = document.createElement("div");
    card.className = "card";
    // 用 textContent 而不是 innerHTML 塞文字，可以避免 XSS 攻擊
    const title = document.createElement("h3");
    title.textContent = p.title;
    const desc = document.createElement("p");
    desc.textContent = p.description;
    const link = document.createElement("a");
    link.href = p.link;
    link.textContent = "查看 →";
    link.target = "_blank";
    link.rel = "noopener";
    card.append(title, desc, link);
    list.appendChild(card);
  }
}

// ===== 2. 深色模式切換 =====
// localStorage 是瀏覽器內建的小型儲存空間，重新整理後設定還會在
const toggle = document.getElementById("theme-toggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme; // 設定 <html data-theme="...">
  toggle.textContent = theme === "dark" ? "☀️" : "🌙";
}

toggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("theme", next);
});

// 第一次進來：優先用使用者上次的選擇，否則跟隨系統設定
const saved = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(saved || (prefersDark ? "dark" : "light"));

// ===== 3. 頁尾年份自動更新 =====
document.getElementById("year").textContent = new Date().getFullYear();

renderProjects();
