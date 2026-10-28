// ===== 私人空間：登入與顯示 =====

// 沿用主網站的深色模式設定
const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme = savedTheme || (prefersDark ? "dark" : "light");

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");
const submitBtn = form.querySelector("button");

form.addEventListener("submit", async (event) => {
  event.preventDefault(); // 阻止表單預設的「送出並重新整理頁面」
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  message.className = "message";
  message.textContent = "解密中…";

  try {
    // cache: "no-store" 確保每次都拿最新的 vault.json（例如你剛移除某個帳號）
    const res = await fetch("vault.json", { cache: "no-store" });
    if (!res.ok) throw new Error("找不到 vault.json");
    const vault = await res.json();
    const content = await Vault.open(vault, username, password);
    showContent(username.trim(), content);
  } catch (err) {
    message.className = "message error";
    message.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// 只允許 http/https 網址，避免 javascript: 這類連結被拿來執行程式碼
function isSafeUrl(url) {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function showContent(username, content) {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("content-view").classList.remove("hidden");
  document.getElementById("welcome").textContent = `歡迎，${username} 👋`;

  const notes = document.getElementById("notes");
  for (const n of content.notes || []) {
    const box = document.createElement("article");
    box.className = "note";
    const title = document.createElement("h3");
    title.textContent = n.title;
    const body = document.createElement("p");
    body.textContent = n.body;
    box.append(title, body);
    notes.appendChild(box);
  }

  const links = document.getElementById("links");
  for (const l of content.links || []) {
    const li = document.createElement("li");
    if (isSafeUrl(l.url)) {
      const a = document.createElement("a");
      a.href = l.url;
      a.textContent = l.title || l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      li.appendChild(a);
    } else {
      li.textContent = `${l.title}（網址格式不正確）`;
    }
    links.appendChild(li);
  }
}

// 登出：解密後的內容只存在記憶體裡，重新載入頁面就全部清掉了
document.getElementById("logout").addEventListener("click", () => {
  location.reload();
});
