# The site console

A small program that runs on your laptop and gives you a friendly page for editing the site.
It never sends your files anywhere. It only listens on your own computer (127.0.0.1).

## Start it
- **Windows:** double-click `Start-Console.bat` in the site folder.
- **Mac:** double-click `start-console.command` (first time: right-click, Open).
- **Linux:** run `./start-console.sh`.

It needs Ruby (already there if you build the site locally) and Git. Your browser opens by itself.
To stop it, close the window (or press Ctrl+C).

## What is inside
Overview, Projects, Writing, Short links, Publications, CV, About and identity, Pictures,
Settings, Checks (a site audit), SEO and discoverability, and Publish.
Every save keeps a backup in `.console-data/backups/` (ignored by Git).
"Publish" commits and pushes, and GitHub builds the site.

## Safety
Only pages on your own computer can talk to it (token, Host and Origin checks). It can only touch
files inside the site folder. If you ever see a mistake message, nothing was saved.

## Not tested everywhere
Built and tested on Linux. The Windows and Mac start-up paths are written but untested.
If something misbehaves, you can always edit the files directly as before.

## The browser version (optional)
Settings has a switch, "Edit from any browser". When on, the next publish adds a page at `/manage/` on your site.
Open it on any device, sign in with a GitHub fine-grained token for this repository only (Contents and Pull requests: read and write,
short expiry), and edit with the same screens. "Send for approval" opens a pull request; nothing changes on the live site until you merge it on GitHub. Switch on the GitHub rule that requires a pull request (GUIDE.md, "Make approval compulsory") or the safeguard is only advisory.

What is different from the computer version: no live preview, no full site check, no IndexNow sending, no link checking.
How it stays safe: the token is kept in that tab only (unless you tick "Remember"), the page can only talk to
api.github.com (enforced by the page's Content-Security-Policy), and anyone without a token can do nothing with the page.
Treat the token like a password. If a device is lost, delete the token on GitHub and it stops working at once.

## Pull-request mode on the computer
Settings, "Send changes as a pull request". Publish then force-pushes to the `console-edits` branch and returns a link to
open the pull request. Stored per computer in `.console-data/publish_mode` (never committed).
