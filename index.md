---
layout: default
title: Joshua Olunlade
seo_title_raw: "Joshua Olunlade | Engineering Education, Nigeria & Africa"
description: >-
  Joshua Olunlade is an engineering education researcher at the University of Cape Town
  studying industrial placements (SIWES) in Nigeria, and founder of Care for Knowledge.
---
{%- comment -%}
  What shows here, and in what order, is set in _data/home.yml (console: Home page).
{%- endcomment -%}
{%- assign home_mode = site.data.home.mode | default: "welcome" -%}
{%- assign home_cfg = site.data.home[home_mode] -%}
{% include home-hero.html cfg=home_cfg %}
{% for s in home_cfg.sections %}{% include home-section.html id=s.section %}
{% endfor %}
