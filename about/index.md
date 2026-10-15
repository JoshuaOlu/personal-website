---
layout: profile
title: About Joshua Olunlade
tagline: Engineering education researcher working on industrial placements, access and equity in Nigeria and across Africa.
seo_title_raw: "About Joshua Olunlade, Engineering Education Researcher"
description: >-
  Joshua Olunlade, engineering education researcher at the University of Cape Town (CREE).
  Studies SIWES industrial placements in Nigeria. Biography, expertise and bios to copy.
permalink: /about/
---
<p class="lede">{{ site.data.identity.bio_one_line | normalize_whitespace }}</p>

{% assign long_paras = site.data.identity.bio_long | strip | split: "
" %}
{% for para in long_paras %}{% assign para_text = para | strip %}{% if para_text != "" %}<p>{{ para_text }}</p>{% endif %}{% endfor %}
