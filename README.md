# ACM House Cup (Gamified Portal)

ACM House Cup is a gamified platform that boosts engagement in the ACM UDST Chapter. Members join one of four Houses and earn points by attending events and completing challenges. The website acts as a central hub for tracking progress, viewing leaderboards, and building team spirit through friendly competition.

done by:
Mawada
Salma
Aysha
Dania 
---

## ▶️ Run Locally

**Prerequisite:** Node.js v18+ (tested on v22.19.0)

```bash
# from project root
cd HouseProject\backend\src
node server.js


How to Use & Navigate
Login: /login (also via navbar) – use an existing user in users.json.
Sign Up: /signin.html – fill Name/Email/Password and Choose your House (dropdown).
Homepage: / – shows your profile (level/house), XP progress, badges, streak, Top 5 leaderboard.
Common Room: /commonRoom.html – (optional) shows house-only leaders.
Events: /upcoming.html
Logout: Navbar button appears when logged in.

🎮 Gamification Features (where & how)
Houses (houses.json): Assigned on signup (or chosen via dropdown). Each house has a color and points.
Where: Homepage header tint + “House Points” line.
XP & Level: Homepage shows progress bar and text (e.g., 750 / 1000 XP). (Simple rule: 1000 XP per level.)
Where: “XP Progress” card.
Badges: Rendered from the user’s badges list (e.g., ["💡 Innovator"]).
Where: “Badges” card on homepage.
Daily Streak: Shows consecutive-day activity count (e.g., 🔥 7 days).
Where: “Daily Streak” card.
Leaderboard: Global top 5 pulled from leaderboard.json via /api/leaderboard.
Where: “Leaderboard (Top 5)” card on homepage.
Common Room (optional): house-only ranking.

📁 Assets & Data
CSS: frontend/css/*.css (linked with root paths like /css/homepage.css).
Icons/Badges: Unicode emoji (no external licenses).
Data (JSON) – backend/src/data/:
users.json – user profiles; contains email, password (demo, plaintext), house, points, level, streak, badges.
houses.json – house list with name, points, color.
leaderboard.json – entries with name, house, points (sorted for top 5).
(Optional) events.json, badges.json.

🔌 API (dev)
POST /api/login – { email, password } → sets session cookie.
POST /api/logout – clears session.
POST /api/signup – { name, email, password, confirmPassword, house } → creates user + auto-login.
GET /api/me – returns current user (sans password).
GET /api/houses – list houses (for signup dropdown + colors).
GET /api/leaderboard – leaderboard data.
Auth uses an HttpOnly session cookie (in-memory sessions). Restarting the server clears sessions.