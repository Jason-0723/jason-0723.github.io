// ===== 加密核心：登入頁和管理頁共用 =====
// 全部使用瀏覽器內建的 Web Crypto API（crypto.subtle），不需要任何套件。
//
// 設計：
//   1. 隨機產生一把「內容金鑰」，用 AES-GCM 加密筆記與網址
//   2. 每個帳號用 PBKDF2(帳號 + 密碼) 算出自己的「鑰匙 A」
//   3. 用每個人的鑰匙 A 各自加密一份內容金鑰，存在 users 陣列
//   登入時：算出鑰匙 A → 試著解開 users 裡的每一份 → 成功就拿到內容金鑰 → 解密內容
//   vault.json 是公開的，但裡面只有亂碼，沒有帳號名稱，也沒有密碼。

const Vault = (() => {
  // PBKDF2 疊代次數：越高越難暴力破解，但登入也會越慢（OWASP 建議 SHA-256 用 60 萬次）
  const ITERATIONS = 600000;

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ArrayBuffer/Uint8Array <-> Base64，因為 JSON 只能存文字
  function toBase64(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
  }
  function fromBase64(str) {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  }

  function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  // 帳號不分大小寫，前後空白忽略；帳號也一起放進 PBKDF2，不同人用同一個密碼也會得到不同鑰匙
  function normalizeUser(username) {
    return username.trim().toLowerCase();
  }

  // 帳號 + 密碼 → 鑰匙 A（AES-GCM 256 位元金鑰）
  async function deriveKey(username, password, salt, iterations) {
    const material = await crypto.subtle.importKey(
      "raw",
      enc.encode(normalizeUser(username) + "\n" + password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // AES-GCM 每次加密都需要一個不重複的 12 bytes IV（初始向量）
  async function encrypt(key, bytes) {
    const iv = randomBytes(12);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
    return { iv: toBase64(iv), data: toBase64(data) };
  }

  async function decrypt(key, box) {
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(box.iv) },
      key,
      fromBase64(box.data)
    );
  }

  function importContentKey(raw) {
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  // 產生新的 vault：content 是要保護的資料，users 是 [{ username, password }]
  // 每次都換一把新的內容金鑰，所以刪掉的帳號就算記得舊金鑰也解不開新內容
  async function create(content, users) {
    const salt = randomBytes(16);
    const contentKeyRaw = randomBytes(32);
    const contentKey = await importContentKey(contentKeyRaw);

    const entries = [];
    for (const u of users) {
      const keyA = await deriveKey(u.username, u.password, salt, ITERATIONS);
      entries.push(await encrypt(keyA, contentKeyRaw));
    }
    // 打亂順序，避免從排列位置猜出是誰
    entries.sort(() => Math.random() - 0.5);

    return {
      version: 1,
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: toBase64(salt) },
      users: entries,
      content: await encrypt(contentKey, enc.encode(JSON.stringify(content))),
    };
  }

  // 用帳密打開 vault，成功回傳內容，失敗丟出錯誤
  async function open(vault, username, password) {
    const keyA = await deriveKey(
      username,
      password,
      fromBase64(vault.kdf.salt),
      vault.kdf.iterations
    );
    for (const entry of vault.users) {
      try {
        // 鑰匙不對時 AES-GCM 會驗證失敗並丟出錯誤，所以可以用 try 來判斷
        const contentKeyRaw = await decrypt(keyA, entry);
        const contentKey = await importContentKey(contentKeyRaw);
        const plain = await decrypt(contentKey, vault.content);
        return JSON.parse(dec.decode(plain));
      } catch {
        // 不是這一份，繼續試下一份
      }
    }
    throw new Error("帳號或密碼錯誤");
  }

  return { create, open };
})();
