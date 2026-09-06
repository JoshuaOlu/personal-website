---
layout: default
title: Joshua Olunlade | Engineering Education Researcher
description: >-
  Joshua Olunlade is an MPhil candidate in Engineering Education at the
  University of Cape Town, researching work-integrated learning access for
  Nigerian engineering undergraduates. Founder and Executive Director of
  Care for Knowledge (CFK).
---

<div class="container">
  <img src="{{ '/assets/images/headshot.jpg' | relative_url }}" alt="Photo of Joshua Olunlade" class="headshot">
  <h1>Joshua Olunlade</h1>
  <p class="tagline">MPhil Candidate &middot; Engineering Education &middot; UCT</p>

  <div class="about">
    <p>
      I am an MPhil student in Engineering Education at the University of Cape Town
      <a href="https://www.cree.uct.ac.za/" target="_blank" rel="noopener">Center for Research in Engineering Education (CREE)</a>,
      where my research examines how Nigerian engineering undergraduates access
      work-integrated learning placements. My work is grounded in constructivist
      grounded theory and a commitment to educational equity across the Global South.
    </p>
    <p style="margin-top:1rem;">
      I am also the founder and Executive Director of
      <a href="https://careforknowledge.org/" target="_blank" rel="noopener">Care for Knowledge (CFK)</a>,
      a Nigerian nonprofit working towards making educational resources more accessible across Nigeria.
    </p>
  </div>

  <div class="research">
    <h2>Research</h2>
    {% for project in site.projects %}
      <div class="research-item">
        <h3>{{ project.title }}</h3>
        <p>{{ project.summary }}</p>
        <a href="{{ project.url | relative_url }}" class="research-link">View project &rarr;</a>
      </div>
    {% endfor %}
  </div>

  <div class="links">
    <a href="{{ '/assets/files/joshua-olunlade-cv.pdf' | relative_url }}" target="_blank" rel="noopener">Curriculum Vitae</a>
    <a href="mailto:joshua@olunlade.com">Contact</a>
  </div>

  {% include social.html %}
</div>
