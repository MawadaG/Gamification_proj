// backend/src/server.js
import http from "http";
import fs from "fs";
import path from "path";
import fsPromises from "fs/promises";
import { fileURLToPath } from "url";
import { verifyUser } from "./auth.js";
import { createSession, getUserIdFromToken, deleteSession } from "./sessions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "data", "users.json");
const HOUSES_FILE = path.join(__dirname, "data", "houses.json");
const LEADERBOARD_FILE = path.join(__dirname, "data", "leaderboard.json");
const htmlPath = path.join(__dirname, "../../frontend/html");


async function getUserById(id) {
    const raw = await fsPromises.readFile(USERS_FILE, "utf-8");
    const users = JSON.parse(raw);
    return users.find(u => String(u.id) === String(id)) || null;
}



async function readLeaderboard() {
    const raw = await fsPromises.readFile(LEADERBOARD_FILE, "utf-8");
    // ensure sorted by points desc & ranks present
    const arr = JSON.parse(raw).slice().sort((a, b) => (b.points || 0) - (a.points || 0));
    return arr.map((r, i) => ({ rank: r.rank ?? i + 1, ...r }));
}

async function readUsers() {
    const raw = await fsPromises.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw);
}
async function writeUsers(users) {
    await fsPromises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}
async function readHouses() {
    const raw = await fsPromises.readFile(HOUSES_FILE, "utf-8");
    return JSON.parse(raw);
}


// ---------- Helpers ----------
function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("<h1>404 Not Found</h1>");
        } else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        }
    });
}

function parseCookies(req) {
    const header = req.headers.cookie || "";
    return header.split(";").reduce((acc, part) => {
        const [k, v] = part.trim().split("=");
        if (k && v !== undefined) acc[k] = decodeURIComponent(v);
        return acc;
    }, {});
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => (data += chunk));
        req.on("end", () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on("error", reject);
    });
}

function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}

// Pages you want to protect (require login)
const protectedRoutes = new Set([
    "/", "/homepage", "/homepage.html",
    "/commonRoom", "/commonRoom.html",
    "/upcoming", "/upcoming.html"
]);

function isHtmlRoute(url) {
    // Known HTML routes we serve explicitly
    return ["/", "/homepage", "/homepage.html", "/login", "/login.html", "/signin", "/signin.html",
        "/upcoming", "/upcoming.html", "/commonRoom", "/commonRoom.html"].includes(url);
}

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
    const url = req.url.split("?")[0]; // ignore querystring
    const method = req.method.toUpperCase();
    const cookies = parseCookies(req);

    // ========== API: LOGIN ==========
    if (method === "POST" && url === "/api/login") {
        try {
            const body = await readJsonBody(req);
            const { email, password } = body || {};
            if (!email || !password) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Email and password are required" }));
            }

            const user = await verifyUser(email, password);
            if (!user) {
                res.writeHead(401, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Invalid credentials" }));
            }

            const token = createSession(user.id);

            // HttpOnly cookie so frontend JS doesn't need to store tokens
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`
            });
            return res.end(JSON.stringify({ ok: true, user: { id: user.id, email: user.email, name: user.name } }));
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // POST /api/logout  → clears session cookie
    if (method === "POST" && url === "/api/logout") {
        const token = cookies.session;
        deleteSession(token); // from sessions.js
        res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
        });
        return res.end(JSON.stringify({ ok: true }));
    }


    // ========== Protected Page Gate ==========
    if (protectedRoutes.has(url)) {
        const token = cookies.session;
        const userId = getUserIdFromToken(token);
        if (!userId) {
            return redirect(res, "/login");
        }
    }

    // POST /api/signup  → create user, auto-login
    if (method === "POST" && url === "/api/signup") {
        try {
            const body = await readJsonBody(req); // you already have readJsonBody(req)
            const { name, email, password, confirmPassword } = body || {};

            // Basic validation
            if (!name || !email || !password || !confirmPassword) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "All fields are required" }));
            }
            if (password !== confirmPassword) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Passwords do not match" }));
            }

            const users = await readUsers();
            const exists = users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
            if (exists) {
                res.writeHead(409, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Email already registered" }));
            }


            const houses = await readHouses();
            const houseNames = houses.map(h => h.name);
            let assignedHouse = (body.house && houseNames.includes(body.house))
                ? body.house
                : houses[Math.floor(Math.random() * houses.length)].name;

            const newId = users.length ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1;
            const newUser = {
                id: newId,
                name,
                email,
                house: assignedHouse,
                points: 0,
                level: 1,
                streak: 0,
                badges: [],
                lastActive: new Date().toISOString(),
                password
            };


            users.push(newUser);
            await writeUsers(users);

            // Auto-login by creating a session cookie
            const token = createSession(newUser.id); // from sessions.js
            res.writeHead(201, {
                "Content-Type": "application/json",
                "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`
            });
            const { password: _, ...safe } = newUser;
            return res.end(JSON.stringify({ ok: true, user: safe }));
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // GET /api/leaderboard → returns sorted leaderboard
    if (method === "GET" && url === "/api/leaderboard") {
        try {
            const data = await readLeaderboard();
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }


    // GET /api/me  → returns the logged-in user's profile (sans password)
    if (method === "GET" && url === "/api/me") {
        const token = cookies.session;
        const userId = getUserIdFromToken(token);   // already available from sessions.js
        if (!userId) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Not authenticated" }));
        }

        try {
            const user = await getUserById(userId);
            if (!user) {
                res.writeHead(404, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "User not found" }));
            }
            const { password, ...safe } = user;
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(safe));
        } catch {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // GET /api/houses → returns [{id,name,points,color}, ...]
    if (method === "GET" && url === "/api/houses") {
        try {
            const houses = await readHouses(); // you already added readHouses()
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(houses));
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // ========== HTML Routes ==========
    if (url === "/" || url === "/homepage" || url === "/homepage.html") {
        return serveFile(res, path.join(htmlPath, "homepage.html"), "text/html");
    } else if (url === "/login" || url === "/login.html") {
        return serveFile(res, path.join(htmlPath, "login.html"), "text/html");
    } else if (url === "/signin" || url === "/signin.html") {
        return serveFile(res, path.join(htmlPath, "signin.html"), "text/html");
    } else if (url === "/upcoming" || url === "/upcoming.html") {
        return serveFile(res, path.join(htmlPath, "upcoming.html"), "text/html");
    } else if (url === "/commonRoom" || url === "/commonRoom.html") {
        return serveFile(res, path.join(htmlPath, "commonRoom.html"), "text/html");
    }

    // ========== Static assets (CSS/JS/Images) ==========
    // Anything else: try to serve from frontend (keeps your previous generic handler)
    const filePath = path.join(__dirname, "../../frontend", url);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".css": "text/css",
        ".js": "text/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon"
    };
    const contentType = mimeTypes[ext];

    if (contentType) {
        return fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { "Content-Type": "text/html" });
                return res.end("<h1>404 Not Found</h1>");
            }
            res.writeHead(200, { "Content-Type": contentType });
            return res.end(data);
        });
    }

    // If the request looks like an HTML that we don't recognize, 404
    if (isHtmlRoute(url) || ext === ".html") {
        res.writeHead(404, { "Content-Type": "text/html" });
        return res.end("<h1>404 Not Found</h1>");
    }

    // Fallback 404 (unknown asset)
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

