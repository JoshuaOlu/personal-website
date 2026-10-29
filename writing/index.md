---
layout: default
title: Writing
seo_title_raw: "Writing on Engineering Education in Africa | Joshua Olunlade"
description: >-
  Essays and stories by Joshua Olunlade on engineering education in Nigeria and Africa,
  industrial placements (SIWES) and how students find their way into the profession.
permalink: /writing/
---
<link rel="stylesheet" href="{{ '/assets/css/writing-hubs.css' | relative_url }}">
<div class="page-shell">
  <header class="page-header">
    <h1>Writing</h1>
    {% assign has_story = false %}{% for w in site.writing %}{% if w.fiction %}{% assign has_story = true %}{% endif %}{% endfor %}
    <p class="page-tagline">Essays{% if has_story %}, stories{% endif %} and notes on engineering education in Nigeria and across Africa, industrial placements, and how students find their way into the profession.</p>
    <p class="feed-link"><a href="{{ '/feed.xml' | relative_url }}">Subscribe by feed</a></p>
  </header>
  {% include hub-totals.html %}
  {% assign posts = site.writing | sort: "date" | reverse %}
  {% assign story_n = 0 %}{% assign essay_n = 0 %}
  {% for post in posts %}{% if post.fiction %}{% assign story_n = story_n | plus: 1 %}{% else %}{% assign essay_n = essay_n | plus: 1 %}{% endif %}{% endfor %}
  {% assign split = false %}{% if story_n > 0 and essay_n > 0 %}{% assign split = true %}{% endif %}

  {% if split %}
  <p class="theme-row"><span class="post-themes-label">Jump to</span> <a class="tag tag-link" href="#stories">Stories</a> <a class="tag tag-link" href="#essays">Essays</a></p>
  {% endif %}

  {% if story_n > 0 %}
  <section class="hub-block" id="stories" aria-labelledby="stories-h">
    <h2 id="stories-h">{% if split %}Stories{% else %}Stories and series{% endif %}</h2>
    {% if split %}<p class="hub-lede">Fiction, for when an idea is better told than argued.</p>{% endif %}
    {% include hub-series-cards.html kind="stories" %}
    {% assign lone = 0 %}
    {% for post in posts %}{% if post.fiction and post.series == nil %}{% assign lone = lone | plus: 1 %}{% endif %}{% endfor %}
    {% if lone > 0 %}
    <h3 class="hub-sub">Single stories</h3>
    <ol class="writing-list">
      {% for post in posts %}{% if post.fiction and post.series == nil %}
      <li class="writing-row">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%-d %b %Y" }}</time>
        <div>
          <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
          {% if post.summary %}<p>{{ post.summary }}</p>{% endif %}
        </div>
      </li>
      {% endif %}{% endfor %}
    </ol>
    {% endif %}
  </section>
  {% endif %}

  {% if essay_n > 0 %}
  <section class="hub-block" id="essays" aria-labelledby="essays-h">
    {% if split %}<h2 id="essays-h">Essays</h2>{% endif %}
    {% assign ess_series_n = 0 %}
    {% for s in site.series %}{% include series-info.html slug=s.slug %}{% if ser_parts.size > 0 and ser_fiction == false %}{% assign ess_series_n = ess_series_n | plus: 1 %}{% endif %}{% endfor %}
    {% if ess_series_n > 0 %}
    <h3 class="hub-sub hub-sub-first">Series</h3>
    {% include hub-series-cards.html kind="essays" %}
    {% endif %}
    {% if themes_live_n > 0 %}{% include hub-theme-chips.html %}{% endif %}
    {% if ess_series_n > 0 %}<h3 class="hub-sub">All essays</h3>{% endif %}
    <ol class="writing-list">
      {% for post in posts %}{% unless post.fiction %}
      <li class="writing-row">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%-d %b %Y" }}</time>
        <div>
          <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
          {% if post.series %}{% include series-info.html slug=post.series %}{% if ser %}<p class="row-series">{% if post.series_part %}Part {{ post.series_part }}{% if ser_known %} of {{ ser_total }}{% endif %} of {% else %}Series: {% endif %}<a href="{{ ser.url | relative_url }}">{{ ser.short_title | default: ser.title }}</a></p>{% endif %}{% endif %}
          {% if post.summary %}<p>{{ post.summary }}</p>{% endif %}
        </div>
      </li>
      {% endunless %}{% endfor %}
    </ol>
  </section>
  {% endif %}

  {% if story_n == 0 and essay_n == 0 %}<p class="muted">Nothing here yet.</p>{% endif %}
  {% if story_n > 0 and essay_n == 0 and themes_live_n > 0 %}{% include hub-theme-chips.html %}{% endif %}
</div>
