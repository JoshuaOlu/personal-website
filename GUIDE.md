# Guide: adding and updating research and projects

Everything under "Research" on your site comes from one folder: `_projects/`.
One file in that folder is one project. You never edit the home page or the
Research page to add a project. They update themselves.

This guide covers:

1. Adding a new project
2. What each field does
3. Adding papers, videos and other outputs
4. Updating a project as it moves along
5. The picture that appears when you share a link
6. Helping search engines find the page
7. Trying it on your computer, then publishing

---

## 1. Adding a new project

1. Open `templates/project-template.md` and copy everything in it.
2. Create a new file in `_projects/`. Name it in lowercase with hyphens,
   for example `_projects/first-essays.md`. The file name becomes the address:
   `joshua.olunlade.com/research/first-essays/`.
3. Paste the template in, delete the fields you do not need, and fill in the rest.
4. Write the page itself below the second `---` line, in plain markdown.
5. Commit and push. GitHub Pages rebuilds the site in a minute or two.

Only `title` and `summary` are required. A page with just those two and some
text works fine.

## 2. What each field does

| Field | What it does |
|---|---|
| `title` | The big heading, and the name on the cards. |
| `tagline` | The line under the heading. |
| `summary` | The short description on the home and Research pages. |
| `description` | What Google and link previews show. About 150 characters. |
| `seo_title` | Optional. A different title for Google only, for when you want the words people search for (for example "SIWES") in it. |
| `status` | The coloured pill. Any short word works. `Recruiting` is amber, `In progress` and `Completed` are neutral with a green dot. |
| `period` | Shown next to the pill, for example `2026 to 2027`. |
| `order` | Sets the order on the home and Research pages. The lowest number comes first. If you leave it out, the project gets 50 and goes last. |
| `updated` | The date shown as "Last updated" above the timeline. Change it whenever you change the timeline. |
| `image` | The picture used when the page is shared. See section 5. |
| `facts` | The "at a glance" box beside the text. Each entry has a `label` and a `value`. Values can contain markdown links. |
| `progress` | The timeline called "Where things stand". Each step has a `label`, a `state` and an optional `detail`. |
| `outputs` | Papers, videos, slides and so on. See section 3. |
| `contact` | An optional "Get in touch" note at the end. |
| `references` | An optional "Sources" list at the end. Markdown works, so `*italics*` and links are fine. |

Any field you leave out simply does not appear. If a project has no `facts`,
the text uses the full width. If it has no `outputs`, there is no Outputs section.

Inside the page text you can use `## Heading` for headings, `- item` for bullet
points, `**bold**`, `*italics*` and `[link text](https://address)`. To make a
paragraph larger, like an introduction, put `{: .lede}` on the line straight
below it. To set a paragraph apart as a highlighted question, put `{: .question}`
on the line below it.

## 3. Adding papers, videos and other outputs

Add an `outputs:` list to the top of the project file. Each item is one output.
Every item needs a `title`. Everything else is optional.

```yaml
outputs:
  - type: paper
    title: Navigating access to industrial placements
    venue: Journal of Engineering Education
    date: March 2027
    doi: 10.5281/zenodo.1234567

  - type: video
    title: Conference talk
    youtube: dQw4w9WgXcQ
    date: April 2027
    note: 20 minutes

  - type: slides
    title: Slides from the CREE seminar
    url: https://zenodo.org/records/1234567

  - type: code
    title: Analysis scripts
    url: https://github.com/josholunlade/siwes-analysis
```

| Field | Meaning |
|---|---|
| `type` | The small label on the left. Use `paper`, `article`, `report`, `thesis`, `video`, `talk`, `slides`, `poster`, `code`, `data` or `other`. Anything you type is shown with a capital letter. |
| `title` | The name of the output. It becomes the link. |
| `url` | Where the link goes. |
| `doi` | Just the DOI, without `https://doi.org/`. The link is built for you. This is handy for Zenodo. |
| `youtube` | Just the video ID, the part after `v=` in the YouTube address. It builds the link and shows the video on the page. The video uses YouTube's privacy mode. |
| `venue`, `date`, `note` | Small grey details under the title. Write them however you like. |

If you give a `url`, a `doi` and a `youtube` ID, the `url` wins for the link.
An output with no link at all is shown as plain text. That is useful for
something that is "coming soon".

New outputs go at the bottom of the list, or at the top if you want them first.
The order you write is the order shown.

## 4. Updating a project as it moves along

For a project that is still running, you will mostly touch three things:

1. `status`: change it, for example from `Recruiting` to `In progress`.
2. `progress`: change a step's `state` from `now` to `done` and set the next one
   to `now`. Add steps or edit the `detail` lines.
3. `updated`: set today's date.

Then add any new items to `outputs`, commit and push.

When a project finishes, set `status: Completed`, mark every step `done`, and
consider replacing the timeline with a short "What I found" section in the text.

## 5. The picture that appears when you share a link

Each page can have its own preview image. If you do nothing, the page uses
`assets/images/og-default.png`, the card with your name and photo.

To give a project its own image:

1. Make a picture 1200 pixels wide and 630 pixels tall, saved as a PNG.
2. Put it in `assets/images/`.
3. Add the `image:` block from the template to the project.

LinkedIn, WhatsApp and others remember previews for a while. After you change an
image or a title, paste the address into LinkedIn's Post Inspector to refresh it.

The survey redirect page `siwes/survey/index.html` works the same way. It has a
different image from the study page on purpose, so the link you post looks like
a call for participants and the study page looks like a piece of research.

## 6. Helping search engines find the page

- Put the words people would search for in the `title`, the `tagline`, the first
  paragraph and the headings. For example "SIWES", "industrial placements",
  "engineering education in Nigeria".
- Write headings as plain questions or clear labels, for example "What is SIWES?".
- Use `seo_title` if you want a Google title with more search words than the
  page heading. Keep it under about 65 characters.
- Keep `description` to about 150 characters and make it read like a sentence.
- Link to the page from other places that already have your name on them: your
  LinkedIn profile, ORCID, your Substack and Care for Knowledge.
- Add the site to Google Search Console and submit
  `https://joshua.olunlade.com/sitemap.xml`. The site builds the sitemap for you.

New pages can take weeks to appear in search results. That is normal.

## 7. Trying it on your computer, then publishing

To see changes before they go live:

```bash
bundle install          # only the first time
bundle exec jekyll serve
```

Then open `http://localhost:4000`. Saving a file rebuilds the page. If you change
`_config.yml`, stop the server (Ctrl+C) and start it again.

To publish, commit and push to the `main` branch. GitHub Pages builds the site.
If a page does not appear, check the "Actions" or "Pages" tab in the repository
for a build error. The most common cause is a mistake in the block between the
two `---` lines. Every `label:` needs a space after the colon, and values with a
colon or a quote in them should be wrapped in quotes.

## Other things you may want to change

| I want to... | Edit this |
|---|---|
| Change the bio or the top of the home page | `index.md` |
| Add, remove or reorder the links in the footer | `_data/social.yml` |
| Add a page to the top menu | `nav:` in `_config.yml` |
| Change the colours | The "Tokens" block at the top of `assets/css/main.css` |
| Replace the CV | Replace `assets/files/joshua-olunlade-cv.pdf`, keeping the file name |
| Point the survey link somewhere else | `redirect_to:` at the top of `siwes/survey/index.html` |
