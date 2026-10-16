# References and citations (APA 7)

Add each source once. Cite it in any essay. The in-text citations and the reference list are made for you and stay in step
when you change a source.

## 1. Add your sources
Console, **References**, **Add references**. You can:

- **Paste BibTeX, RIS or CSL JSON**, or choose the file. Zotero, Mendeley, EndNote, Google Scholar ("Cite", then BibTeX),
  Crossref and most publishers have an Export citation button that gives one of these.
- **Paste DOIs**, one per line (console on your computer only). It looks each one up at doi.org.
- **Add by hand** for anything else. The form shows how the reference will look as you type.

Sources already in your list (same DOI, or same title and year) are marked and skipped.
Each source gets a short name, such as `kloot2020` (made from the author and year, or the key in your BibTeX file).
The names can only use letters, numbers, `-` and `:`.
Your sources live in `_data/references.yml`. You can also edit that file directly.

## 2. Cite in an essay
Press **Cite** in the toolbar, tick the source or sources, add a page if you like, and insert. Or type `[@` and pick from the
suggestions. What you type, and what readers see:

| You write | Readers see |
|---|---|
| `[@kloot2020]` | (Kloot & Jansen, 2020) |
| `[@kloot2020, p. 4]` | (Kloot & Jansen, 2020, p. 4) |
| `[@kloot2020; @smith2019]` | (Kloot & Jansen, 2020; Smith, 2019) |
| `[see @kloot2020, ch. 2]` | (see Kloot & Jansen, 2020, ch. 2) |
| `[!@kloot2020]` | Kloot and Jansen (2020), when the authors are part of the sentence |
| `[-@kloot2020]` | (2020), when you have already named the authors |

The rules follow APA 7: "&" inside brackets, "et al." for three or more authors, citations in one bracket put in
alphabetical order, 2020a and 2020b when the same author has two works in one year, and a title in place of the author when
there is none. The **References** list is added at the end of the essay, in alphabetical order, with a link back from each
citation. A source appears in the list only if the essay cites it. It also appears in the outline beside the essay.

The editor's **Rough preview** shows citations and the list as they will look. **Start preview** shows the real page.

## 3. What is checked
Build and check reports a citation to a source that is not in your list, a source with no author or year, a repeated name, and
any citation that could not be turned into text. A citation to a missing source shows in red as `[?name]` on the page, so you
will not miss it.

## 4. Good to know
- You cannot rename a source after adding it, because essays already use the name. Add it again with the new name, then delete
  the old one. The References page shows where each source is cited.
- Put a locator after a comma: `[@kloot2020, p. 4-5]` becomes "p. 4–5".
- Quotation marks inside a citation can stop it being converted. If so, the check says so; use plain words.
- The text is made by `scripts/citations.rb` into `_data/cite/` (not stored in Git). The console runs it each time you save
  and the deploy runs it before every build. If you preview with plain `jekyll serve` instead of the console, run
  `ruby scripts/citations.rb` after editing references.
- The browser version of the console can add, edit and cite references too, but cannot look up a DOI. Paste BibTeX there.
- References also work in project pages.

## 5. Essay layout
On wide screens an essay is centred with an outline on the left that follows your place in the text, plus a thin reading-progress
line. On phones the outline becomes a "In this piece" box under the title. The outline appears when an essay has two or more
`##` headings, or one heading and a reference list.
