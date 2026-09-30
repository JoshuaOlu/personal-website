# joshua.olunlade.com

Personal website of Joshua Olunlade, built with [Jekyll](https://jekyllrb.com/)
and hosted on GitHub Pages.

**To add or update research, read [GUIDE.md](GUIDE.md).**

## Local development

```bash
bundle install
bundle exec jekyll serve
```

Then visit `http://localhost:4000`.

## How the site is organised

```
├── _config.yml           Site settings, menu, search and sharing settings
├── _data/social.yml      The links in the footer
├── _includes/            Reusable pieces: head, menu, footer, project list, outputs
├── _layouts/
│   ├── default.html      The frame around every page
│   ├── page.html         A plain page
│   └── project.html      A research project page
├── _projects/            One file per project. Add new ones here
│   ├── siwes-study.md
│   └── tinkabot.md
├── templates/
│   └── project-template.md   Copy this to start a new project
├── assets/
│   ├── css/main.css      All styles. Colours are at the top
│   ├── fonts/            Self-hosted fonts (Bricolage Grotesque, Source Serif 4)
│   ├── files/            CV
│   └── images/           Headshot, favicons, link preview images
├── research/index.md     The Research page
├── siwes/survey/         The short link that forwards to the survey
├── index.md              The home page
├── GUIDE.md              How to add and update projects
└── CNAME
```

## Plugins

| Plugin | Purpose |
|---|---|
| `jekyll-sitemap` | Builds `/sitemap.xml` for search engines |
| `jekyll-seo-tag` | Writes the page title, description and link preview tags |

Both are supported by GitHub Pages with no extra setup.

## Fonts

The fonts are stored in `assets/fonts/` and served from this site, so visitors'
browsers do not contact Google. Both are open source (SIL Open Font License).
