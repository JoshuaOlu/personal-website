---
layout: default
title: Writing
seo_title_raw: "Writing on Engineering Education in Africa | Joshua Olunlade"
description: >-
  Essays by Joshua Olunlade on engineering education in Nigeria and Africa,
  industrial placements (SIWES) and how students find their way into the profession.
permalink: /writing/
---
<div class="page-shell">
  <header class="page-header">
    <h1>Writing</h1>
    <p class="page-tagline">Essays and notes on engineering education in Nigeria and across Africa, industrial placements, and how students find their way into the profession.</p>
    <p class="feed-link"><a href="{{ '/feed.xml' | relative_url }}">Subscribe by feed</a></p>
  </header>
  {% assign posts = site.writing | sort: "date" | reverse %}
  {% if posts.size == 0 %}
    <p class="muted">Nothing here yet.</p>
  {% else %}
  <ol class="writing-list">
    {% for post in posts %}
    <li class="writing-row">
      <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%-d %b %Y" }}</time>
      <div>
        <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
        {% if post.summary %}<p>{{ post.summary }}</p>{% endif %}
      </div>
    </li>
    {% endfor %}
  </ol>
  {% endif %}
</div>
