---
layout: page
title: Research
tagline: Engineering Education, Robotics & Tangible Programming
description: >-
  Research portfolio of Joshua Olunlade — MPhil candidate in Engineering Education.
  Projects span work-integrated learning access, computational thinking, and
  educational technology in underserved contexts.
---

<section class="project-section">
  <h2>Projects</h2>
  {% for project in site.projects %}
    <div class="research-item">
      <h3>{{ project.title }}</h3>
      <p>{{ project.summary }}</p>
      <a href="{{ project.url | relative_url }}" class="button">View project &rarr;</a>
    </div>
  {% endfor %}
</section>
