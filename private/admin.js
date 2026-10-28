// ===== 私人空間管理：文字 <-> 資料 的轉換，以及產生 vault.json =====

const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme = savedTheme || (prefersDark ? "dark" : "light");

const MIN_PASSWORD_LENGTH = 8;

// "## 標題\n內容" → [{ title, body }]
function parseNotes(text) {
  const notes = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      notes.push({ title: line.slice(3).trim(), body: "" });
    } else if (notes.length > 0) {
      notes[notes.length - 1].body += line + "\n";
    } else if (line.trim()) {
      throw new Error("筆記要以「## 標題」開頭");
    }
  }
  for (const n of notes) n.body = n.body.trim();
  return notes;
}

function stringifyNotes(notes) {
  return notes.map((n) => `## ${n.title}\n${n.body}`).join("\n\n");
}

// "名稱 | 網址" → [{ title, url }]
function parseLinks(text) {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      const sep = line.lastIndexOf("|");
      if (sep === -1) throw new Error(`網址第 ${i + 1} 行少了「|」`);
      return { title: line.slice(0, sep).trim(), url: line.slice(sep + 1).trim() };
    });
}

function stringifyLinks(links) {
  return links.map((l) => `${l.title} | ${l.url}`).join("\n");
}

// "帳號:密碼" → [{ username, password }]，同時檢查格式
function parseUsers(text) {
  const users = [];
  const seen = new Set();
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    // 半形和全形冒號都接受，只切第一個，所以密碼裡可以有冒號
    const sep = line.search(/[:：]/);
    if (sep === -1) throw new Error(`帳號第 ${i + 1} 行少了「:」`);
    const username = line.slice(0, sep).trim();
    const password = line.slice(sep + 1);
    if (!username) throw new Error(`帳號第 ${i + 1} 行沒有帳號名稱`);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`「${username}」的密碼太短，至少要 ${MIN_PASSWORD_LENGTH} 個字`);
    }
    const key = username.toLowerCase();
    if (seen.has(key)) throw new Error(`帳號「${username}」重複了`);
    seen.add(key);
    users.push({ username, password });
  });
  if (users.length === 0) throw new Error("至少要有一個帳號");
  return users;
}

// ① 載入現有內容
const loadForm = document.getElementById("load-form");
const loadMessage = document.getElementById("load-message");

loadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const btn = loadForm.querySelector("button");
  btn.disabled = true;
  loadMessage.className = "message";
  loadMessage.textContent = "解密中…";
  try {
    const res = await fetch("vault.json", { cache: "no-store" });
    if (!res.ok) throw new Error("找不到 vault.json");
    const content = await Vault.open(
      await res.json(),
      document.getElementById("load-user").value,
      document.getElementById("load-pass").value
    );
    document.getElementById("notes").value = stringifyNotes(content.notes || []);
    document.getElementById("links").value = stringifyLinks(content.links || []);
    loadMessage.className = "message ok";
    loadMessage.textContent = "已載入目前的內容 ✔";
  } catch (err) {
    loadMessage.className = "message error";
    loadMessage.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// ② ~ ④ 產生新的 vault.json 並下載
const generateBtn = document.getElementById("generate");
const generateMessage = document.getElementById("generate-message");

generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  generateMessage.className = "message";
  generateMessage.textContent = "加密中…（每個帳號約需零點幾秒）";
  try {
    const content = {
      notes: parseNotes(document.getElementById("notes").value),
      links: parseLinks(document.getElementById("links").value),
    };
    const users = parseUsers(document.getElementById("users").value);
    const vault = await Vault.create(content, users);

    // 把 JSON 包成檔案，用一個暫時的 <a download> 觸發下載
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vault.json";
    a.click();
    URL.revokeObjectURL(a.href);

    generateMessage.className = "message ok";
    generateMessage.textContent = `完成！已為 ${users.length} 個帳號產生 vault.json，請上傳到 GitHub 的 private/ 資料夾。`;
  } catch (err) {
    generateMessage.className = "message error";
    generateMessage.textContent = err.message;
  } finally {
    generateBtn.disabled = false;
  }
});
