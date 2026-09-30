---
# ─── COPY THIS FILE into _projects/ and rename it, e.g. _projects/my-new-project.md ───
# The file name becomes the address: my-new-project.md  →  /research/my-new-project/
# Delete any line you do not need. Only "title" and "summary" are required.

title: Project title
tagline: One line that says what it is                # shown under the title
summary: >-
  Two sentences for the cards on the home and Research pages. Say what it is
  and why it matters.
description: >-
  One or two sentences for Google and for link previews (about 150 characters).
seo_title: Optional. A different title for Google, with the words people search for

status: In progress        # Recruiting, In progress, Completed, or any short word
period: 2026 to 2027       # shown next to the status
order: 30                  # lowest number appears first (study = 10, Tinkabot = 20)
updated: 2026-10-15        # the date shown under "Where things stand"

cover: /assets/images/covers/my-project.jpg       # the picture at the top right of the page (any shape, shown as a square)
cover_alt: Describe what the picture shows in a sentence
cover_position: 50% 30%    # optional: which part to keep when the picture is cropped (left/top as percentages)

image:                     # the picture that appears when the page is shared on LinkedIn and elsewhere
  path: /assets/images/my-project-preview.png     # 1200 x 630 pixels
  width: 1200
  height: 630
  alt: Describe the picture in a sentence

# The box beside the text ("At a glance"). Use markdown for links.
facts:
  - label: Role
    value: Lead researcher
  - label: Supervisors
    value: Name and Name
  - label: Contact
    value: "[{email}](mailto:{email})"        # {email} becomes your address from _config.yml

# The timeline under the text. state is done, now, or next.
progress:
  - label: Planning
    state: done
    detail: What happened, in a sentence.
  - label: Fieldwork
    state: now
    detail: What is happening now.
  - label: Writing up
    state: next
    detail: What comes after.

# Everything the project has produced. type can be:
# paper, article, report, thesis, video, talk, slides, poster, code, data, other
outputs:
  - type: paper
    title: Title of the paper
    venue: Journal or conference
    date: March 2027
    doi: 10.xxxx/xxxxx                 # builds the link for you. Or use url: instead.
  - type: video
    title: Title of the talk
    youtube: VIDEO_ID_ONLY             # the part after v= in the YouTube address. Also embeds the video.
    date: April 2027
  - type: slides
    title: Slides from the talk
    url: https://example.org/slides.pdf
  - type: code
    title: Source code
    url: https://github.com/yourname/project

contact: "A short closing note with [an email link](mailto:{email})."   # optional "Get in touch" section

references:                # optional "Sources" list at the end
  - "Author, A. (2020). Title of the work. *Journal*."
---

Write the opening paragraph here. Add {: .lede} on the line straight after it to make it larger.
{: .lede}

## A heading

Write in plain markdown below the three dashes. Use `##` for headings and `-` for bullet points.
