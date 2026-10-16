'use strict';
/* What each data file looks like, so the forms can be drawn. */

const PUB_TYPES = [
  { value: 'journal', label: 'Journal article' }, { value: 'conference', label: 'Conference paper' },
  { value: 'preprint', label: 'Preprint' }, { value: 'chapter', label: 'Book chapter' }, { value: 'report', label: 'Report' }
];

const SHOW_OPTIONS = [
  { value: 'web', label: 'The website only' }, { value: 'pdf', label: 'The PDF CV only' }, { value: 'none', label: 'Nowhere (kept, but hidden)' }
];
const SHOW_FIELD = { k: 'show', label: 'Where to show it', w: 'select', blank: 'Everywhere (default)', options: SHOW_OPTIONS,
  hint: 'Hide something without deleting it. "Nowhere" keeps it in your file but off the site and the PDF.' };
const showTag = (x) => (x && x.show === 'web' ? ' · website only' : x && x.show === 'pdf' ? ' · PDF only' : x && x.show === 'none' ? ' · hidden' : '');

const SCHEMA = {
  publications: {
    k: 'items', w: 'objlist', label: 'Your papers', addLabel: 'Add a paper', addFirst: true,
    hint: 'Add each paper once. The CV, the Publications page, project pages, search engines and AI assistants all read from here.',
    empty: 'No papers yet. Press "Add a paper".',
    itemLabel: (it) => ({ main: it.title || 'New paper', sub: [it.year, it.type].filter(Boolean).join(' · ') + showTag(it) }),
    newItem: () => ({ id: '', type: 'journal', authors: '', year: new Date().getFullYear(), title: '', venue: '' }),
    fields: [
      { k: 'id', label: 'Short ID', required: true, hint: 'Lowercase, no spaces, e.g. tinkabot-review. Used to attach the paper to a project.', validate: (v) => (!v ? 'An ID is needed.' : /^[a-z0-9][a-z0-9-]*$/.test(v) ? '' : 'Use lowercase letters, numbers and dashes only.') },
      { k: 'type', label: 'Type', w: 'select', required: true, options: PUB_TYPES },
      { k: 'authors', label: 'Authors', wide: true, hint: 'Exactly as printed, ending with a full stop. Example: Olunlade, J. O., & Olayemi, M.' },
      { k: 'year', label: 'Year', w: 'number', required: true },
      { k: 'month', label: 'Month (optional)', placeholder: 'June' },
      { k: 'title', label: 'Title', w: 'area', rows: 2, wide: true },
      { k: 'prefix', label: 'Words before the venue (optional)', placeholder: 'Paper presented at' },
      { k: 'venue', label: 'Journal or conference' },
      { k: 'details', label: 'Volume and pages, or city (optional)' },
      { k: 'doi', label: 'DOI', hint: 'Without https://doi.org/ . Best for search and AI: a DOI makes the paper unmistakably yours.' },
      { k: 'url', label: 'Web address (only if no DOI)', type: 'url' },
      Object.assign({}, SHOW_FIELD, { hint: 'Hide a paper without deleting it. It stays citable in your writing; "Nowhere" keeps it off the CV, Publications page, home page and search data.' }),
      { w: 'preview', label: 'How it will read', fn: (it) => [it.authors, '(' + (it.year || '') + (it.month ? ', ' + it.month : '') + ').', it.title + '.', (it.prefix ? it.prefix + ' ' : '') + (it.venue || '') + (it.details ? ', ' + it.details : '') + '.', it.doi ? 'https://doi.org/' + it.doi : (it.url || '')].filter(Boolean).join(' ') }
    ]
  },

  cv: [
    { k: 'name', label: 'Name' },
    { k: 'headline', label: 'Headline' },
    { k: 'updated', label: 'Last updated', w: 'date', hint: 'Set to today automatically whenever you save.' },
    { k: 'profiles', label: 'Profiles shown in the CV header', w: 'strlist', hint: 'Labels from Social links, such as ORCID or LinkedIn.' },
    {
      k: 'sections', w: 'objlist', label: 'Sections', addLabel: 'Add a section', empty: 'No sections yet.',
      hint: 'Open a section to edit its entries. Use the arrows to reorder.',
      itemLabel: (s) => ({ main: s.title || 'New section', sub: (s.publications ? 'papers (from Publications)' : ((s.entries || []).length + ' entries')) + showTag(s) }),
      newItem: () => ({ title: '', entries: [] }),
      fields: [
        { k: 'title', label: 'Section title', required: true },
        Object.assign({}, SHOW_FIELD, { label: 'Where to show this whole section' }),
        { k: 'text', label: 'Intro line (optional)', w: 'area', rows: 2 },
        { w: 'note', text: 'The papers in this section are listed automatically from the Publications page. To add one, go to Publications.', showIf: (s) => !!s.publications },
        { k: 'publications', label: 'Paper groups', w: 'objlist', showIf: (s) => !!s.publications, itemLabel: (g) => ({ main: g.heading || g.type }), newItem: () => ({ type: 'journal', heading: 'Journal Articles' }),
          fields: [{ k: 'type', label: 'Type', w: 'select', required: true, options: PUB_TYPES }, { k: 'heading', label: 'Heading' }] },
        {
          k: 'entries', label: 'Entries', w: 'objlist', addLabel: 'Add an entry', addFirst: true, showIf: (s) => !s.publications, empty: 'No entries yet.',
          itemLabel: (e) => ({ main: e.title || 'New entry', sub: [e.org, e.dates].filter(Boolean).join(' · ') + showTag(e) }),
          newItem: () => ({ title: '' }),
          fields: [
            { k: 'title', label: 'Role, degree or award', required: true, wide: true },
            SHOW_FIELD,
            { k: 'org', label: 'Organisation or place' },
            { k: 'dates', label: 'Dates', placeholder: 'Jan 2025 to Present', hint: 'Use "to" between dates. Examples: 2022, Jan 2025 to Jan 2026, Expected 2027.' },
            { k: 'note', label: 'One plain line of detail', wide: true },
            { k: 'bullets', label: 'Bullet points', w: 'strlist', area: true, addLabel: 'Add a point' },
            { k: 'links', label: 'Links (certificates and so on)', w: 'objlist', addLabel: 'Add a link', itemLabel: (l) => ({ main: l.label || 'Link', sub: l.url }), newItem: () => ({ label: 'Certificate', url: '' }),
              fields: [{ k: 'label', label: 'Label' }, { k: 'url', label: 'Web address', type: 'url' }] }
          ]
        }
      ]
    }
  ],

  social: {
    k: 'items', w: 'objlist', label: 'Your profiles', addLabel: 'Add a profile', empty: 'No profiles yet.',
    hint: 'These appear on your home page and are declared to search engines as belonging to you (the "sameAs" list). Keep them to accounts you actively use.',
    itemLabel: (s) => ({ main: s.label || 'New profile', sub: s.url }),
    newItem: () => ({ label: '', url: 'https://' }),
    fields: [{ k: 'label', label: 'Name shown', required: true }, { k: 'url', label: 'Web address', type: 'url', required: true, validate: (v) => (/^https:\/\/\S+$/.test(v) ? '' : 'Must start with https://') }]
  },

  authors: [
    { k: 'highlight', label: 'Your name as it appears in author lists', w: 'strlist', addLabel: 'Add a form of your name',
      hint: 'Anywhere one of these matches exactly (including capitals), your name is printed in bold. Put the longest form first.' }
  ],

  identity: [
    { k: 'name', label: 'Full name' },
    { k: 'given_name', label: 'Given name' },
    { k: 'family_name', label: 'Family name' },
    { k: 'job_title', label: 'What you do, in a few words', hint: 'Shown in search results and used by AI assistants. Example: Engineering education researcher.' },
    { k: 'also_known_as', label: 'Other ways your name is written', w: 'strlist', addLabel: 'Add a spelling', hint: 'Lets search engines join "Olunlade, J. O." on a paper to you.' },
    { k: 'bio_one_line', label: 'One-line bio (about 25 words)', w: 'area', rows: 2, wide: true, words: { target: 25 }, hint: 'This is the sentence an AI assistant is most likely to repeat about you. Make it accurate and specific.' },
    { k: 'bio_short', label: 'Short bio (about 50 words)', w: 'area', rows: 4, wide: true, words: { target: 50 } },
    { k: 'bio_long', label: 'Long bio (about 120 words)', w: 'area', rows: 9, wide: true, words: { target: 120 }, hint: 'Leave a blank line between paragraphs.' },
    { k: 'affiliations', label: 'Organisations you belong to', w: 'objlist', addLabel: 'Add an organisation', itemLabel: (a) => ({ main: a.name || 'New organisation' }), newItem: () => ({ name: '', url: 'https://', type: 'Organization' }),
      fields: [{ k: 'name', label: 'Name', wide: true }, { k: 'url', label: 'Web address', type: 'url' }, { k: 'type', label: 'Kind', w: 'select', required: true, options: ['Organization', 'CollegeOrUniversity', 'ResearchOrganization', 'NGO', 'Corporation'] }] },
    { k: 'alumni_of', label: 'Where you studied', w: 'objlist', addLabel: 'Add a school or university', itemLabel: (a) => ({ main: a.name || 'New school' }), newItem: () => ({ name: '', url: 'https://', type: 'CollegeOrUniversity' }),
      fields: [{ k: 'name', label: 'Name', wide: true }, { k: 'url', label: 'Web address', type: 'url' }, { k: 'type', label: 'Kind', w: 'select', required: true, options: ['CollegeOrUniversity', 'EducationalOrganization', 'Organization'] }] },
    { k: 'topics', label: 'What you want to be known for', w: 'objlist', addLabel: 'Add a topic', hint: 'Most important first. Each becomes a heading on the About page and is told to search engines as something you know about.',
      itemLabel: (t) => ({ main: t.title || 'New topic' }), newItem: () => ({ title: '', text: '' }),
      fields: [{ k: 'title', label: 'Topic', wide: true }, { k: 'text', label: 'One or two sentences about your angle', w: 'area', rows: 3, wide: true }] },
    { k: 'same_as_extra', label: 'Other profiles that prove these accounts are yours', w: 'strlist', addLabel: 'Add a profile address', placeholder: 'https://scholar.google.com/citations?user=…',
      hint: 'Google Scholar, Zenodo, your UCT page, Wikidata. Profiles on the Social links page are already included.' }
  ],

  home: [
    { k: 'mode', w: 'cards', label: 'What should the home page lead with?', options: [
      { value: 'welcome', label: 'Welcome', text: 'A warm hello, your newest piece of writing, and what you are working on now. Best for meeting new people.' },
      { value: 'researcher', label: 'Researcher', text: 'Your research, papers and CV come first. Best when you are applying or being checked out by academics.' },
      { value: 'writer', label: 'Writer', text: 'Your essays come first, with the sign-up for new pieces. Best once you are publishing regularly.' }
    ], hint: 'Pick one, press Save, then Publish. You can switch whenever you like. Each mode keeps its own words below.' },
    { k: 'welcome', w: 'group', collapsed: true, label: 'Words for Welcome', fields: [
      { k: 'eyebrow', label: 'Small line above the name', hint: 'Optional. Example: Hello, and welcome.' },
      { k: 'headline', label: 'Big heading', hint: 'Keep your full name in it, so search engines see it.' },
      { k: 'lede', label: 'Opening words', w: 'area', rows: 4, wide: true, counter: [80, 300], hint: 'Two or three sentences, in your own voice. Warm and plain works best.' },
      { k: 'primary_label', label: 'Main button' }, { k: 'primary_url', label: 'Main button goes to', hint: 'A page like /cv/ or /writing/, a full web address, or the word mailto to write to you. A button to /writing/ hides itself until you publish a piece.' },
      { k: 'secondary_label', label: 'Second button (optional)' }, { k: 'secondary_url', label: 'Second button goes to' },
      { k: 'sections', label: 'What follows, in order', w: 'objlist', addLabel: 'Add a section', hint: 'Use the arrows to reorder. A section with nothing to show (no writing yet, for example) simply stays out of the way.',
        itemLabel: (s) => ({ main: ({ latest: 'Newest piece of writing', writing: 'Earlier pieces', now: 'What I am working on', research: 'All research', publications: 'Recent papers', about: 'A little about me', topics: 'Things I think about', newsletter: 'Sign-up for new pieces', hello: 'Say hello' })[s.section] || 'New section' }), newItem: () => ({ section: 'about' }),
        fields: [{ k: 'section', label: 'Section', w: 'select', required: true, options: [{ value: 'latest', label: 'Newest piece of writing (featured)' }, { value: 'writing', label: 'Earlier pieces of writing' }, { value: 'now', label: 'What I am working on now' }, { value: 'research', label: 'All research' }, { value: 'publications', label: 'Recent papers' }, { value: 'about', label: 'A little about me (with Care for Knowledge)' }, { value: 'topics', label: 'Things I think about' }, { value: 'newsletter', label: 'Sign-up for new pieces' }, { value: 'hello', label: 'Say hello (contact)' }] }] }
    ] },
    { k: 'researcher', w: 'group', collapsed: true, label: 'Words for Researcher', fields: [
      { k: 'eyebrow', label: 'Small line above the name', hint: 'Optional. Example: Hello, and welcome.' },
      { k: 'headline', label: 'Big heading', hint: 'Keep your full name in it, so search engines see it.' },
      { k: 'lede', label: 'Opening words', w: 'area', rows: 4, wide: true, counter: [80, 300], hint: 'Two or three sentences, in your own voice. Warm and plain works best.' },
      { k: 'primary_label', label: 'Main button' }, { k: 'primary_url', label: 'Main button goes to', hint: 'A page like /cv/ or /writing/, a full web address, or the word mailto to write to you. A button to /writing/ hides itself until you publish a piece.' },
      { k: 'secondary_label', label: 'Second button (optional)' }, { k: 'secondary_url', label: 'Second button goes to' },
      { k: 'sections', label: 'What follows, in order', w: 'objlist', addLabel: 'Add a section', hint: 'Use the arrows to reorder. A section with nothing to show (no writing yet, for example) simply stays out of the way.',
        itemLabel: (s) => ({ main: ({ latest: 'Newest piece of writing', writing: 'Earlier pieces', now: 'What I am working on', research: 'All research', publications: 'Recent papers', about: 'A little about me', topics: 'Things I think about', newsletter: 'Sign-up for new pieces', hello: 'Say hello' })[s.section] || 'New section' }), newItem: () => ({ section: 'about' }),
        fields: [{ k: 'section', label: 'Section', w: 'select', required: true, options: [{ value: 'latest', label: 'Newest piece of writing (featured)' }, { value: 'writing', label: 'Earlier pieces of writing' }, { value: 'now', label: 'What I am working on now' }, { value: 'research', label: 'All research' }, { value: 'publications', label: 'Recent papers' }, { value: 'about', label: 'A little about me (with Care for Knowledge)' }, { value: 'topics', label: 'Things I think about' }, { value: 'newsletter', label: 'Sign-up for new pieces' }, { value: 'hello', label: 'Say hello (contact)' }] }] }
    ] },
    { k: 'writer', w: 'group', collapsed: true, label: 'Words for Writer', fields: [
      { k: 'eyebrow', label: 'Small line above the name', hint: 'Optional. Example: Hello, and welcome.' },
      { k: 'headline', label: 'Big heading', hint: 'Keep your full name in it, so search engines see it.' },
      { k: 'lede', label: 'Opening words', w: 'area', rows: 4, wide: true, counter: [80, 300], hint: 'Two or three sentences, in your own voice. Warm and plain works best.' },
      { k: 'primary_label', label: 'Main button' }, { k: 'primary_url', label: 'Main button goes to', hint: 'A page like /cv/ or /writing/, a full web address, or the word mailto to write to you. A button to /writing/ hides itself until you publish a piece.' },
      { k: 'secondary_label', label: 'Second button (optional)' }, { k: 'secondary_url', label: 'Second button goes to' },
      { k: 'sections', label: 'What follows, in order', w: 'objlist', addLabel: 'Add a section', hint: 'Use the arrows to reorder. A section with nothing to show (no writing yet, for example) simply stays out of the way.',
        itemLabel: (s) => ({ main: ({ latest: 'Newest piece of writing', writing: 'Earlier pieces', now: 'What I am working on', research: 'All research', publications: 'Recent papers', about: 'A little about me', topics: 'Things I think about', newsletter: 'Sign-up for new pieces', hello: 'Say hello' })[s.section] || 'New section' }), newItem: () => ({ section: 'about' }),
        fields: [{ k: 'section', label: 'Section', w: 'select', required: true, options: [{ value: 'latest', label: 'Newest piece of writing (featured)' }, { value: 'writing', label: 'Earlier pieces of writing' }, { value: 'now', label: 'What I am working on now' }, { value: 'research', label: 'All research' }, { value: 'publications', label: 'Recent papers' }, { value: 'about', label: 'A little about me (with Care for Knowledge)' }, { value: 'topics', label: 'Things I think about' }, { value: 'newsletter', label: 'Sign-up for new pieces' }, { value: 'hello', label: 'Say hello (contact)' }] }] }
    ] },
    { k: 'about', w: 'group', label: 'A little about me (shared by every mode)', fields: [
      { k: 'title', label: 'Heading' },
      { k: 'text', label: 'Your words', w: 'area', rows: 6, wide: true, hint: 'Write [words](address) to make a link.' },
      { k: 'link_label', label: 'Link text' }, { k: 'link_url', label: 'Link goes to' }
    ] },
    { k: 'cfk', w: 'group', label: 'Care for Knowledge card (shown beside "about me"; leave the words empty to hide it)', fields: [
      { k: 'title', label: 'Heading' },
      { k: 'text', label: 'Your words', w: 'area', rows: 4, wide: true },
      { k: 'link_label', label: 'Link text' }, { k: 'link_url', label: 'Link goes to', type: 'url' }
    ] },
    { k: 'hello', w: 'group', label: 'Say hello (the invitation at the bottom)', fields: [
      { k: 'title', label: 'Heading' },
      { k: 'text', label: 'Your words', w: 'area', rows: 3, wide: true },
      { k: 'button_label', label: 'Button text' }
    ] }
  ],

  ai_bots: [
    { w: 'note', text: 'Allowed bots help people find you: they power AI search and answer tools. Blocked bots collect pages to train AI models. These lists build /robots.txt every time you publish. A name here is a request, not a lock: well-behaved companies follow it.' },
    { k: 'allow', label: 'Allowed (search and answer tools)', w: 'objlist', addLabel: 'Add a bot', itemLabel: (b) => ({ main: b.name || 'New bot', sub: b.owner }), newItem: () => ({ name: '', owner: '', what: '' }),
      fields: [{ k: 'name', label: 'Bot name (exactly as the company writes it)', required: true }, { k: 'owner', label: 'Company' }, { k: 'what', label: 'What it does', wide: true }] },
    { k: 'block', label: 'Blocked (collect pages for AI training)', w: 'objlist', addLabel: 'Add a bot', itemLabel: (b) => ({ main: b.name || 'New bot', sub: b.owner }), newItem: () => ({ name: '', owner: '', what: '' }),
      fields: [{ k: 'name', label: 'Bot name (exactly as the company writes it)', required: true }, { k: 'owner', label: 'Company' }, { k: 'what', label: 'What it does', wide: true }] }
  ]
};

const PROJECT_STATUSES = ['Recruiting', 'In progress', 'Completed', 'Paused'];
