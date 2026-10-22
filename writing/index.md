---
layout: default
title: Writing
seo_title_raw: "Writing on Engineering Education in Africa | Joshua Olunlade"
description: >-
  Essays by Joshua Olunlade on engineering education in Nigeria and Africa,
  industrial placements (SIWES) and how students find their way into the profession.
permalink: /writing/
---
<link rel="stylesheet" href="{{ '/assets/css/writing-hubs.css' | relative_url }}">
<div class="page-shell">
  <header class="page-header">
    <h1>Writing</h1>
    <p class="page-tagline">Essays and notes on engineering education in Nigeria and across Africa, industrial placements, and how students find their way into the profession.</p>
    <p class="feed-link"><a href="{{ '/feed.xml' | relative_url }}">Subscribe by feed</a></p>
  </header>
  {% include hub-totals.html %}
  {% if series_live_n > 0 %}
  <section class="hub-block" aria-labelledby="series-h">
    <h2 id="series-h">Series</h2>
    {% include hub-series-cards.html %}
  </section>
  {% endif %}
  {% if themes_live_n > 0 %}{% include hub-theme-chips.html %}{% endif %}
  {% assign posts = site.writing | sort: "date" | reverse %}
  {% if posts.size == 0 %}
    <p class="muted">Nothing here yet.</p>
  {% else %}
  {% if series_live_n > 0 %}<h2 class="hub-sub" id="all-h">All pieces</h2>{% endif %}
  <ol class="writing-list">
    {% for post in posts %}
    <li class="writing-row">
      <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%-d %b %Y" }}</time>
      <div>
        <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
        {% if post.series %}{% include series-info.html slug=post.series %}{% if ser %}<p class="row-series">{% if post.series_part %}Part {{ post.series_part }}{% if ser_known %} of {{ ser_total }}{% endif %} of {% else %}Series: {% endif %}<a href="{{ ser.url | relative_url }}">{{ ser.short_title | default: ser.title }}</a></p>{% endif %}{% endif %}
        {% if post.summary %}<p>{{ post.summary }}</p>{% endif %}
      </div>
    </li>
    {% endfor %}
  </ol>
  {% endif %}
</div>
