---
layout: default
title: Podcast
seo_title_raw: "Podcast | Joshua Olunlade"
description: >-
  Conversations and notes on engineering education in Nigeria and Africa, with new episodes
  listed here automatically.
permalink: /podcast/
---
{% assign show = site.data.podcast_feed.show %}
{% assign eps = site.data.podcast_feed.episodes %}
<div class="page-shell">
  <header class="page-header">
    <h1>{{ show.title | default: "Podcast" }}</h1>
    {% if show.description %}<p class="page-tagline">{{ show.description }}</p>{% endif %}
    {% if site.data.podcast.listen_on.size > 0 %}
    <div class="listen-on">{% for l in site.data.podcast.listen_on %}<a class="btn" href="{{ l.url }}" rel="noopener">{{ l.label }}</a>{% endfor %}</div>
    {% endif %}
  </header>
  {% if eps and eps.size > 0 %}
  {% for e in eps %}
  <article class="episode">
    <div class="episode-meta">{% if e.date %}{{ e.date | date: "%-d %B %Y" }}{% endif %}{% if e.season != "" and e.episode != "" %} · S{{ e.season }} E{{ e.episode }}{% endif %}{% if e.duration != "" %} · {{ e.duration }}{% endif %}</div>
    <h2>{% if e.link != "" %}<a href="{{ e.link }}" rel="noopener">{{ e.title }}</a>{% else %}{{ e.title }}{% endif %}</h2>
    <p>{{ e.summary }}</p>
    <audio controls preload="none" src="{{ e.audio }}"></audio>
  </article>
  {% endfor %}
  {% else %}
  <p class="muted">No episodes yet.</p>
  {% endif %}
</div>
