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

## 🚀 Live Site & Usage

**Live URL:** [https://sawanose275.github.io/unboard-98/](https://sawanose275.github.io/unboard-98/)

### 1. Create Your Spotify App (1 minute)
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and click **Create App**
2. Under **Redirect URIs**, add the site's exact URL:
   - **Live site:** `https://sawanose275.github.io/unboard-98/`
   - **Local testing:** `http://127.0.0.1:5500/`
3. Under **APIs used**, check **Web API**
4. Save and copy your **Client ID**

### 2. Organize Your Playlists
1. Open **UnBoard 98**
2. Click **Configure Client ID**, paste your Client ID, and click **Save**
3. Click **Log in with Spotify** and authorize access
4. Select any playlist created by you (or collaborative)
5. Pick a shuffle/sort mode, preview the new track order, and click **Save to Spotify**

### Running Locally
```bash
python3 -m http.server 5500 --bind 127.0.0.1
```
Open `http://127.0.0.1:5500/` in your browser.

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
