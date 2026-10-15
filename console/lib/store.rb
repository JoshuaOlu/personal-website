# Everything that reads and writes the site's files. All paths are checked so that
# nothing outside the site folder can be touched, and every overwrite makes a backup.
require 'yaml'
require 'json'
require 'date'
require 'fileutils'
require 'time'
require 'tmpdir'
require 'digest'

module Console
  class UserError < StandardError
    attr_reader :status
    def initialize(msg, status = 422)
      super(msg)
      @status = status
    end
  end

  class Store
    # Folders the console never reads or writes through its file tools.
    BLOCKED_DIRS = %w[.git .github _site vendor node_modules .console-data console .jekyll-cache .bundle].freeze
    BLOCKED_FILES = %w[Gemfile.lock].freeze
    TEXT_EXT = %w[.md .markdown .html .yml .yaml .css .js .json .txt .xml .svg .liquid].freeze
    IMAGE_EXT = %w[.png .jpg .jpeg .gif .webp .svg .ico].freeze
    DATA_FILES = {
      'cv' => '_data/cv.yml', 'publications' => '_data/publications.yml', 'social' => '_data/social.yml',
      'authors' => '_data/authors.yml', 'identity' => '_data/identity.yml', 'ai_bots' => '_data/ai_bots.yml'
    }.freeze
    KINDS = { 'projects' => '_projects', 'writing' => '_writing', 'links' => '_links' }.freeze
    RESERVED_PATHS = %w[assets research writing cv about publications ai-policy feed.xml robots.txt llms.txt
                        sitemap.xml 404.html siwes console admin].freeze

    attr_reader :root, :data_dir, :runtime_dir

    def initialize(root)
      @root = File.realpath(root)
      @data_dir = File.join(@root, '.console-data')
      # Logs and test builds live outside the site folder, so they can never trigger Jekyll's auto-rebuild.
      @runtime_dir = File.join(Dir.tmpdir, "site-console-#{Digest::MD5.hexdigest(@root)[0, 10]}")
      @lock = Mutex.new
    end

    # ── paths ────────────────────────────────────────────────────────────────
    def resolve(rel, must_exist: false)
      rel = rel.to_s.tr('\\', '/').sub(%r{\A/+}, '')
      raise UserError.new('No file name was given.', 400) if rel.empty?
      raise UserError.new('That path is not allowed.', 403) if rel.include?("\0")
      parts = rel.split('/')
      raise UserError.new('That path is not allowed.', 403) if parts.any? { |p| p == '..' || p == '.' || p.empty? }
      raise UserError.new('That folder is off limits.', 403) if BLOCKED_DIRS.include?(parts.first) || parts.any? { |p| p == '.git' }
      raise UserError.new('That file is off limits.', 403) if BLOCKED_FILES.include?(parts.last)
      full = File.expand_path(rel, @root)
      raise UserError.new('That path is not allowed.', 403) unless full.start_with?(@root + File::SEPARATOR)
      # Follow symbolic links on whatever part already exists, and check it still sits inside the site.
      probe = full
      probe = File.dirname(probe) until File.exist?(probe) || probe == @root
      real = File.realpath(probe)
      raise UserError.new('That path is not allowed.', 403) unless real == @root || real.start_with?(@root + File::SEPARATOR)
      raise UserError.new('That file does not exist.', 404) if must_exist && !File.exist?(full)
      full
    end

    def rel(full)
      full.sub(@root + File::SEPARATOR, '').tr('\\', '/')
    end

    # ── reading and writing text ─────────────────────────────────────────────
    def read_text(rel_path)
      full = resolve(rel_path, must_exist: true)
      File.binread(full).force_encoding('UTF-8').sub(/\A﻿/, '')
    end

    def write_text(rel_path, text)
      @lock.synchronize do
        full = resolve(rel_path)
        backup(full) if File.exist?(full)
        FileUtils.mkdir_p(File.dirname(full))
        tmp = full + '.console-tmp'
        File.binwrite(tmp, text.to_s.encode('UTF-8'))
        File.rename(tmp, full)
      end
    end

    def delete_file(rel_path)
      @lock.synchronize do
        full = resolve(rel_path, must_exist: true)
        backup(full)
        File.delete(full)
      end
    end

    def backup(full)
      return unless File.file?(full)
      stamp = Time.now.strftime('%Y%m%d-%H%M%S')
      dest = File.join(@data_dir, 'backups', stamp, rel(full))
      FileUtils.mkdir_p(File.dirname(dest))
      FileUtils.cp(full, dest)
      prune_backups
    rescue StandardError
      nil
    end

    def prune_backups(keep = 60)
      dir = File.join(@data_dir, 'backups')
      return unless File.directory?(dir)
      stamps = Dir.children(dir).sort
      (stamps.size - keep).times { |i| FileUtils.rm_rf(File.join(dir, stamps[i])) } if stamps.size > keep
    end

    # ── YAML ─────────────────────────────────────────────────────────────────
    def load_yaml(text, label = 'file')
      data = YAML.safe_load(text, permitted_classes: [Date, Time, Symbol], aliases: true)
      jsonable(data)
    rescue Psych::SyntaxError => e
      line = e.respond_to?(:line) ? e.line : nil
      raise UserError.new("The YAML in #{label} has a mistake#{line ? " near line #{line}" : ''}: #{e.problem}", 422)
    rescue Psych::DisallowedClass, Psych::BadAlias => e
      raise UserError.new("The YAML in #{label} uses something not allowed: #{e.message}", 422)
    end

    def jsonable(obj)
      case obj
      when Date then obj.strftime('%Y-%m-%d')
      when Time then obj.strftime('%Y-%m-%d')
      when Hash then obj.each_with_object({}) { |(k, v), h| h[k.to_s] = jsonable(v) }
      when Array then obj.map { |v| jsonable(v) }
      when Symbol then obj.to_s
      else obj
      end
    end

    # The block of "# ..." lines at the top of a data file is kept when the file is re-saved.
    def header_comment(text)
      lines = []
      text.each_line do |l|
        if l.start_with?('#') || (l.strip.empty? && !lines.empty?)
          lines << l
        else
          break
        end
      end
      lines.pop while lines.last && lines.last.strip.empty?
      lines.join
    end

    def dump_yaml(obj, name = nil)
      out = Psych.dump(obj, line_width: -1).sub(/\A---\s*\n/, '')
      res = []
      out.each_line.with_index do |l, i|
        gap = (obj.is_a?(Array) && l.start_with?('- ')) ||
              (obj.is_a?(Hash) && l =~ /\A[A-Za-z_][\w-]*:/) ||
              (name == 'cv' && (l.start_with?('- title:') || l.start_with?('  - title:')))
        res << "\n" if i > 0 && gap && !res.last.strip.empty?
        res << l
      end
      res.join
    end

    def read_data(name)
      path = DATA_FILES[name] or raise UserError.new('Unknown data file.', 404)
      full = resolve(path)
      return { 'data' => nil, 'header' => '', 'exists' => false } unless File.exist?(full)
      text = read_text(path)
      { 'data' => load_yaml(text, path), 'header' => header_comment(text), 'exists' => true }
    end

    def write_data(name, data)
      path = DATA_FILES[name] or raise UserError.new('Unknown data file.', 404)
      full = resolve(path)
      header = File.exist?(full) ? header_comment(read_text(path)) : ''
      data = bump_cv_date(data) if name == 'cv'
      body = dump_yaml(data, name)
      text = (header.empty? ? '' : header.chomp + "\n\n") + body
      load_yaml(text, path) # make sure what we are about to save can be read back
      write_text(path, text)
    end

    def bump_cv_date(data)
      return data unless data.is_a?(Hash)
      data = data.dup
      data['updated'] = Date.today.strftime('%Y-%m-%d')
      data
    end

    # ── front matter ─────────────────────────────────────────────────────────
    FM_RE = /\A---[ \t]*\r?\n(.*?)(?:\r?\n)?^---[ \t]*\r?\n?(.*)\z/m

    def split_front_matter(text)
      if (m = FM_RE.match(text))
        [m[1], m[2]]
      else
        ['', text]
      end
    end

    NO_FRONT_EXT = %w[.yml .yaml .json .js .css .svg].freeze

    def read_doc(rel_path)
      text = read_text(rel_path)
      crlf = text.include?("\r\n")
      text = text.gsub("\r\n", "\n")
      full = resolve(rel_path)
      ext = File.extname(rel_path).downcase
      if NO_FRONT_EXT.include?(ext) || !text.start_with?("---")
        return { 'path' => rel_path, 'front_raw' => '', 'body' => text, 'front' => {}, 'has_front' => false, 'crlf' => crlf,
                 'mtime' => File.mtime(full).to_f, 'ext' => ext }
      end
      front, body = split_front_matter(text)
      parsed = front.strip.empty? ? {} : load_yaml(front, rel_path)
      parsed = {} unless parsed.is_a?(Hash)
      { 'path' => rel_path, 'front_raw' => front, 'body' => body, 'front' => parsed, 'has_front' => true,
        'crlf' => crlf, 'mtime' => File.mtime(full).to_f, 'ext' => ext }
    end

    def write_doc(rel_path, front_raw, body, expected_mtime = nil, has_front = true)
      full = resolve(rel_path)
      if expected_mtime && File.exist?(full) && (File.mtime(full).to_f - expected_mtime.to_f).abs > 0.5
        raise UserError.new('This file was changed somewhere else since you opened it. Reload it before saving so nothing is lost.', 409)
      end
      load_yaml(front_raw.to_s, 'the front matter') if has_front && !front_raw.to_s.strip.empty?
      load_yaml(body.to_s, rel_path) if !has_front && %w[.yml .yaml].include?(File.extname(rel_path).downcase)
      JSON.parse(body.to_s) if !has_front && File.extname(rel_path).downcase == '.json'
      crlf = File.exist?(full) && File.binread(full).include?("\r\n")
      front = front_raw.to_s.gsub("\r\n", "\n").rstrip
      text = if has_front
               "---\n#{front}\n---\n#{body.to_s.gsub("\r\n", "\n")}"
             else
               body.to_s.gsub("\r\n", "\n")
             end
      text = text.gsub("\n", "\r\n") if crlf
      write_text(rel_path, text)
      File.mtime(full).to_f
    end

    # Replace or add one top-level "key: value" line in a block of front matter, leaving
    # every other line (and its comments) exactly as it was.
    def patch_scalar(front, key, value)
      lines = front.split("\n", -1)
      idx = lines.index { |l| l =~ /\A#{Regexp.escape(key)}:(\s|\z)/ }
      new_line = "#{key}: #{value}"
      if idx
        j = idx + 1
        j += 1 while j < lines.size && (lines[j] =~ /\A[ \t]+\S/ || (lines[j].strip.empty? && (lines[(j + 1)..-1] || []).find { |l| !l.strip.empty? }.to_s =~ /\A[ \t]+\S/))
        lines[idx...j] = [new_line]
      else
        lines << new_line
      end
      lines.join("\n")
    end

    # ── listing documents ────────────────────────────────────────────────────
    def list_kind(kind)
      dir = KINDS[kind] or raise UserError.new('Unknown kind.', 404)
      full = File.join(@root, dir)
      return [] unless File.directory?(full)
      Dir.children(full).sort.select { |f| f =~ /\.(md|markdown|html)\z/ }.map do |f|
        rel_path = "#{dir}/#{f}"
        begin
          d = read_doc(rel_path)
          fm = d['front']
          slug = f.sub(/\.[^.]+\z/, '')
          { 'path' => rel_path, 'slug' => slug, 'title' => fm['title'] || slug, 'front' => fm, 'url' => url_for(kind, slug, fm),
            'mtime' => d['mtime'], 'error' => nil }
        rescue UserError => e
          { 'path' => rel_path, 'slug' => f.sub(/\.[^.]+\z/, ''), 'title' => f, 'front' => {}, 'url' => nil, 'mtime' => 0, 'error' => e.message }
        end
      end
    end

    def url_for(kind, slug, fm)
      return fm['permalink'] if fm['permalink'].to_s.start_with?('/')
      case kind
      when 'projects' then "/research/#{slug}/"
      when 'writing' then "/writing/#{slug}/"
      else "/#{slug}/"
      end
    end

    def slugify(str)
      str.to_s.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/\A-+|-+\z/, '')
    end

    # Every address the site already uses, so a new short link cannot take one by accident.
    def taken_urls(except_path = nil)
      urls = RESERVED_PATHS.map { |r| "/#{r}/" }
      KINDS.each_key do |kind|
        list_kind(kind).each do |d|
          next if d['path'] == except_path
          urls << d['url'] if d['url']
        end
      end
      Dir.children(@root).each do |f|
        full = File.join(@root, f)
        urls << "/#{f}/" if File.directory?(full) && !f.start_with?('_', '.') && Dir.glob(File.join(full, 'index.*')).any?
      end
      urls.map { |u| u.to_s.sub(/index\.html\z/, '') }
    end

    def new_doc(kind, slug, title, extra = {})
      dir = KINDS[kind] or raise UserError.new('Unknown kind.', 404)
      slug = slugify(slug)
      raise UserError.new('Please give it a short name made of letters, numbers and dashes.', 422) if slug.empty?
      rel_path = "#{dir}/#{slug}.md"
      raise UserError.new('Something with that name already exists.', 409) if File.exist?(resolve(rel_path))
      today = Date.today.strftime('%Y-%m-%d')
      title = title.to_s.strip
      title = slug.tr('-', ' ').capitalize if title.empty?
      q = ->(s) { JSON.generate(s.to_s) }
      front, body =
        case kind
        when 'projects'
          [<<~FM, "Write the page here. Use the headings you want, for example **What is this?** and **Why it matters**.\n"]
            title: #{q.call(title)}
            tagline: One line that says what it is
            summary: >-
              Two sentences for the cards on the home and Research pages.
            description: >-
              One or two sentences for Google and link previews (about 150 characters).
            status: In progress
            period: #{Date.today.year}
            order: 50
            updated: #{today}
          FM
        when 'writing'
          [<<~FM, "Write your piece here.\n"]
            title: #{q.call(title)}
            date: #{today}
            summary: >-
              One or two sentences that say what this piece argues. Shown in the list and on search results.
            description: >-
              About 150 characters for Google and link previews.
            tags: []
            published: false
          FM
        else
          raise UserError.new('Use the short links tool to create a short link.', 400)
        end
      write_text(rel_path, "---\n#{front.rstrip}\n---\n#{body}")
      rel_path
    end

    def validate_link_fields(f, existing_path = nil)
      path = f['path'].to_s.strip.gsub(%r{\A/+|/+\z}, '')
      segs = path.split('/')
      raise UserError.new('Please type the address people will use, for example survey or siwes/survey.', 422) if segs.empty?
      raise UserError.new('Use only lowercase letters, numbers and dashes in the address, with / between parts (up to three parts).', 422) unless segs.size <= 3 && segs.all? { |s| s =~ /\A[a-z0-9][a-z0-9-]*\z/ }
      url = "/#{path}/"
      if taken_urls(existing_path).include?(url) || RESERVED_PATHS.include?(segs.first) && segs.size == 1
        raise UserError.new("The address #{url} is already used by another page.", 409)
      end
      dest = f['destination'].to_s.strip
      raise UserError.new('The destination must start with https:// (or / for a page on this site).', 422) unless dest.start_with?('https://') || dest =~ %r{\A/(?!/)}
      [path, url, dest]
    end

    def create_link(f)
      path, url, dest = validate_link_fields(f)
      slug = path.tr('/', '-')
      rel_path = "_links/#{slug}.md"
      raise UserError.new('A short link with that address already exists.', 409) if File.exist?(resolve(rel_path))
      q = ->(s) { JSON.generate(s.to_s) }
      lines = []
      lines << "title: #{q.call(f['title'].to_s.empty? ? slug.tr('-', ' ').capitalize : f['title'])}"
      lines << "description: #{q.call(f['description'])}" unless f['description'].to_s.strip.empty?
      lines << "permalink: #{url}"
      lines << ''
      lines << '# Where this link sends people. Must start with https:// (or / for a page on this site).'
      lines << "destination: #{q.call(dest)}"
      lines << '# live = forwards people. paused = shows "not open yet". ended = shows "closed".'
      lines << 'status: live'
      lines << '# Optional dates (YYYY-MM-DD). The link opens and closes by itself on these days.'
      lines << "opens_on:#{f['opens_on'].to_s.strip.empty? ? '' : ' ' + f['opens_on'].to_s.strip}"
      lines << "ends_on:#{f['ends_on'].to_s.strip.empty? ? '' : ' ' + f['ends_on'].to_s.strip}"
      lines << '# What the destination is called ("Taking you to ...").'
      lines << "label: #{q.call(f['label'].to_s.empty? ? 'the link' : f['label'])}"
      lines << '# Where people can go instead, and what to call that link.'
      lines << "fallback_url: #{f['fallback_url'].to_s.empty? ? '/' : f['fallback_url']}"
      lines << "fallback_label: #{q.call(f['fallback_label'].to_s.empty? ? 'go to the home page' : f['fallback_label'])}"
      lines << '# When the link has closed: message (show a note) or forward (send them to fallback_url).'
      lines << "after_end: #{f['after_end'] == 'forward' ? 'forward' : 'message'}"
      lines << "ended_message: #{q.call(f['ended_message'].to_s.empty? ? 'Thank you for your interest. This link is no longer open.' : f['ended_message'])}"
      lines << "paused_message: #{q.call(f['paused_message'].to_s.empty? ? 'This link is not open yet. Please check back soon.' : f['paused_message'])}"
      if f['image_path'].to_s.start_with?('/')
        lines << 'image:'
        lines << "  path: #{f['image_path']}"
        lines << "  width: #{f['image_width'].to_i}" if f['image_width'].to_i > 0
        lines << "  height: #{f['image_height'].to_i}" if f['image_height'].to_i > 0
        lines << "  alt: #{q.call(f['image_alt'])}" unless f['image_alt'].to_s.strip.empty?
      end
      body = f['explainer'].to_s.strip.empty? ? '' : f['explainer'].to_s.strip + "\n"
      write_text(rel_path, "---\n#{lines.join("\n")}\n---\n#{body}")
      rel_path
    end

    # ── site settings ────────────────────────────────────────────────────────
    CONFIG_KEYS = %w[title tagline author email url lang].freeze

    def read_config
      text = read_text('_config.yml')
      data = load_yaml(text, '_config.yml') || {}
      desc = data['description'].to_s.strip
      out = CONFIG_KEYS.each_with_object({}) { |k, h| h[k] = data[k].to_s }
      out['description'] = desc
      out['nav'] = data['nav'] || []
      out['twitter'] = data['twitter'] || {}
      out
    end

    def write_config(patch)
      text = read_text('_config.yml').gsub("\r\n", "\n")
      q = ->(s) { JSON.generate(s.to_s) }
      CONFIG_KEYS.each do |k|
        next unless patch.key?(k)
        v = patch[k].to_s.strip
        raise UserError.new('The web address must start with https://', 422) if k == 'url' && !v.start_with?('https://')
        raise UserError.new('That does not look like an email address.', 422) if k == 'email' && v !~ /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/
        text = patch_scalar(text, k, q.call(v))
      end
      if patch.key?('description')
        v = patch['description'].to_s.strip.gsub(/\s+/, ' ')
        folded = wrap_folded(v)
        text = patch_scalar(text, 'description', ">-\n#{folded}")
      end
      if patch.key?('nav')
        items = patch['nav']
        raise UserError.new('The menu must be a list.', 422) unless items.is_a?(Array)
        block = +"nav:\n"
        items.each do |it|
          label = it['label'].to_s.strip
          url = it['url'].to_s.strip
          next if label.empty? || url.empty?
          block << "  - label: #{q.call(label)}\n    url: #{url.start_with?('http') || url.start_with?('/') ? url : '/' + url}\n"
          block << "    collection: #{it['collection']}\n" unless it['collection'].to_s.strip.empty?
          block << "    data: #{it['data']}\n" unless it['data'].to_s.strip.empty?
          block << "    external: true\n" if it['external']
        end
        text = replace_block(text, 'nav', block)
      end
      load_yaml(text, '_config.yml')
      write_text('_config.yml', text)
    end

    def wrap_folded(str, width = 78)
      words = str.split(' ')
      lines = []
      cur = +''
      words.each do |w|
        if cur.empty?
          cur = w.dup
        elsif cur.size + 1 + w.size <= width
          cur << ' ' << w
        else
          lines << cur
          cur = w.dup
        end
      end
      lines << cur unless cur.empty?
      lines.map { |l| "  #{l}" }.join("\n")
    end

    # Replace a whole top-level block ("nav:" and its indented lines) with new text.
    def replace_block(text, key, block)
      lines = text.split("\n", -1)
      i = lines.index { |l| l =~ /\A#{Regexp.escape(key)}:(\s|\z)/ }
      if i
        j = i + 1
        j += 1 while j < lines.size && lines[j] =~ /\A[ \t]/
        lines[i...j] = block.chomp.split("\n")
        lines.join("\n")
      else
        text.rstrip + "\n\n" + block
      end
    end

    # ── media ────────────────────────────────────────────────────────────────
    def image_size(full)
      ext = File.extname(full).downcase
      File.open(full, 'rb') do |f|
        case ext
        when '.png'
          head = f.read(24)
          return nil unless head && head[0, 8] == "\x89PNG\r\n\x1a\n".b
          head[16, 8].unpack('NN')
        when '.jpg', '.jpeg'
          f.read(2)
          loop do
            marker = f.read(2)
            return nil if marker.nil? || marker.bytesize < 2
            return nil unless marker.getbyte(0) == 0xFF
            code = marker.getbyte(1)
            len = f.read(2).unpack1('n')
            if (0xC0..0xCF).cover?(code) && ![0xC4, 0xC8, 0xCC].include?(code)
              f.read(1)
              h, w = f.read(4).unpack('nn')
              return [w, h]
            end
            f.seek(len - 2, IO::SEEK_CUR)
          end
        when '.gif'
          head = f.read(10)
          return nil unless head && head.start_with?('GIF8')
          head[6, 4].unpack('vv')
        when '.svg'
          txt = f.read(4096).to_s.force_encoding('UTF-8')
          if (m = txt.match(/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/))
            [m[1].to_f.round, m[2].to_f.round]
          elsif (w = txt[/\swidth="([\d.]+)/, 1]) && (h = txt[/\sheight="([\d.]+)/, 1])
            [w.to_f.round, h.to_f.round]
          end
        end
      end
    rescue StandardError
      nil
    end

    def list_media
      base = File.join(@root, 'assets', 'images')
      return [] unless File.directory?(base)
      Dir.glob(File.join(base, '**', '*')).select { |f| File.file?(f) && IMAGE_EXT.include?(File.extname(f).downcase) }.sort.map do |f|
        size = image_size(f)
        { 'path' => '/' + rel(f), 'name' => File.basename(f), 'bytes' => File.size(f), 'width' => size && size[0], 'height' => size && size[1],
          'mtime' => File.mtime(f).to_f }
      end
    end

    def save_media(name, bytes, folder = 'assets/images')
      name = File.basename(name.to_s.tr('\\', '/'))
      ext = File.extname(name).downcase
      raise UserError.new('Only picture files can be added here (png, jpg, gif, webp, svg).', 422) unless IMAGE_EXT.include?(ext) && ext != '.ico'
      stem = slugify(File.basename(name, '.*'))
      raise UserError.new('Please rename the file with letters or numbers in its name.', 422) if stem.empty?
      folder = folder.to_s.sub(%r{\A/+}, '')
      raise UserError.new('Pictures go in assets/images.', 422) unless folder == 'assets/images' || folder.start_with?('assets/images/')
      rel_path = "#{folder}/#{stem}#{ext}"
      full = resolve(rel_path)
      raise UserError.new("A file called #{stem}#{ext} is already there. Rename yours or delete the old one first.", 409) if File.exist?(full)
      raise UserError.new('That file is empty.', 422) if bytes.to_s.empty?
      if ext == '.svg' && bytes =~ /<script|onload\s*=|javascript:/i
        raise UserError.new('That SVG contains scripts, so it was not added.', 422)
      end
      FileUtils.mkdir_p(File.dirname(full))
      File.binwrite(full, bytes)
      '/' + rel_path
    end

    def references(web_path)
      needle = web_path.to_s
      hits = []
      scan_files.each do |f|
        next if f == web_path.sub(%r{\A/}, '')
        text = File.binread(File.join(@root, f)).force_encoding('UTF-8')
        hits << f if text.include?(needle)
      end
      hits
    end

    def scan_files
      out = []
      Dir.glob(File.join(@root, '**', '*'), File::FNM_DOTMATCH).each do |full|
        next unless File.file?(full)
        r = rel(full)
        first = r.split('/').first
        next if BLOCKED_DIRS.include?(first) || r.split('/').include?('.git')
        next unless TEXT_EXT.include?(File.extname(r).downcase)
        out << r
      end
      out
    end

    def editable_files
      scan_files.reject { |f| f =~ %r{\Aassets/fonts/} || f =~ %r{\Aassets/files/} }.sort
    end

    # ── the optional browser version of the console ──────────────────────────
    WEB_CONSOLE_FILE = '_data/console.yml'

    # How "Publish" behaves on this computer: straight to the live branch, or as a pull request.
    # Kept in .console-data (never committed), so it is a choice about this computer only.
    def publish_mode
      f = File.join(@data_dir, 'publish_mode')
      File.exist?(f) && File.read(f).strip == 'pull_request' ? 'pull_request' : 'direct'
    end

    def set_publish_mode(mode)
      FileUtils.mkdir_p(@data_dir)
      File.write(File.join(@data_dir, 'publish_mode'), mode == 'pull_request' ? 'pull_request' : 'direct')
    end

    def web_console_enabled?
      return false unless File.exist?(resolve(WEB_CONSOLE_FILE))
      (load_yaml(read_text(WEB_CONSOLE_FILE), WEB_CONSOLE_FILE) || {})['web_console'] == true
    end

    def set_web_console(on)
      write_text(WEB_CONSOLE_FILE, "# Turns the browser version of the console (/manage/) on or off on the live site.\n# Change it from the console on your computer (Settings), then publish.\nweb_console: #{on ? 'true' : 'false'}\n")
    end

    # ── small stored state (checklist ticks and similar) ─────────────────────
    def state
      path = File.join(@data_dir, 'state.json')
      File.exist?(path) ? JSON.parse(File.read(path)) : {}
    rescue StandardError
      {}
    end

    def save_state(obj)
      FileUtils.mkdir_p(@data_dir)
      File.write(File.join(@data_dir, 'state.json'), JSON.pretty_generate(obj))
    end
  end
end
