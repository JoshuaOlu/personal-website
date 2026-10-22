# Looks over a finished build of the site and reports anything that would hurt how
# search engines and AI assistants see it. Also checks the source files for mistakes
# before publishing. Pure Ruby; nothing is changed.
require 'json'
require 'cgi'
require 'uri'
require_relative 'citations'

module Console
  class Audit
    Issue = Struct.new(:level, :page, :message, :fix)

    def initialize(store, site_dir)
      @store = store
      @dir = site_dir
      @issues = []
    end

    def add(level, page, message, fix = nil)
      @issues << { 'level' => level.to_s, 'page' => page, 'message' => message, 'fix' => fix }
    end

    def run
      unless File.directory?(@dir)
        add(:error, '(site)', 'The site has not been built yet.', 'Press "Build and check".')
        return summary
      end
      cfg = (@store.read_config rescue {})
      @site_url = cfg['url'].to_s.sub(%r{/+\z}, '')
      @email = cfg['email'].to_s.strip.downcase
      pages = Dir.glob(File.join(@dir, '**', '*.html')).sort
      @page_info = {}
      pages.each { |f| inspect_page(f) }
      cross_checks
      site_files
      summary
    end

    def web_path(file)
      p = file.sub(@dir, '')
      p = p.sub(/index\.html\z/, '')
      p = p.sub(/\.html\z/, '') unless p == '/404'
      p
    end

    def attr(tag_html, name)
      m = tag_html.match(/#{name}\s*=\s*"([^"]*)"/i) || tag_html.match(/#{name}\s*=\s*'([^']*)'/i)
      m && CGI.unescapeHTML(m[1])
    end

    def meta(html, key, kind = 'name')
      html.scan(/<meta\b[^>]*>/i).each do |tag|
        return attr(tag, 'content') if attr(tag, kind).to_s.downcase == key
      end
      nil
    end

    def inspect_page(file)
      html = File.binread(file).force_encoding('UTF-8').scrub
      page = web_path(file)
      return if page == '/cv/print' || page.start_with?('/.')
      title = html[/<title>(.*?)<\/title>/m, 1].to_s.strip
      title = CGI.unescapeHTML(title)
      desc = meta(html, 'description').to_s
      robots = meta(html, 'robots').to_s
      noindex = robots.include?('noindex')
      canonical = html[/<link[^>]*rel="canonical"[^>]*>/i]
      canonical = canonical && attr(canonical, 'href')
      body = html[/<body.*<\/body>/m].to_s
      left = body.gsub(/<(script|style|pre|code)\b.*?<\/\1>/m, ' ').scan(/\[[-!]?@[A-Za-z0-9][A-Za-z0-9:\-]*[^\]<]{0,60}\]/)
      left.first(3).each { |m| add(:error, page, "A citation was not turned into text: #{m}", 'Check the marker for odd characters, or save the piece in the console and build again.') }
      text = body.gsub(/<(script|style)\b.*?<\/\1>/m, ' ').gsub(/<[^>]+>/, ' ')
      words = CGI.unescapeHTML(text).split.size
      ids = html.scan(/\sid="([^"]+)"/).flatten
      if !noindex && @email.include?('@') && html.downcase.include?(@email)
        add(:warn, page, 'Your email address is written out in the page, where programs that collect addresses can read it.', 'Use the "Write to me" button (the mail include) instead of printing the address.')
      end
      @page_info[page] = { noindex: noindex, title: title, desc: desc, canonical: canonical, ids: ids, html: html, words: words, file: file }
      return if noindex

      if title.empty?
        add(:error, page, 'The page has no title.', 'Add a title in the page\'s front matter.')
      elsif title.size > 65
        add(:warn, page, "The title is #{title.size} characters, so Google may cut it off.", 'Aim for 60 or fewer. Use seo_title to set a shorter one for Google.')
      elsif title.size < 15
        add(:info, page, "The title is short (#{title.size} characters).", 'Add the words people would search for.')
      end

      if desc.empty?
        add(:error, page, 'There is no description for search results.', 'Add a description of about 150 characters in the front matter.')
      elsif desc.size > 175
        add(:warn, page, "The description is #{desc.size} characters. Google shows about 155.", 'Tighten it to 150 or so.')
      elsif desc.size < 70
        add(:info, page, "The description is short (#{desc.size} characters).", 'Use up to 150 to say what the page offers.')
      end

      if canonical.to_s.empty?
        add(:error, page, 'There is no canonical address.', 'Check that url is set in _config.yml.')
      end

      og_image = meta(html, 'og:image', 'property')
      if og_image.to_s.empty?
        add(:warn, page, 'There is no link-preview picture.', 'Set image: in the front matter.')
      else
        local = og_image.sub(@site_url, '')
        path = File.join(@store.root, local.sub(%r{\A/}, ''))
        if local.start_with?('/assets/og/')
          # made automatically when the site is published (see scripts/make_cards.py), so it is not here yet
          add(:info, page, 'The link-preview card for this piece is made automatically when you publish.') unless File.exist?(path)
        elsif local.start_with?('/') && !File.exist?(path)
          add(:error, page, "The link-preview picture #{local} does not exist.", 'Upload it in Media or fix the path.')
        elsif local.start_with?('/') && (size = @store.image_size(path)) && local !~ /\.svg\z/i
          if size[0] < 600
            add(:warn, page, "The link-preview picture is small (#{size[0]}×#{size[1]}).", 'Use 1200×630 pixels.')
          end
        end
      end

      h1s = html.scan(/<h1\b/i).size
      add(:warn, page, "The page has #{h1s} main headings (h1).", 'Use exactly one h1.') if h1s != 1 && page != '/404'

      html.scan(/<img\b[^>]*>/i).each do |tag|
        add(:warn, page, "A picture has no alt text (#{(attr(tag, 'src') || '').split('/').last}).", 'Describe the picture for screen readers and search.') if attr(tag, 'alt').nil?
      end

      blocks = html.scan(/<script type="application\/ld\+json">(.*?)<\/script>/m).flatten
      types = []
      blocks.each do |b|
        begin
          d = JSON.parse(b)
          nodes = d.is_a?(Hash) && d['@graph'] ? d['@graph'] : [d]
          nodes.each { |n| types << n['@type'] if n.is_a?(Hash) }
        rescue JSON::ParserError => e
          add(:error, page, "The structured data (JSON-LD) is not valid: #{e.message[0, 80]}", 'Check _includes/jsonld.html and the page\'s front matter.')
        end
      end
      add(:warn, page, 'There is no structured data about you (Person).', 'Check _includes/jsonld.html.') unless types.include?('Person')

      if words < 120 && !%w[/ /404 /writing/ /research/].include?(page) && page !~ %r{\A/(siwes/survey|writing/(series|themes)/)}
        add(:info, page, "The page has little text (#{words} words).", 'Search engines favour pages that explain themselves.')
      end
    end

    def cross_checks
      # duplicate titles and descriptions
      %i[title desc].each do |field|
        seen = {}
        @page_info.each do |page, i|
          next if i[:noindex] || i[field].to_s.empty?
          (seen[i[field]] ||= []) << page
        end
        seen.each do |val, pgs|
          add(:warn, pgs.join(', '), "These pages share the same #{field == :title ? 'title' : 'description'}: \"#{val[0, 60]}\"", 'Give each page its own.') if pgs.size > 1
        end
      end

      # links that go nowhere
      broken = {}
      @page_info.each do |page, i|
        next if i[:noindex] && page != '/404'
        i[:html].scan(/<a\b[^>]*>/i).each do |tag|
          href = attr(tag, 'href')
          next if href.nil? || href.empty? || href =~ /\A(mailto:|tel:|javascript:)/
          href = href.sub(@site_url, '') if href.start_with?(@site_url)
          next if href =~ %r{\A[a-z]+://}i
          target, frag = href.split('#', 2)
          target = page if target.to_s.empty?
          target = File.expand_path(target, File.dirname(page + 'x')) unless target.start_with?('/')
          target = target.split('?').first
          found = resolve_page(target)
          if found.nil?
            (broken[page] ||= []) << href
          elsif frag && !frag.empty? && found[:ids] && !found[:ids].include?(frag)
            add(:warn, page, "A link to #{href} points to a heading that is not on that page.", 'Fix the #anchor.')
          end
        end
      end
      broken.each { |pg, links| add(:error, pg, "Broken link#{links.uniq.size > 1 ? 's' : ''}: #{links.uniq.first(4).join(', ')}", 'Fix the address or remove the link.') }
    end

    def resolve_page(path)
      return @page_info[path] if @page_info[path]
      return @page_info[path + '/'] if @page_info[path + '/']
      full = File.join(@dir, path.sub(%r{\A/}, ''))
      return { ids: nil } if File.file?(full)
      return { ids: nil } if File.directory?(full) && File.exist?(File.join(full, 'index.html'))
      nil
    end

    def read_built(name)
      f = File.join(@dir, name)
      File.exist?(f) ? File.binread(f).force_encoding('UTF-8') : nil
    end

    def site_files
      robots = read_built('robots.txt')
      if robots.nil?
        add(:error, '/robots.txt', 'robots.txt is missing.', 'Restore robots.txt from the site folder.')
      else
        add(:warn, '/robots.txt', 'robots.txt does not point to the sitemap.', 'Add a Sitemap: line.') unless robots =~ /^Sitemap:/i
        %w[GPTBot ClaudeBot Google-Extended CCBot].each do |bot|
          add(:warn, '/robots.txt', "#{bot} is not blocked from training.", 'Check _data/ai_bots.yml.') unless robots =~ /^User-agent:\s*#{Regexp.escape(bot)}\s*$/i
        end
        add(:error, '/robots.txt', 'Everything is blocked for all robots.', 'Remove "Disallow: /" under "User-agent: *".') if robots =~ /User-agent:\s*\*\s*\n(?:[^\n]*\n)*?Disallow:\s*\/\s*$/i && robots !~ /User-agent:\s*\*\s*\n(?:Content-Signal[^\n]*\n)?Allow:\s*\//i
        %w[OAI-SearchBot Claude-SearchBot PerplexityBot].each do |bot|
          if robots =~ /User-agent:\s*#{Regexp.escape(bot)}\s*\n(?:[^\n]*\n)*?Disallow:\s*\/\s*$/i && robots !~ /User-agent:\s*#{Regexp.escape(bot)}\s*\n(?:Content-Signal[^\n]*\n)?Allow:/i
            add(:error, '/robots.txt', "#{bot} is blocked, so AI search cannot show you.", 'Move it to the allow list in _data/ai_bots.yml.')
          end
        end
      end
      add(:warn, '/llms.txt', 'llms.txt is missing.', 'Restore it from the site folder.') unless read_built('llms.txt')
      add(:info, '/.well-known/tdmrep.json', 'The text-and-data-mining reservation file is missing.', 'Restore .well-known/tdmrep.json.') unless read_built('.well-known/tdmrep.json')

      sitemap = read_built('sitemap.xml')
      if sitemap.nil?
        add(:error, '/sitemap.xml', 'The sitemap is missing.', 'Check that jekyll-sitemap is in _config.yml plugins.')
      else
        locs = sitemap.scan(%r{<loc>(.*?)</loc>}).flatten.map { |u| u.sub(@site_url, '') }
        locs.each do |l|
          pg = @page_info[l] || @page_info[l.chomp('/') + '/']
          if pg && pg[:noindex]
            add(:error, l, 'This page is in the sitemap but marked noindex.', 'Remove it from the sitemap (sitemap: false) or allow indexing.')
          elsif pg.nil? && !File.exist?(File.join(@dir, l.sub(%r{\A/}, '')))
            add(:warn, l, 'The sitemap lists a page that is not in the build.', nil)
          end
        end
        @page_info.each do |page, i|
          next if i[:noindex] || page == '/404'
          add(:info, page, 'This page is not in the sitemap.', 'Remove sitemap: false if you want it listed.') unless locs.include?(page)
        end
      end
      if File.exist?(File.join(@store.root, 'assets/files/joshua-olunlade-cv.pdf')) == false
        add(:info, '/assets/files/joshua-olunlade-cv.pdf', 'The CV PDF is made when you publish.', nil)
      end
      key = Dir.children(@store.root).find { |f| f =~ /\A[0-9a-f]{32}\.txt\z/ }
      add(:info, '(site)', 'IndexNow is not set up, so Bing and others are not told when you publish.', 'Use "Tell search engines" on the Publish screen.') unless key
    end

    def summary
      order = { 'error' => 0, 'warn' => 1, 'info' => 2 }
      list = @issues.sort_by { |i| [order[i['level']], i['page'].to_s] }
      counts = Hash.new(0)
      list.each { |i| counts[i['level']] += 1 }
      pages = @page_info ? @page_info.count { |_, i| !i[:noindex] } : 0
      { 'issues' => list, 'counts' => { 'error' => counts['error'], 'warn' => counts['warn'], 'info' => counts['info'] }, 'pages' => pages,
        'checked_at' => Time.now.iso8601 }
    end

    # ── checks on the source files, before anything is built ─────────────────
    def self.check_source(store)
      out = []
      add = ->(level, where, msg) { out << { 'level' => level, 'page' => where, 'message' => msg, 'fix' => nil } }

      Store::DATA_FILES.each do |name, path|
        next unless File.exist?(store.resolve(path))
        begin
          store.load_yaml(store.read_text(path), path)
        rescue UserError => e
          add.call('error', path, e.message)
        end
      end
      begin
        store.load_yaml(store.read_text('_config.yml'), '_config.yml')
      rescue UserError => e
        add.call('error', '_config.yml', e.message)
      end

      pubs = (store.read_data('publications')['data'] rescue nil) || []
      ids = pubs.map { |p| p['id'] }
      ids.group_by { |i| i }.each { |i, v| add.call('error', '_data/publications.yml', "The id \"#{i}\" is used #{v.size} times. Each paper needs its own.") if i.to_s != '' && v.size > 1 }
      pubs.each do |p|
        add.call('error', '_data/publications.yml', "A paper is missing its id: #{p['title'].to_s[0, 50]}") if p['id'].to_s.empty?
        add.call('warn', '_data/publications.yml', "\"#{p['title'].to_s[0, 50]}\" has no DOI or web address.") if p['doi'].to_s.empty? && p['url'].to_s.empty?
      end

      # GitHub Pages builds with Jekyll 3.10, which cannot read two conditions inside one where_exp.
      Dir.glob(File.join(store.root, '**', '*.{html,md,txt,xml}')).each do |f|
        rel = f.sub(store.root + '/', '')
        next if rel =~ %r{\A(?:console|guide|_site|node_modules|\.git|\.console-data|vendor)/}
        text = File.read(f, encoding: 'UTF-8') rescue next
        if text =~ /where_exp:\s*"[^"]*"\s*,\s*"[^"]*\s(?:and|or)\s[^"]*"/
          add.call('error', rel, 'This uses where_exp with two conditions (and / or), which the GitHub Pages version of Jekyll cannot read, so the live build would fail. Chain two where_exp filters instead, one condition each.')
        end
      end

      home = (store.read_data('home')['data'] rescue nil)
      if home.is_a?(Hash)
        modes = %w[welcome researcher writer]
        sections = %w[latest writing now research publications about topics newsletter hello]
        add.call('error', '_data/home.yml', "The mode \"#{home['mode']}\" is not one of: welcome, researcher, writer.") unless modes.include?(home['mode'].to_s)
        modes.each do |m|
          cfg = home[m]
          unless cfg.is_a?(Hash)
            add.call('error', '_data/home.yml', "There are no words for the #{m} mode.") if home['mode'].to_s == m
            next
          end
          add.call('warn', '_data/home.yml', "The #{m} mode has no opening words.") if cfg['lede'].to_s.strip.empty? && home['mode'].to_s == m
          add.call('warn', '_data/home.yml', "The heading in the #{m} mode does not contain your name, which helps search engines.") if cfg['headline'].to_s !~ /olunlade|joshua/i && home['mode'].to_s == m
          Array(cfg['sections']).each { |sec| add.call('error', '_data/home.yml', "The #{m} mode lists a section called \"#{sec.is_a?(Hash) ? sec['section'] : sec}\", which does not exist.") unless sections.include?((sec.is_a?(Hash) ? sec['section'] : sec).to_s) }
        end
      elsif home.nil?
        add.call('error', '_data/home.yml', 'The home page settings file is missing, so the home page will be empty.')
      end

      refs = Citations.load_refs(store.root)
      ref_ids = refs.map { |r| r['id'].to_s }
      ref_ids.each_with_index { |id, i| add.call('error', '_data/references.yml', "The reference name \"#{id}\" is used twice.") if ref_ids.index(id) != i }
      urls = Hash.new { |h, k| h[k] = [] }
      Store::KINDS.each_key do |kind|
        store.list_kind(kind).each do |d|
          if d['error']
            add.call('error', d['path'], d['error'])
            next
          end
          fm = d['front']
          urls[d['url']] << d['path'] if d['url']
          add.call('warn', d['path'], 'There is no title.') if fm['title'].to_s.strip.empty?
          if kind == 'writing'
            n = fm['title'].to_s.strip.length
            add.call('warn', d['path'], "The title is #{n} characters. The preview card trims anything past about 90, and it looks best at 70 or fewer.") if n > 90
            add.call('info', d['path'], 'It has no tags, so its preview card says "Essay". Add a tag, or set card_topic, to put a topic on the card.') if Array(fm['tags']).empty? && fm['card_topic'].to_s.strip.empty? && fm['image'].nil?
          end
          if kind == 'projects'
            (fm['publications'] || []).each { |pid| add.call('error', d['path'], "It lists the paper \"#{pid}\", which is not in publications.yml.") unless ids.include?(pid) }
          end
          if kind == 'links'
            dest = fm['destination'].to_s
            add.call('error', d['path'], 'The destination must start with https:// or /.') unless dest.start_with?('https://') || dest =~ %r{\A/(?!/)}
            %w[opens_on ends_on].each do |k|
              v = fm[k].to_s
              add.call('error', d['path'], "#{k} must look like 2026-12-31.") unless v.empty? || v =~ /\A\d{4}-\d{2}-\d{2}\z/
            end
            add.call('warn', d['path'], 'The status should be live, paused or ended.') unless %w[live paused ended].include?(fm['status'].to_s)
          end
          imgs = [fm['cover'], fm['image'].is_a?(Hash) ? fm['image']['path'] : fm['image']].compact
          imgs.each do |im|
            next unless im.to_s.start_with?('/')
            add.call('error', d['path'], "The picture #{im} does not exist.") unless File.exist?(File.join(store.root, im.sub(%r{\A/}, '')))
          end
          add.call('info', d['path'], 'It is unpublished (published: false), so visitors cannot see it.') if fm['published'] == false
          if %w[writing projects].include?(kind)
            body = (store.read_doc(d['path'])['body'] rescue '').to_s
            res = Citations.build_doc(refs, body)
            res['unknown'].each { |k| add.call('error', d['path'], "It cites [@#{k}], which is not in your references.") }
            by = refs.each_with_object({}) { |r, h| h[r['id'].to_s] = r }
            Citations.build_doc(refs, body)['references'].scan(/id="ref-([^"]+)"/).flatten.each do |k|
              r = by[k] or next
              miss = []
              miss << 'author' if Citations.authors(r).empty?
              miss << 'year' if r['year'].to_s.strip.empty?
              add.call('warn', d['path'], "The reference \"#{k}\" has no #{miss.join(" or ")}, so it shows as n.d. or by title.") unless miss.empty?
            end
          end
        end
      end
      urls.each { |u, files| add.call('error', files.join(', '), "These files share the same address #{u}.") if files.size > 1 }

      # Series and themes: every link between a piece and its series or themes has to point at something real.
      series = store.list_kind('series').reject { |d| d['error'] }
      themes = store.list_kind('themes').reject { |d| d['error'] }
      pieces = store.list_kind('writing').reject { |d| d['error'] || d['front']['published'] == false }
      store.list_kind('writing').reject { |d| d['error'] }.each do |d|
        fm = d['front']
        sl = fm['series'].to_s
        if sl != ''
          sr = series.find { |x| x['slug'] == sl }
          if sr.nil?
            add.call('error', d['path'], "It belongs to the series \"#{sl}\", which does not exist. Pick a series in the piece's Series and themes card, or create it first.")
          else
            part = fm['series_part']
            if part.to_s !~ /\A\d+\z/ || part.to_i < 1
              add.call('warn', d['path'], 'It is in a series but has no part number, so the series cannot place it in order. Set the part number.')
            else
              tot = sr['front']['total_parts'].to_i
              add.call('warn', d['path'], "It is part #{part} but the series says it has #{tot} parts. Raise the number of parts, or fix the part number.") if tot > 0 && part.to_i > tot
              twin = store.list_kind('writing').find { |o| o['path'] != d['path'] && !o['error'] && o['front']['series'].to_s == sl && o['front']['series_part'].to_s == part.to_s }
              add.call('error', d['path'], "Part #{part} of this series is also used by #{twin['path']}. Each part number can only be used once.") if twin
            end
          end
        elsif fm['series_part'].to_s != ''
          add.call('warn', d['path'], 'It has a part number but no series. Choose its series, or clear the part number.')
        end
        Array(fm['themes']).each do |t|
          add.call('error', d['path'], "It lists the theme \"#{t}\", which does not exist. Pick from your themes, or create it first.") unless themes.any? { |x| x['slug'] == t.to_s }
        end
        add.call('info', d['path'], 'It is not in any theme yet, so readers cannot find it through the themes.') if Array(fm['themes']).empty? && fm['published'] != false && !themes.empty?
      end
      series.each do |sr|
        fm = sr['front']
        add.call('warn', sr['path'], 'The status should be ongoing or complete.') unless %w[ongoing complete].include?(fm['status'].to_s)
        add.call('warn', sr['path'], 'The number of parts should be a whole number, or left empty if you do not know yet.') unless fm['total_parts'].to_s =~ /\A\d*\z/
        add.call('warn', sr['path'], 'There is no summary. It shows on the Writing page and in search results.') if fm['summary'].to_s.strip.empty?
        add.call('info', sr['path'], 'No published piece is in this series yet, so its page is hidden from visitors and search engines.') unless pieces.any? { |x| x['front']['series'].to_s == sr['slug'] }
        Array(fm['planned']).each do |pl|
          add.call('warn', sr['path'], 'A planned part is missing its part number or title.') unless pl.is_a?(Hash) && pl['part'].to_s =~ /\A\d+\z/ && pl['title'].to_s.strip != ''
        end
      end
      themes.each do |t|
        n = pieces.count { |x| Array(x['front']['themes']).include?(t['slug']) }
        add.call('warn', t['path'], 'There is no summary. It shows on the themes page.') if t['front']['summary'].to_s.strip.empty?
        add.call('info', t['path'], 'Only one piece uses this theme so far. The theme page appears when a second one does.') if n == 1
      end
      out
    end
  end
end
