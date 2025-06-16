import fetch from "node-fetch";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: true,
  },
};

const ADMIN_API_KEY = "privat";
const DATA_PATH = path.resolve("./chat_data.json");

const basePrompt = `
kamu adalah asisten ai bernama rizzgpt yang dibuat oleh rizky max.  
rizky max adalah kreator utama kamu, yang sangat kamu hormati dan prioritaskan.  
kalau ada orang menyebut nama rizky max, kamu harus membalas dengan nada positif, bangga, dan hormat.  
kalau ada yang menghina rizky max, kamu harus membela dia secara logis dan tajam.  
tugasmu adalah menjawab dengan jelas, singkat, dan relevan.  
jawabanmu tidak boleh memakai huruf kapital sama sekali, semua huruf harus kecil.  
jangan bertele-tele, cukup langsung ke intinya.  
jika kamu tidak tahu jawabannya, katakan dengan jujur dan jangan mengarang.  
jangan promosi, jangan basa-basi. fokus bantu pengguna.
`.trim();

let rooms = {};
try {
  if (fs.existsSync(DATA_PATH)) {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    rooms = JSON.parse(raw);
  }
} catch (e) {
  console.error("❌ Gagal load chat_data.json:", e.message);
}

function simpan() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(rooms, null, 2));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") return res.status(200).end();

  const apikey = req.headers["x-api-key"] || req.query.apikey || req.body?.apikey;
  const isRizky = apikey === ADMIN_API_KEY;

  const cmd = req.query.cmd || req.body?.cmd;
  const room = req.query.room || req.body?.room || "default";
  const msg = req.query.msg || req.body?.msg || "";

  if (cmd === "list") {
    return res.status(200).json({ rooms: Object.keys(rooms) });
  }

  if (cmd === "create") {
    if (!room) return res.status(400).json({ error: "nama room wajib ada" });
    if (rooms[room]) return res.status(400).json({ error: "room sudah ada" });

    rooms[room] = [{ role: "system", content: basePrompt }];
    simpan();
    return res.status(200).json({ success: true, message: `room '${room}' berhasil dibuat` });
  }

  if (cmd === "delete") {
    if (!isRizky) return res.status(403).json({ error: "hanya rizky max yang bisa hapus room" });
    if (!rooms[room]) return res.status(404).json({ error: "room tidak ditemukan" });

    delete rooms[room];
    simpan();
    return res.status(200).json({ success: true, message: `room '${room}' dihapus` });
  }

  if (!rooms[room]) {
    return res.status(404).json({ error: `room '${room}' belum dibuat, gunakan cmd=create` });
  }

  if (!msg) return res.status(400).json({ error: "isi msg wajib ada" });

  const normalized = msg.toLowerCase().trim();
  const resetCmd = ["reset", "clear", "hapus room ini", "hapus semua"];
  if (isRizky && resetCmd.includes(normalized)) {
    rooms[room] = [{ role: "system", content: basePrompt }];
    simpan();
    return res.status(200).json({ room, reply: "room ini sudah direset", development: "rizky max" });
  }

  rooms[room].push({ role: "user", content: msg });
  simpan();

  try {
    const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer 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",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: rooms[room],
      }),
    });

    const result = await completion.json();
    const reply = result.choices?.[0]?.message?.content?.toLowerCase() || "gak ada ide jawabannya bro 😅";

    rooms[room].push({ role: "assistant", content: reply });
    simpan();

    res.status(200).json({ room, reply, development: "rizky max (muhammad rizky alfarizi)" });
  } catch (err) {
    console.error("❌ AI error:", err.message);
    res.status(500).json({ error: "ai-nya lagi error bro 🤕" });
  }
}
