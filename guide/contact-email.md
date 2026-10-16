# Your email address on the site

Your address lives in one place: `email:` in `_config.yml` (console: Site settings).

## What the site does with it
Pages never print the address as plain text. Wherever someone can contact you there is a **Write to me** button (the home page, About, project pages, short-link notes, the 404 page). A small script puts the address together only when the button is pressed, and then opens their email program. On the About page there is also a **Copy address** button for people who use webmail.

If someone has JavaScript turned off, the button takes them to the About page, which spells the address out as `name [at] domain [dot] com`. The AI guide (`/llms.txt`) spells it out the same way, so assistants can still tell people how to reach you.

## Why
Programs that collect addresses for spam read page text and `mailto:` links. Behind a button they find nothing. A person loses nothing: one press and their email program opens with your address ready.

## What this does not do
- It lowers spam. It cannot stop a determined collector, and your address is also visible in this site's public GitHub repository (`_config.yml`). Plan on a spam filter anyway.
- The CV is the exception on purpose. The printed or downloaded CV shows the address as text, because that is what a CV is for.

## Keep one public address
Having one public address is right for a public person. Use a dedicated one (as you do) rather than a personal inbox, and give it good spam filtering. If it ever becomes noisy, change `email:` once and the whole site follows.

## In your own pages
In a project page, writing `[{email}](mailto:{email})` is turned into the same button automatically. In any other page, write `{% include mail.html label="Write to me" %}`.
