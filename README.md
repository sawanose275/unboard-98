# 💿 UnBoard 98

A client-side Spotify playlist organizer with a modernized Windows 98 aesthetic. Shuffle and sort playlists of **any size** directly in your browser — no backend required.

## ✨ Features

### 🔀 Shuffle Modes
- **Full Shuffle** — Randomizes every track in the playlist (Fisher-Yates)
- **Shuffle by Album** — Randomizes album order while keeping each album's tracks grouped together
- **Shuffle by Artist** — Randomizes artist order while keeping each artist's tracks grouped together
- **Shuffle by Name** — Groups tracks by starting letter and shuffles both groups and tracks

### 🔤 Sorting Modes
- **Track Name** — A → Z / Z → A
- **Artist** — A → Z / Z → A
- **Album** — A → Z / Z → A
- **Release Date** — Newest / Oldest
- **Duration** — Longest / Shortest
- **Popularity** — Most Popular / Least Popular
- **Date Added** — Newest / Oldest

### 🌐 Automatic Multi-Language Support
Automatically detects your browser language (defaults to English) with instant switching in the taskbar:
`EN` English · `PT` Português · `ES` Español · `FR` Français · `DE` Deutsch · `IT` Italiano · `JA` 日本語 · `KO` 한국어 · `ZH` 中文 · `RU` Русский

### 🛠️ Highlights
- Works with playlists of **any length** (automatic pagination + chunked updates)
- Live preview & undo before saving changes to Spotify
- 100% static client-side app using Spotify's **OAuth 2.0 PKCE** flow (no client secret needed)

---

## 🚀 Setup & Usage

### 1. Create a Spotify App
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Under **Redirect URIs**, add your site's exact URL:
   - **GitHub Pages:** `https://<your-username>.github.io/<repo-name>/`
   - **Local testing:** `http://127.0.0.1:5500/`
4. Under **APIs used**, check **Web API**
5. Save and copy your **Client ID**

### 2. Run Locally
```bash
python3 -m http.server 5500 --bind 127.0.0.1
```
Then open `http://127.0.0.1:5500/` in your browser, click **Configure Client ID**, paste your Client ID, save, and click **Log in with Spotify**.

### 3. Deploy on GitHub Pages (Free + HTTPS)
1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Under **Build and deployment → Source**, select **Deploy from a branch**
4. Choose `main` and `/ (root)`, then click **Save**
5. Wait ~1 minute for your live HTTPS URL (`https://<your-username>.github.io/<repo-name>/`)
6. Add that exact URL as a **Redirect URI** in your Spotify Developer Dashboard

---

## 📁 Project Structure

```
UnBoard/
├── index.html              # Main HTML shell (Windows 98 desktop)
├── css/
│   └── style.css           # Translucent modernized Win98 styling
├── js/
│   ├── i18n.js             # Auto language detection + 10 languages
│   ├── spotify-auth.js     # OAuth 2.0 PKCE client-side auth
│   ├── spotify-api.js      # Spotify Web API wrapper (/items + /tracks fallback)
│   ├── sorters.js          # 18 shuffle & sorting algorithms
│   ├── app.js              # Playlist loading, preview & saving logic
│   └── desktop.js          # Window dragging, taskbar, start menu & language switcher
├── gifs/
│   └── ondas-azuis.gif     # Animated desktop background
├── .nojekyll               # Disables Jekyll processing on GitHub Pages
├── .gitignore
├── LICENSE
└── README.md
```

## 🔒 Privacy & Security

- Uses **OAuth 2.0 with PKCE** — no client secret is stored or exposed
- Tokens and settings stay strictly in your browser's `localStorage`
- Communicates directly with the official Spotify API (`api.spotify.com` / `accounts.spotify.com`)
- Note: Spotify's API only allows reordering playlists **owned by you** or **collaborative** playlists

## 📄 License

[MIT](LICENSE)
