<div align="center">

# UnBoard 98

**A client-side Spotify playlist organizer with a modernized Windows 98 aesthetic.**

<p>
  <a href="https://sawanose275.github.io/unboard-98/">Live Site</a> ·
  <a href="#features">Features</a> ·
  <a href="#setup">Setup</a> ·
  <a href="#running-locally">Running Locally</a> ·
  <a href="#project-structure">Structure</a> ·
  <a href="#security--privacy">Security</a> ·
  <a href="#license">License</a>
</p>

<p>
  <img src="https://img.shields.io/badge/Spotify-Web_API-1DB954?style=flat-square&logo=spotify&logoColor=white" alt="Spotify Web API" />
  <img src="https://img.shields.io/badge/OAuth_2.0-PKCE-103b8c?style=flat-square" alt="OAuth 2.0 PKCE" />
  <img src="https://img.shields.io/badge/Languages-10-4b5563?style=flat-square" alt="10 Languages" />
  <img src="https://img.shields.io/badge/License-MIT-222222?style=flat-square" alt="MIT License" />
</p>

<img src="gifs/ondas-azuis.gif" alt="UnBoard 98 Background" width="520" />

</div>

---

UnBoard 98 lets you shuffle and sort Spotify playlists of **any size** directly in your browser. It runs 100% client-side with zero backend dependencies, automatic browser language detection across 10 languages, and a translucent Windows 98 desktop interface.

> [!NOTE]
> Spotify's Web API only allows reordering playlists **created by you** or **collaborative** playlists. Editorial and algorithmically generated playlists (such as Discover Weekly or Daily Mix) are read-only.

---

## Features

### Shuffle Modes

| Mode | Description |
| :--- | :--- |
| **Full Shuffle** | Randomizes every track in the playlist using Fisher-Yates |
| **Shuffle by Album** | Randomizes album order while keeping tracks from the same album grouped together |
| **Shuffle by Artist** | Randomizes artist order while keeping tracks from the same artist grouped together |
| **Shuffle by Name** | Groups tracks by starting letter and shuffles both groups and tracks inside them |

### Sorting Modes

| Criterion | Options |
| :--- | :--- |
| **Track Name** | A -> Z / Z -> A |
| **Artist** | A -> Z / Z -> A |
| **Album** | A -> Z / Z -> A |
| **Release Date** | Newest / Oldest |
| **Duration** | Longest / Shortest |
| **Popularity** | Most Popular / Least Popular |
| **Date Added** | Newest / Oldest |

### Highlights

- **Any playlist size** — automatic pagination when loading and chunked updates when saving.
- **Live preview and undo** — inspect the reordered tracklist before writing changes to Spotify.
- **Automatic multi-language detection** — detects your browser language automatically (falls back to English) with instant switching from the taskbar: `EN`, `PT`, `ES`, `FR`, `DE`, `IT`, `JA`, `KO`, `ZH`, `RU`.
- **Interactive desktop UI** — draggable windows, minimize/maximize controls, Start menu, and taskbar clock.

<div align="right"><a href="#unboard-98">[Top]</a></div>

---

## Setup

**Live URL:** https://sawanose275.github.io/unboard-98/

> [!IMPORTANT]
> Spotify restricts apps in **Development Mode** to a small manual allowlist of accounts. Because of this, each user creates their own free Spotify app (takes less than a minute) and pastes their **Client ID** in UnBoard 98. Your Client ID is stored only in your own browser.

### 1. Create a Spotify App

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and click **Create App**.
2. Fill in any app name and description.
3. Under **Redirect URIs**, add the exact URL where you will use UnBoard 98:
   - **Live site:** `https://sawanose275.github.io/unboard-98/`
   - **Local testing:** `http://127.0.0.1:5500/`
4. Under **APIs used**, check **Web API**.
5. Click **Save** and copy your **Client ID**.

> [!TIP]
> The Redirect URI must match character-for-character, including the trailing slash `/`.

### 2. Connect and Organize

1. Open [UnBoard 98](https://sawanose275.github.io/unboard-98/).
2. Click **Configure Client ID**, paste your Client ID, and click **Save**.
3. Click **Log in with Spotify** and authorize access.
4. Select one of your playlists, choose a shuffle or sort mode, and click **Save to Spotify**.

<div align="right"><a href="#unboard-98">[Top]</a></div>

---

## Running Locally

Clone the repository and serve it with any static HTTP server:

```bash
git clone https://github.com/sawanose275/unboard-98.git
cd unboard-98
python3 -m http.server 5500 --bind 127.0.0.1
```

Then open `http://127.0.0.1:5500/` in your browser.

> [!CAUTION]
> Always access the local server through the exact host registered in your Spotify Dashboard (`127.0.0.1` and `localhost` are treated as different Redirect URIs by Spotify).

<div align="right"><a href="#unboard-98">[Top]</a></div>

---

## Project Structure

```text
unboard-98/
├── index.html              # Main HTML shell (Windows 98 desktop layout)
├── css/
│   └── style.css           # Translucent modernized Windows 98 styling
├── js/
│   ├── i18n.js             # Automatic language detection + 10 languages
│   ├── spotify-auth.js     # OAuth 2.0 PKCE + CSRF state authentication
│   ├── spotify-api.js      # Spotify Web API wrapper (/items with /tracks fallback)
│   ├── sorters.js          # 18 shuffle and sorting algorithms
│   ├── app.js              # Playlist loading, preview, and saving logic
│   └── desktop.js          # Window dragging, taskbar, Start menu, and language switcher
├── gifs/
│   └── ondas-azuis.gif     # Animated desktop background
├── robots.txt              # Search engine crawl rules
├── sitemap.xml             # Sitemap for search indexing
├── .nojekyll               # Disables Jekyll processing on GitHub Pages
├── .gitignore
├── LICENSE
└── README.md
```

<div align="right"><a href="#unboard-98">[Top]</a></div>

---

## Security & Privacy

- **OAuth 2.0 with PKCE** — no client secret is stored or required.
- **CSRF protection** — validates a cryptographic `state` parameter on every callback using ephemeral `sessionStorage`.
- **Content Security Policy (CSP)** — restricts script execution to same-origin files and limits API calls strictly to `accounts.spotify.com` and `api.spotify.com`.
- **Minimal scopes** — only requests playlist read/modify and basic profile access (never requests your private email address).
- **Local-only storage** — your Client ID and access tokens remain strictly in your browser and are never sent to any third-party server.

<div align="right"><a href="#unboard-98">[Top]</a></div>

---

## Contributing

Contributions, bug reports, and suggestions are welcome:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/your-feature`).
3. Commit your changes and open a Pull Request.

---

## License

Released under the [MIT License](LICENSE).

<div align="right"><sub>UnBoard 98 — maintained by <a href="https://github.com/sawanose275">sawanose275</a></sub></div>
