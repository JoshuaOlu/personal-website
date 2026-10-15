---
layout: default
title: Joshua Olunlade
seo_title_raw: "Joshua Olunlade | Engineering Education, Nigeria & Africa"
description: >-
  Joshua Olunlade is an engineering education researcher at the University of Cape Town
  studying industrial placements (SIWES) in Nigeria, and founder of Care for Knowledge.
---

<section class="hero">
  <div>
    <h1>Joshua Olunlade</h1>
    <p class="hero-lede">
      Engineering education researcher. I study how students in Nigeria find their way
      into industrial placements, and I build programmes and tools that put learning
      within reach.
    </p>
    <div class="hero-actions">
      <a class="button" href="{{ '/cv/' | relative_url }}">Read my CV</a>
      <a class="button secondary" href="mailto:{{ site.email }}">Get in touch</a>
    </div>
  </div>
  <img
    class="hero-photo"
    src="{{ '/assets/images/headshot.jpg' | relative_url }}"
    alt="Joshua Olunlade, smiling, wearing round glasses and a mint green shirt"
    width="572" height="571">
</section>

<section class="about" aria-label="About">
  <div class="prose">
    <p>
      I am an MPhil student in Engineering Education at the University of Cape Town
      <a href="https://ebe.uct.ac.za/cree" target="_blank" rel="noopener">Center for Research in Engineering Education (CREE)</a>,
      where my research examines
      <a href="{{ '/siwes/' | relative_url }}">how Nigerian engineering undergraduates access
      work-integrated learning placements</a>. My work is grounded in constructivist
      grounded theory and a commitment to educational equity across the Global South.
    </p>
    <p>
      I am also the founder and Executive Director of
      <a href="https://careforknowledge.org/" target="_blank" rel="noopener">Care for Knowledge (CFK)</a>,
      a Nigerian nonprofit working towards making educational resources more accessible across Nigeria.
    </p>
  </div>
</section>

<section class="section" aria-labelledby="research-heading">
  <h2 id="research-heading">Research</h2>
  {% include project-list.html %}
</section>

<section class="section" aria-labelledby="focus-heading">
  <h2 id="focus-heading">What I work on</h2>
  <ul class="focus-list">
    {% for t in site.data.identity.topics %}
    <li><a href="{{ '/about/' | relative_url }}#what-i-work-on">{{ t.title }}</a></li>
    {% endfor %}
  </ul>
</section>

{% assign recent_posts = site.writing | sort: "date" | reverse %}
{% if recent_posts.size > 0 %}
<section class="section" aria-labelledby="writing-heading">
  <h2 id="writing-heading">Writing</h2>
  <ol class="writing-list">
    {% for post in recent_posts limit: 3 %}
    <li class="writing-row">
      <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%-d %b %Y" }}</time>
      <div>
        <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
        {% if post.summary %}<p>{{ post.summary }}</p>{% endif %}
      </div>
    </li>
    {% endfor %}
  </ol>
  <p class="more-link"><a href="{{ '/writing/' | relative_url }}">All writing &rarr;</a></p>
</section>
{% endif %}
