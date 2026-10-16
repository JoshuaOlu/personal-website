# Applying site updates

Updates from Claude arrive as numbered files such as `0011-something.patch`. Download them to your Downloads folder, in any order, then do one of these from your site folder:

**PowerShell, Terminal or Git Bash**
```
ruby scripts/apply-update.rb
```

**Windows, no typing:** double-click `scripts\Update-Site.bat`.

**Mac / Linux:** `./scripts/update-site.sh`

It finds every update waiting in Downloads and applies them in order (0011, then 0012, and so on). It skips ones you already applied, and stops politely if a number is missing ("update 12 has not been downloaded yet"). Each update becomes one local commit. Nothing goes live until you Publish.

## Good to know
- You need a clean working copy first. If you have unsaved changes, it tells you to save them as a commit.
- If an update does not fit your files, **nothing is changed** and it tells you which file is the problem. Send me those lines.
- To undo the last update: `git revert HEAD`.
- To apply one specific file: `ruby scripts/apply-update.rb path\to\0012-name.patch`.
- To look somewhere other than Downloads: `ruby scripts/apply-update.rb path\to\folder`.
- The numbers already applied are recorded in `scripts/applied-updates.txt` (and in the commit messages), so this works on any computer you clone the site to.
