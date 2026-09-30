# Guide: adding and updating research and projects

Everything under "Research" on your site comes from one folder: `_projects/`.
One file in that folder is one project. You never edit the home page or the
Research page to add a project. They update themselves.

This guide covers:

1. Adding a new project
2. What each field does
3. Adding papers, videos and other outputs
4. Updating a project as it moves along
5. The cover picture on a project page
6. The picture that appears when you share a link
7. Helping search engines find the page
8. Trying it on your computer, then publishing



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
| `cover` | The picture at the top right of the page. See section 5. |
| `cover_alt` | A sentence describing the cover picture, for people who use screen readers. |
| `cover_position` | Optional. Which part of the cover to keep if it gets cropped, for example `50% 20%`. |
| `image` | The picture used when the page is shared on LinkedIn and elsewhere. See section 6. |
| `facts` | The "at a glance" box beside the text. Each entry has a `label` and a `value`. Values can contain markdown links. |
| `progress` | The timeline called "Where things stand". Each step has a `label`, a `state` and an optional `detail`. |
| `publications` | The ids of papers from `_data/publications.yml` that belong to this project. See "Papers and publications". |
| `outputs` | Videos, slides, code, data and anything else. See section 3. |
| `contact` | An optional "Get in touch" note at the end. |
| `references` | An optional "Sources" list at the end. Markdown works, so `*italics*` and links are fine. |

Any field you leave out simply does not appear. If a project has no `facts`,
the text uses the full width. If it has no `outputs`, there is no Outputs section.

Inside the page text you can use `## Heading` for headings, `- item` for bullet
points, `**bold**`, `*italics*` and `[link text](https://address)`. To make a
paragraph larger, like an introduction, put `{: .lede}` on the line straight
below it. To set a paragraph apart as a highlighted question, put `{: .question}`
on the line below it.

## 3. Adding videos and other outputs

For papers, see "Papers and publications" further down. For everything else, add an `outputs:` list to the top of the project file. Each item is one output.
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

## 5. The cover picture on a project page

Each project can show a picture at the top right, lined up with the details box
below it.

1. Save the picture in `assets/images/covers/`. Any of JPG, PNG, WebP or SVG works.
2. Add two lines to the project:

   ```yaml
   cover: /assets/images/covers/my-project.jpg
   cover_alt: A sentence that describes what the picture shows
   ```

The picture is always shown as a square, a little smaller on a phone, so anything
important should sit near the middle. If the wrong part is being cut
off, add `cover_position: 50% 20%` (the first number moves the crop left to right,
the second moves it top to bottom).

A square picture about 1200 pixels wide is ideal. Real photographs of the work,
such as the kit, the team or a poster, usually work better than illustrations.
If you leave `cover` out, the page simply has no picture and the title uses the
full width.

## 6. The picture that appears when you share a link

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

## 7. Helping search engines find the page

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

## 8. Trying it on your computer, then publishing

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

## Your contact email

The site has one contact address, stored in one place: the `email:` line in
`_config.yml`. The button on the home page, the survey page and any project page
read it from there, so to change it you edit that one line.

Inside a project's front matter (the block between the two `---` lines), write
`{email}` wherever the address should appear:

```yaml
facts:
  - label: Contact
    value: "[{email}](mailto:{email})"

contact: "You can write to me at [{email}](mailto:{email})."
```

In the body of a page (below the second `---`), use `{{ site.email }}` instead:

```markdown
Write to me at [{{ site.email }}](mailto:{{ site.email }}).
```

Please avoid typing the address itself into a page. If you do, it will not
change when you update `_config.yml`.

## Papers and publications

All your papers live in one file, `_data/publications.yml`. Add each paper once:

```yaml
- id: my-new-paper                 # a short name of your choice, lowercase, no spaces
  type: journal                    # journal, conference, preprint, chapter or report
  authors: "Olunlade, J., & Someone, A."
  year: 2027
  month: March                     # optional
  title: "The title of the paper"
  venue: Name of the Journal       # shown in italics
  details: "12, 101–115"           # optional: volume and pages
  doi: "10.xxxx/xxxxx"             # without https://doi.org/
```

For a conference paper, use `type: conference`, add `prefix: Paper presented at`,
put the conference name in `venue`, and put the city in `details`.

Put the newest paper first in each type. Then:

- **On your CV:** the paper appears automatically under "Publications", in a
  group named after its type (Journal Articles, Conference Papers, Preprints, Book
  Chapters, Reports). Empty groups stay hidden. The groups are listed at the top of
  the Publications section in `_data/cv.yml` if you want to rename or reorder them.
- **On a project page:** add the paper's `id` to the project's front matter, and
  it appears in that project's Outputs section as a full reference:

  ```yaml
  publications: [my-new-paper]
  ```

  A paper does not have to belong to a project. Leave it out and it shows on the
  CV only.
- For a paper with no DOI, use `url: https://...` instead of `doi:`.
- **Your name in bold.** Your name is printed in bold in every author list, on the
  CV, in the PDF and on project pages. The name forms it looks for are listed in
  `_data/authors.yml`. If you use a different form in a new paper, for example
  "Olunlade, J. O. A.", add it there. Spell your name the same way in all your papers
  and you will only need one entry.

## Your CV

The CV exists twice, and both versions come from **one file**: `_data/cv.yml`.

- The web page at `/cv/` uses the look of the site.
- The PDF uses a separate, plain black and white academic layout
  (`assets/css/cv-print.css`). It does not look like the site on purpose.

To change your CV, edit `_data/cv.yml`, set `updated:` to today's date, then
commit and push. GitHub rebuilds the web page and makes a fresh PDF from it.
The "Download PDF" button always gives the latest one.

### Adding or changing an entry

Each section has a `title` and a list of `entries`. Copy an existing entry and
edit it. Only `title` is required:

```yaml
- title: Research Assistant
  org: Department of Something, University of Somewhere
  dates: Jan 2027 to Present        # "to" is shown as a dash in the PDF
  note: One plain line of extra detail.
  bullets:
    - "A short point about what you did."
    - "Another point."
  links:
    - label: Certificate
      url: https://example.org/certificate
```

- Keep every `bullets` line inside double quotes.
- Entries appear in the order you write them, so put the newest first.
- The order of the sections in `cv.yml` is the order on the page and in the PDF. Move a whole
  block up or down to reorder.
- To add a new section, copy a whole `- title: ...` block at the level of
  "Education" and give it a new title. A section with only `text:` (like
  References) shows a single line.
- Your email and website come from `_config.yml`. The ORCID and LinkedIn
  addresses in the PDF header come from `_data/social.yml`. The `profiles:` line
  at the top of `cv.yml` chooses which ones appear.

### How the PDF is made

`.github/workflows/deploy.yml` builds the site, opens the hidden page
`/cv/print/` in a browser, prints it to `assets/files/joshua-olunlade-cv.pdf`,
and publishes everything. To look at the PDF layout yourself, run the site on
your computer and open `http://localhost:4000/cv/print/`, then use your browser's
print preview.

### Checking that the PDF was updated

The footer of every PDF page says "Updated" followed by the `updated:` date from
`cv.yml`. After you change your CV and push:

1. Open the **Actions** tab on GitHub and wait for the run to show a green tick.
   Open it and check that the step "Make the CV PDF" is green too.
2. Open `joshua.olunlade.com/assets/files/joshua-olunlade-cv.pdf`. If the old one
   appears, refresh the page, since browsers keep PDFs for a while.
3. Check that the footer shows today's date.

A red cross means the site was not published and the previous version is still live.
Click the red step to see why.

### One-time setup on GitHub

1. Open your repository on GitHub, then **Settings**, then **Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Check that the custom domain `joshua.olunlade.com` is still shown on that page.
   If it is blank, type it in again and save.
4. Push a change, or open the **Actions** tab, choose "Build and deploy site" and
   click **Run workflow**.

If a run fails, open it in the Actions tab and read the red step. (If it complains about `Gemfile.lock`, that file was made on another type of computer. The workflow deletes it and makes its own, so this should not happen.) Until you do the
setup above, the site keeps working as before, and the button gives the last PDF
that was saved in `assets/files/`.

## Other things you may want to change

| I want to... | Edit this |
|---|---|
| Change the bio or the top of the home page | `index.md` |
| Add, remove or reorder the links in the footer | `_data/social.yml` |
| Change the contact email | `email:` in `_config.yml` (see "Your contact email" above) |
| Add a page to the top menu | `nav:` in `_config.yml` |
| Change the colours | The "Tokens" block at the top of `assets/css/main.css` |
| Change what is on my CV | `_data/cv.yml` (see "Your CV" above) |
| Point the survey link somewhere else | `redirect_to:` at the top of `siwes/survey/index.html` |
