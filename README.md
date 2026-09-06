# joshua.olunlade.com

Personal website of Joshua Olunlade, built with [Jekyll](https://jekyllrb.com/) and hosted on GitHub Pages.

---

## Local development

```bash
bundle install
bundle exec jekyll serve
```

Then visit `http://localhost:4000`.

---

## How to maintain this site

### Update your bio or social links

- **Bio / about text** → edit `index.md`
- **Social media links** → edit `_data/social.yml` (add, remove, or reorder entries there; nothing else needs changing)
- **Navigation links** → edit `_config.yml` under `nav:`

### Add a new research project

1. Create a new file in `_projects/` — e.g. `_projects/my-new-project.md`
2. Copy the front matter pattern from `_projects/tinkabot.md`
3. Write the content in Markdown below the `---`

That's it. The project will automatically appear on the home page and on `/research/`.

### Update your CV

Replace `assets/files/joshua-olunlade-cv.pdf` with your new PDF. Keep the filename the same.

### Site-wide settings (title, description, URL)

Edit `_config.yml`. After any change to `_config.yml`, restart the local server.

---

## Plugins used

| Plugin | Purpose |
|---|---|
| `jekyll-sitemap` | Auto-generates `/sitemap.xml` on every build |
| `jekyll-seo-tag` | Injects `<title>`, `<meta description>`, Open Graph, and Twitter Card tags from front matter |

Both are supported natively by GitHub Pages — no extra CI needed.

---

## File structure

```
├── _config.yml          # Site settings, nav, plugins
├── _data/
│   └── social.yml       # Social media links
├── _includes/
│   ├── head.html        # <head> tag (SEO plugin lives here)
│   ├── nav.html         # Navbar
│   ├── footer.html      # Footer
│   └── social.html      # Social icon row
├── _layouts/
│   ├── default.html     # Base layout
│   ├── page.html        # Generic page
│   └── project.html     # Research project page
├── _projects/           # One .md file per research project
│   └── tinkabot.md
├── assets/
│   ├── css/main.css     # All styles
│   ├── files/           # CV PDF
│   └── images/          # Headshot, favicons
├── research/
│   └── index.md         # Research listing page
├── index.md             # Home page
└── CNAME
```
