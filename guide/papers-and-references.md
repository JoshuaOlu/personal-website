# Papers, references, and hiding things without deleting them

## Add a paper by its DOI
Console, **Publications**, **Add papers by DOI**. Paste one DOI per line (for example `10.1002/jee.20321`) and the details are looked up and filled in: authors, year, title, journal, volume and pages. Untick any you do not want, then add them. You can also paste BibTeX or RIS. Papers you already have are marked, so nothing is added twice. Check the result; publishers sometimes register odd capitals or missing pages.
The DOI lookup needs the console on your computer. The browser version of the console accepts BibTeX or RIS.

## Your own papers are already sources you can cite
Every paper in Publications can be cited in your writing as `[@its-short-id]`, for example `[@tinkabot-review]`. In the console's **References** page they appear under "Your own papers", and in the editor's **Cite** button and `[@` suggestions. Nothing to add twice. To change how one reads, edit it under Publications. If you add a reference of the same short name to your References, yours is used instead.

## Show it, or hide it, without deleting it
Every CV section, every CV entry and every paper has **Where to show it**:

| Choice | Website CV | PDF CV | Publications page, home page, search data |
|---|---|---|---|
| Everywhere (default) | yes | yes | yes |
| The website only | yes | no | yes |
| The PDF CV only | no | yes | no |
| Nowhere (kept, but hidden) | no | no | no |

A section with nothing left to show disappears by itself, and so does its entry in the CV contents list. A hidden paper stays in `_data/publications.yml` and can still be cited in your writing. Hidden items are still in the public GitHub repository, as you noted.
