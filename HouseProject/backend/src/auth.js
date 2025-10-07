// backend/src/auth.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// users.json is in backend/src/data/users.json
const usersFile = path.join(__dirname, "data", "users.json");


export async function verifyUser(email, password) {
  const raw = await fs.readFile(usersFile, "utf-8");
  const users = JSON.parse(raw);

  const user = users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
  if (!user) return null;

  if (String(user.password) !== String(password)) return null;

  return { id: user.id, email: user.email, name: user.name ?? "" };
}
