# The home page, and how to change what it leads with

The home page has three modes. Each puts a different thing first. Switch between them in the console, under **Home page**, press **Save changes**, then **Publish**.

| Mode | Leads with | Best when |
|---|---|---|
| **Welcome** | A warm hello, your newest piece of writing, what you are working on now, a little about you | You are meeting new people, or want the site to feel personal |
| **Researcher** | A short intro, your research, recent papers, the CV button | You are applying for things or being looked at by academics |
| **Writer** | Your newest essay, earlier pieces, the sign-up for new pieces | You are publishing regularly and want readers to come back |

## What you can change
Open any mode in the console to change its small line above the name, its big heading, its opening words, its two buttons, and the **order of the sections** that follow. Use the arrows to move a section up or down, or add and remove sections.

Three blocks are shared by every mode: **A little about me**, the **Care for Knowledge** card beside it, and the **Say hello** invitation at the bottom.

## Sections you can use
Newest piece of writing, earlier pieces, what I am working on now, all research, recent papers, a little about me, things I think about, the sign-up for new pieces, and say hello.

A section with nothing to show stays out of the way. Before you publish your first essay, the "newest piece" and "earlier pieces" sections are simply not there, and a button that points to `/writing/` hides itself, so the page never shows an empty promise.

## Working on it by hand
Everything lives in `_data/home.yml`. `mode:` at the top is the switch. A button address can be a page on the site (`/cv/`), a full web address, or the word `mailto` to write to the email in `_config.yml`.

## Tips for the words
- Keep your full name in the big heading so search engines see it.
- Write the opening words the way you would say them to someone you have just met. Two or three sentences is plenty.
- Warm and plain beats impressive. Let the work and the writing carry the weight.

## The phone menu
On phones the menu is a three-line button at the top right. It opens a list of the same links as the Menu in Site settings. Nothing to set up.
