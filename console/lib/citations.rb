# Turns [@key] citations in your writing into APA in-text citations and a reference list.
#
# The sources live in _data/references.yml. Writing uses a small, Pandoc-style syntax:
#   [@kloot2020]                  -> (Kloot, 2020)
#   [@kloot2020, p. 4]            -> (Kloot, 2020, p. 4)
#   [@kloot2020; @jansen2021]     -> (Jansen, 2021; Kloot, 2020)
#   [see @kloot2020, ch. 2]       -> (see Kloot, 2020, ch. 2)
#   [-@kloot2020]                 -> (2020)          (author already named in the sentence)
#   [!@kloot2020]                 -> Kloot (2020)    (narrative: author is part of the sentence)
#
# build(root) writes one small file per piece into _data/cite/. The page layout reads it and swaps
# the markers for the formatted text and adds the reference list. Nothing here touches your writing.
require 'yaml'
require 'fileutils'
require 'cgi'
require 'date'

module Console
  module Citations
    KEY = '[A-Za-z0-9][A-Za-z0-9:\-]*'.freeze
    GROUP = /\[(?:[^\[\]\n]*?)(?<![\w])[-!]?@#{KEY}[^\[\]\n]*\]/
    ITEM = /\A\s*(?<prefix>[^@]*?)\s*(?<sup>-)?@(?<key>#{KEY})\s*(?:,\s*(?<loc>.*?))?\s*\z/m
    DOC_DIRS = %w[_writing _projects].freeze

    module_function

    def esc(s)
      CGI.escapeHTML(s.to_s)
    end

    # ── loading ──────────────────────────────────────────────────────────────
    # Your own references, plus (unless asked not to) your papers from _data/publications.yml, so
    # anything you have written can be cited with [@paper-id] without adding it twice. A reference
    # with the same name in references.yml wins over the paper.
    def load_refs(root, with_publications: true)
      own = read_list(File.join(root, '_data', 'references.yml')).select { |r| r.is_a?(Hash) && r['id'] }
      return own unless with_publications
      taken = own.map { |r| r['id'].to_s }
      pubs = read_list(File.join(root, '_data', 'publications.yml')).select { |p| p.is_a?(Hash) && p['id'] && !taken.include?(p['id'].to_s) }
      own + pubs.map { |p| from_publication(p) }
    end

    def read_list(path)
      return [] unless File.exist?(path)
      data = YAML.safe_load(File.read(path, encoding: 'UTF-8'), permitted_classes: [Date, Time], aliases: false)
      data.is_a?(Array) ? data : []
    rescue Psych::Exception
      []
    end

    # "Olunlade, J., Adeleke, K., & Ilori, O."  ->  [{family, given}, ...]
    def parse_pub_authors(text)
      s = text.to_s.strip.gsub(/,?\s*&\s*/, ', ')
      return [] if s.empty?
      s.split(/(?<=\.),\s+/).map(&:strip).reject(&:empty?).map do |piece|
        if piece.include?(',')
          fam, given = piece.split(',', 2)
          { 'family' => fam.strip, 'given' => given.to_s.strip }
        else
          { 'org' => piece.sub(/\.\z/, '') }
        end
      end
    end

    # A paper from publications.yml, written as a reference (same shape as references.yml)
    def from_publication(p)
      type = p['type'].to_s
      venue = p['venue'].to_s.strip
      details = p['details'].to_s.strip
      r = { 'id' => p['id'].to_s, 'authors' => parse_pub_authors(p['authors']), 'year' => p['year'].to_s.strip,
            'title' => p['title'].to_s.strip, 'doi' => p['doi'].to_s.strip, 'url' => p['url'].to_s.strip }
      case type
      when 'journal'
        r['type'] = 'article'
        r['container'] = venue
        if details =~ /\A(\d+)(?:\s*\((\d+)\))?\s*,\s*(.+)\z/
          r['volume'] = $1
          r['issue'] = $2.to_s
          r['pages'] = $3.strip
        end
      when 'chapter'
        r['type'] = 'chapter'
        r['container'] = venue
        r['pages'] = details if details =~ /\A[\w.]+\s*[-–]\s*[\w.]+\z/
      when 'report'
        r['type'] = 'report'
        r['publisher'] = venue
      when 'conference'
        if p['prefix'].to_s.strip.empty? && details.empty?
          r['type'] = 'conference'
          r['container'] = venue
        else
          r['type'] = 'other'
          r['container'] = venue
          r['publisher'] = details
        end
      else
        r['type'] = 'other'
        r['container'] = venue
      end
      r.reject { |_, v| v.nil? || v == '' || v == [] }
    end

    # ── names ────────────────────────────────────────────────────────────────
    def initials(given)
      given.to_s.split(/\s+/).reject(&:empty?).map do |part|
        if part =~ /\A(?:\p{L}\.)+\z/ then part.scan(/\p{L}\./).join(' ')
        elsif part.include?('-') then part.split('-').reject(&:empty?).map { |x| "#{x[0].upcase}." }.join('-')
        else "#{part[0].upcase}."
        end
      end.join(' ')
    end

    def org?(a)
      a['org'].to_s.strip != ''
    end
    def family(a)
      org?(a) ? a['org'].to_s.strip : a['family'].to_s.strip
    end

    def name_ref(a) # "Family, G. M."
      return family(a) if org?(a)
      i = initials(a['given'])
      i.empty? ? family(a) : "#{family(a)}, #{i}"
    end

    def name_edit(a) # "G. M. Family"
      return family(a) if org?(a)
      i = initials(a['given'])
      i.empty? ? family(a) : "#{i} #{family(a)}"
    end

    def author_list(list)
      names = list.map { |a| name_ref(a) }
      return '' if names.empty?
      return names[0] if names.size == 1
      return "#{names[0]}, & #{names[1]}" if names.size == 2
      if names.size > 20
        return names[0, 19].join(', ') + ', . . . ' + names.last
      end
      names[0..-2].join(', ') + ', & ' + names.last
    end

    def editor_list(list)
      names = list.map { |a| name_edit(a) }
      return names[0] if names.size == 1
      return "#{names[0]} & #{names[1]}" if names.size == 2
      names[0..-2].join(', ') + ', & ' + names.last
    end

    # ── small helpers ────────────────────────────────────────────────────────
    def authors(r)
      Array(r['authors']).select { |a| a.is_a?(Hash) && family(a) != '' }
    end
    def editors(r)
      Array(r['editors']).select { |a| a.is_a?(Hash) && family(a) != '' }
    end
    def year(r)
      r['year'].to_s.strip.empty? ? 'n.d.' : r['year'].to_s.strip
    end
    def dash(s)
      s.to_s.gsub(/\s*[-–—]+\s*/, '–')
    end

    def end_with_period(s)
      s = s.to_s.strip
      s.empty? || s =~ /[.?!]\z/ ? s : s + '.'
    end

    def link_for(r)
      d = r['doi'].to_s.strip.sub(%r{\Ahttps?://(dx\.)?doi\.org/}i, '').sub(/\Adoi:\s*/i, '')
      return "https://doi.org/#{d}" unless d.empty?
      u = r['url'].to_s.strip
      u.empty? ? nil : u
    end

    def link_html(r)
      l = link_for(r)
      l ? %(<a href="#{esc(l)}">#{esc(l)}</a>) : nil
    end

    def it(s)
      "<i>#{esc(s)}</i>"
    end
    ITALIC_TYPES = %w[book report thesis web].freeze

    # ── in-text label ────────────────────────────────────────────────────────
    def short_title(r)
      words = r['title'].to_s.split(/\s+/)
      t = words.first(4).join(' ')
      t += '…' if words.size > 4
      t.sub(/[.,:;]\z/, '')
    end

    def label(r, narrative: false)
      a = authors(r)
      joiner = narrative ? ' and ' : ' &amp; '
      case a.size
      when 0 then ITALIC_TYPES.include?(r['type'].to_s) ? it(short_title(r)) : "&ldquo;#{esc(short_title(r))}&rdquo;"
      when 1 then esc(family(a[0]))
      when 2 then esc(family(a[0])) + joiner + esc(family(a[1]))
      else esc(family(a[0])) + ' et al.'
      end
    end

    def label_key(r)
      [label(r), r['year'].to_s.strip]
    end

    # a/b suffixes when two works share the same in-text label and year
    def suffixes(refs_used)
      groups = refs_used.group_by { |r| label_key(r) }
      out = {}
      groups.each_value do |g|
        next if g.size < 2
        g.sort_by { |r| sort_key(r) }.each_with_index { |r, i| out[r['id']] = ('a'.ord + i).chr }
      end
      out
    end

    def plain(s)
      s.to_s.downcase.unicode_normalize(:nfd).gsub(/\p{Mn}/, '')
    end

    def strip_article(t)
      plain(t).sub(/\A(a|an|the)\s+/, '')
    end

    def sort_key(r)
      a = authors(r)
      names = a.empty? ? [strip_article(r['title'])] : a.map { |x| [plain(family(x)), plain(x['given'])] }.flatten
      [names.join(' '), r['year'].to_s.rjust(6, '0'), strip_article(r['title'])]
    end

    # ── the reference list entry (APA 7) ─────────────────────────────────────
    def reference(r, suffix = '')
      type = r['type'].to_s
      a = authors(r)
      date = "(#{year(r)}#{suffix})."
      title = r['title'].to_s.strip
      lead = a.empty? ? nil : esc(author_list(a))
      lead = lead.sub(/\.\z/, '') + '.' if lead && lead !~ /\.\z/
      link = link_html(r)

      main =
        case type
        when 'article'
          src = []
          src << it(r['container']) if r['container'].to_s.strip != ''
          vol = r['volume'].to_s.strip
          if vol != ''
            v = "<i>#{esc(vol)}</i>"
            v += "(#{esc(r['issue'].to_s.strip)})" if r['issue'].to_s.strip != ''
            src << v
          end
          src << esc(dash(r['pages'])) if r['pages'].to_s.strip != ''
          [end_with_period(esc(title)), src.empty? ? nil : end_with_period(src.join(', '))]
        when 'chapter'
          eds = editors(r)
          book = 'In '
          book += esc(editor_list(eds)) + (eds.size > 1 ? ' (Eds.), ' : ' (Ed.), ') unless eds.empty?
          book += it(r['container'].to_s)
          extra = []
          extra << "#{esc(r['edition'])} ed." if r['edition'].to_s.strip != ''
          extra << "pp. #{esc(dash(r['pages']))}" if r['pages'].to_s.strip != ''
          book += " (#{extra.join(', ')})" unless extra.empty?
          [end_with_period(esc(title)), end_with_period(book), r['publisher'].to_s.strip != '' ? end_with_period(esc(r['publisher'])) : nil]
        when 'thesis'
          kind = r['genre'].to_s.strip.empty? ? 'Doctoral dissertation' : r['genre'].to_s.strip
          inst = r['publisher'].to_s.strip
          [it(title) + " [#{esc(kind)}#{inst.empty? ? '' : ', ' + esc(inst)}]."]
        when 'book'
          t = it(title)
          t += " (#{esc(r['edition'])} ed.)" if r['edition'].to_s.strip != ''
          [end_with_period(t), r['publisher'].to_s.strip != '' ? end_with_period(esc(r['publisher'])) : nil]
        when 'report'
          t = it(title)
          t += " (#{esc(r['number'])})" if r['number'].to_s.strip != ''
          [end_with_period(t), r['publisher'].to_s.strip != '' ? end_with_period(esc(r['publisher'])) : nil]
        when 'web'
          [end_with_period(it(title)), r['container'].to_s.strip != '' ? end_with_period(esc(r['container'])) : nil]
        when 'conference'
          src = []
          src << 'In ' + it(r['container']) if r['container'].to_s.strip != ''
          pages = r['pages'].to_s.strip
          src[0] = src[0] + " (pp. #{esc(dash(pages))})" if !src.empty? && pages != ''
          [end_with_period(esc(title)), src.empty? ? nil : end_with_period(src.join), r['publisher'].to_s.strip != '' ? end_with_period(esc(r['publisher'])) : nil]
        else
          [end_with_period(esc(title)), r['container'].to_s.strip != '' ? end_with_period(it(r['container'])) : nil, r['publisher'].to_s.strip != '' ? end_with_period(esc(r['publisher'])) : nil]
        end
      main = main.compact

      s =
        if lead
          ([lead, date] + main).join(' ')
        else
          # no author: the title takes the author's place
          head = main.shift.to_s
          ([head, date] + main).join(' ')
        end
      s += ' ' + link if link
      s
    end

    # ── in-text citations ────────────────────────────────────────────────────
    # Turns the text inside one [...] marker into HTML. Returns [html, unknown_keys].
    def format_group(inner, refs_by_id, suffix_of)
      narrative = inner.lstrip.start_with?('!')
      inner = inner.sub(/\A\s*!/, '') if narrative
      unknown = []
      items = inner.split(';').map do |raw|
        m = ITEM.match(raw)
        next nil unless m
        key = m[:key]
        ref = refs_by_id[key]
        unless ref
          unknown << key
          next { missing: key, raw: raw }
        end
        { ref: ref, prefix: m[:prefix].to_s.strip, suppress: !m[:sup].nil?, loc: m[:loc].to_s.strip }
      end.compact

      known = items.select { |i| i[:ref] }
      if known.empty? && !unknown.empty?
        return [%(<span class="cite-missing" title="Not in your references">[?#{esc(unknown.join(', '))}]</span>), unknown]
      end

      if narrative
        parts = known.map do |i|
          y = year_text(i[:ref], suffix_of)
          y += ', ' + esc(loc_text(i[:loc])) unless i[:loc].empty?
          link = %(<a href="#ref-#{esc(i[:ref]['id'])}">#{y}</a>)
          "#{label(i[:ref], narrative: true)} (#{link})"
        end
        parts += unknown.map { |k| %(<span class="cite-missing">[?#{esc(k)}]</span>) }
        return [%(<span class="cite">#{parts.join('; ')}</span>), unknown]
      end

      known.sort_by! { |i| [plain(label(i[:ref]).gsub(/<[^>]+>/, '')), i[:ref]['year'].to_s, suffix_of[i[:ref]['id']].to_s] } if known.size > 1 && known.none? { |i| i[:prefix] != '' }
      pieces = []
      idx = 0
      while idx < known.size
        i = known[idx]
        lbl = label(i[:ref])
        run = [i]
        # same author, no locators or prefixes: Smith, 2019, 2020
        while !i[:suppress] && idx + run.size < known.size
          n = known[idx + run.size]
          break unless label(n[:ref]) == lbl && n[:loc].empty? && i[:loc].empty? && n[:prefix].empty? && i[:prefix].empty? && !n[:suppress]
          run << n
        end
        pre = i[:prefix].empty? ? '' : esc(i[:prefix]) + ' '
        if run.size > 1
          yrs = run.map { |x| %(<a href="#ref-#{esc(x[:ref]['id'])}">#{year_text(x[:ref], suffix_of)}</a>) }
          pieces << "#{pre}#{lbl}, #{yrs.join(', ')}"
        else
          text = i[:suppress] ? year_text(i[:ref], suffix_of) : "#{lbl}, #{year_text(i[:ref], suffix_of)}"
          text += ', ' + esc(loc_text(i[:loc])) unless i[:loc].empty?
          pieces << %(#{pre}<a href="#ref-#{esc(i[:ref]['id'])}">#{text}</a>)
        end
        idx += run.size
      end
      pieces += unknown.map { |k| %(<span class="cite-missing">[?#{esc(k)}]</span>) }
      [%(<span class="cite">(#{pieces.join('; ')})</span>), unknown]
    end

    def year_text(r, suffix_of)
      esc(year(r)) + suffix_of[r['id']].to_s
    end
    def loc_text(l)
      l.to_s.gsub(/(\d)\s*[-–—]+\s*(\d)/, '\1–\2')
    end

    # ── one document ─────────────────────────────────────────────────────────
    def strip_code(md)
      md.gsub(/^(```|~~~).*?^\1[ \t]*$/m, '').gsub(/`[^`\n]*`/, '')
    end

    def source_variants(src)
      # what Jekyll's Markdown turns the marker into (ampersands, curly quotes, dashes)
      v = [src]
      html = src.gsub('&', '&amp;')
      html2 = html.gsub(/"(\S[^"]*?)"/, "“\\1”").gsub("'", "’")
      html3 = html2.gsub(/(?<=\s)--(?=\s)/, "–").gsub('---', "—").gsub('--', "–")
      [html, html2, html3].each { |x| v << x unless v.include?(x) }
      v
    end

    def build_doc(refs, markdown)
      by_id = refs.each_with_object({}) { |r, h| h[r['id'].to_s] = r }
      text = strip_code(markdown)
      found = []
      text.scan(GROUP) do
        m = Regexp.last_match
        after = text[m.end(0), 1]
        next if after == '(' || after == '['
        found << m[0]
      end
      found.uniq!
      used_ids = []
      parsed = found.map do |src|
        inner = src[1..-2]
        ids = inner.split(';').map { |x| (ITEM.match(x) || {})[:key] }.compact
        used_ids.concat(ids.select { |k| by_id[k] })
        [src, inner]
      end
      used_ids.uniq!
      used = used_ids.map { |k| by_id[k] }
      suffix_of = suffixes(used)
      pairs = []
      unknown = []
      parsed.each do |src, inner|
        html, unk = format_group(inner, by_id, suffix_of)
        unknown.concat(unk)
        source_variants(src).each { |v| pairs << { 'src' => v, 'html' => html } }
      end
      sorted = used.sort_by { |r| sort_key(r) }
      list = sorted.map { |r| %(<li id="ref-#{esc(r['id'])}">#{reference(r, suffix_of[r['id']].to_s)}</li>) }
      refs_html = list.empty? ? '' : %(<section class="bibliography" id="references"><h2>References</h2><ul class="ref-list">#{list.join}</ul></section>)
      { 'pairs' => pairs, 'references' => refs_html, 'count' => used.size, 'unknown' => unknown.uniq }
    end

    # ── all documents ────────────────────────────────────────────────────────
    def body_of(text)
      text = text.sub(/\A﻿/, '').gsub("\r\n", "\n")
      return text unless text.start_with?("---\n")
      i = text.index("\n---", 3)
      i ? text[(i + 4)..-1].to_s : text
    end

    def slug_of(file)
      File.basename(file, '.*').sub(/\A\d{4}-\d{2}-\d{2}-/, '')
    end

    def build(root)
      refs = load_refs(root)
      out_dir = File.join(root, '_data', 'cite')
      Dir.glob(File.join(out_dir, '*.yml')).each { |f| File.delete(f) }
      FileUtils.mkdir_p(out_dir)
      keep = File.join(out_dir, '.gitignore')
      File.write(keep, "# Made by scripts/citations.rb each time, so it is not kept in Git.\n*\n!.gitignore\n") unless File.exist?(keep)
      report = { 'pieces' => 0, 'unknown' => {} }
      DOC_DIRS.each do |dir|
        Dir.glob(File.join(root, dir, '*.{md,markdown}')).sort.each do |file|
          body = body_of(File.read(file, encoding: 'UTF-8'))
          next unless body =~ GROUP
          res = build_doc(refs, body)
          next if res['pairs'].empty?
          FileUtils.mkdir_p(out_dir)
          File.write(File.join(out_dir, slug_of(file) + '.yml'), "# Made by scripts/citations.rb. Safe to delete; it is rebuilt every time.\n" + YAML.dump(res.reject { |k, _| k == 'unknown' }))
          report['pieces'] += 1
          report['unknown'][File.join(dir, File.basename(file))] = res['unknown'] unless res['unknown'].empty?
        end
      end
      report
    end
  end
end
