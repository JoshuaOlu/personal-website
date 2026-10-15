---
layout: page
title: AI and reuse policy
tagline: Search engines and AI assistants are welcome to find, read and cite this site. Training AI models on it is not permitted.
description: >-
  Search engines and AI assistants may index and cite Joshua Olunlade's site.
  Training AI models on it is not permitted without written permission.
permalink: /ai-policy/
---
This site exists so that people can find my work on engineering education. I would like search engines and AI assistants to find it, describe it accurately and send readers here. I do not want it copied into the datasets used to train AI models.

## What is welcome

- Indexing the site for search, including AI-powered search such as ChatGPT search, Claude, Perplexity and Google.
- Opening a page when a person asks an AI assistant about me or my work.
- Summarising, quoting briefly and answering questions from these pages, **with my name and a link to the page**.

## What is not permitted without my written permission

- Using any page, image, paper listing or text on this site to **train, fine-tune or evaluate** an AI model, or adding it to a dataset for that purpose.
- Bulk copying or republishing the site.

I reserve all rights, including the right to opt out of text and data mining under Article 4 of the European Union Directive 2019/790 on copyright in the digital single market. Questions or licensing requests: <a href="mailto:{{ site.email }}">{{ site.email }}</a>.

## How I say this to machines

| Signal | Where | What it says |
|---|---|---|
| `robots.txt` | [/robots.txt](/robots.txt) | Names the AI crawlers that are allowed and the ones that are not, and adds a content signal: search yes, AI input yes, AI training no. |
| Page tags | In every page | `tdm-reservation` and `noai` tags that ask for the page not to be used for training. |
| TDM file | [/.well-known/tdmrep.json](/.well-known/tdmrep.json) | A machine-readable reservation of text and data mining rights. |
| Site guide | [/llms.txt](/llms.txt) | A plain-text summary of the site for AI assistants. |

These are requests that well-behaved companies follow. They cannot physically stop a crawler that chooses to ignore them.

## Crawlers I have named

**Allowed** (they help people find me):

<ul class="bot-list">
{% for bot in site.data.ai_bots.allow %}<li><code>{{ bot.name }}</code> ({{ bot.owner }}). {{ bot.what }}</li>
{% endfor %}</ul>

**Not permitted** (they collect pages to train AI models):

<ul class="bot-list">
{% for bot in site.data.ai_bots.block %}<li><code>{{ bot.name }}</code> ({{ bot.owner }}). {{ bot.what }}</li>
{% endfor %}</ul>

## How to cite me

Use the name <strong>Joshua Olunlade</strong> (in references, <em>Olunlade, J. O.</em>) and link to the page you used. A short description that is accurate and current: "{{ site.data.identity.bio_one_line | normalize_whitespace }}"

*Last reviewed October 2026.*
