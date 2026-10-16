# The console's routes: what each address does.
require_relative 'http'
require_relative 'store'
require_relative 'runner'
require_relative 'audit'

module Console
  class App
    UI_DIR = File.expand_path('../ui', __dir__)
    MIME = {
      '.html' => 'text/html; charset=utf-8', '.css' => 'text/css; charset=utf-8', '.js' => 'text/javascript; charset=utf-8',
      '.svg' => 'image/svg+xml', '.png' => 'image/png', '.jpg' => 'image/jpeg', '.jpeg' => 'image/jpeg', '.gif' => 'image/gif',
      '.webp' => 'image/webp', '.woff2' => 'font/woff2', '.json' => 'application/json', '.ico' => 'image/x-icon', '.txt' => 'text/plain; charset=utf-8'
    }.freeze

    attr_reader :token, :store, :runner
    attr_accessor :port

    def initialize(store, token)
      @store = store
      @runner = Runner.new(store)
      @token = token
      @last_audit = nil
      @port = nil
    end

    def call(req)
      return Response.text('Not allowed', 403) unless host_ok?(req)

      # First visit: the start-up address carries a one-time token that becomes a cookie.
      if req.path == '/' && req.query['t']
        return Response.text('Wrong token', 403) unless secure_eq(req.query['t'], @token)
        return Response.new(302, '', 'Location' => '/', 'Set-Cookie' => "console_token=#{@token}; Path=/; HttpOnly; SameSite=Strict")
      end
      return Response.text("Open the address printed in the terminal window (it ends with ?t=...).", 401) unless authed?(req)

      if req.path.start_with?('/api/')
        return Response.json({ error: 'Blocked.' }, 403) unless req.method == 'GET' || origin_ok?(req)
        return api(req)
      end
      return media_file(req) if req.path.start_with?('/media/')
      return site_font(req) if req.path.start_with?('/fonts/')
      return site_asset(req) if req.path.start_with?('/assets/')
      static_ui(req)
    rescue UserError => e
      Response.json({ error: e.message }, e.status)
    rescue JSON::ParserError
      Response.json({ error: 'That request could not be read.' }, 400)
    end

    private

    def host_ok?(req)
      ok = ["127.0.0.1:#{@port}", "localhost:#{@port}", "[::1]:#{@port}"]
      ok.include?(req.host)
    end

    def origin_ok?(req)
      origin = req.headers['origin']
      return false unless req.headers['x-console'] == '1'
      origin.nil? || ["http://127.0.0.1:#{@port}", "http://localhost:#{@port}"].include?(origin)
    end

    def authed?(req)
      secure_eq(req.cookie('console_token').to_s, @token)
    end

    def secure_eq(a, b)
      a = a.to_s
      b = b.to_s
      return false unless a.bytesize == b.bytesize
      r = 0
      a.bytes.zip(b.bytes) { |x, y| r |= x ^ y }
      r.zero?
    end

    def static_ui(req)
      name = req.path == '/' ? 'index.html' : req.path.sub(%r{\A/}, '')
      full = File.expand_path(name, UI_DIR)
      return Response.text('Not found', 404) unless full.start_with?(UI_DIR + File::SEPARATOR) && File.file?(full)
      Response.new(200, File.binread(full), 'Content-Type' => MIME[File.extname(full).downcase] || 'application/octet-stream')
    end

    # The console reuses the site's own fonts so it feels like part of the same family.
    def site_font(req)
      name = File.basename(req.path)
      full = File.join(@store.root, 'assets', 'fonts', name)
      return Response.text('Not found', 404) unless name =~ /\A[\w.-]+\.woff2\z/ && File.file?(full)
      Response.new(200, File.binread(full), 'Content-Type' => 'font/woff2')
    end

    # The preview-card stylesheet and the fonts it names, so the console can draw a live card.
    def site_asset(req)
      rel = req.path.sub(%r{\A/}, '')
      return Response.text('Not found', 404) unless rel == 'assets/css/og-card.css' || rel =~ %r{\Aassets/fonts/[\w.-]+\.woff2\z}
      full = @store.resolve(rel)
      return Response.text('Not found', 404) unless File.file?(full)
      type = rel.end_with?('.css') ? 'text/css; charset=utf-8' : 'font/woff2'
      Response.new(200, File.binread(full), 'Content-Type' => type)
    end

    def media_file(req)
      rel = req.path.sub(%r{\A/media/}, '')
      return Response.text('Not found', 404) unless rel.start_with?('assets/')
      full = @store.resolve(rel, must_exist: true)
      ext = File.extname(full).downcase
      return Response.text('Not found', 404) unless Store::IMAGE_EXT.include?(ext)
      Response.new(200, File.binread(full), 'Content-Type' => MIME[ext] || 'application/octet-stream',
                                           'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'")
    end

    def ok(extra = {})
      Response.json({ ok: true }.merge(extra))
    end

    def api(req)
      route = "#{req.method} #{req.path}"
      case route
      when 'GET /api/state' then state
      when 'GET /api/list' then Response.json('items' => @store.list_kind(req.query['kind']))
      when 'GET /api/doc'
        Response.json(@store.read_doc(req.query['path']).merge('url' => doc_url(req.query['path'])))
      when 'PUT /api/doc'
        j = req.json
        check_doc_path(j['path'])
        mtime = @store.write_doc(j['path'], j['front_raw'], j['body'], j['mtime'], j.fetch('has_front', true))
        @runner.refresh_citations
        ok('mtime' => mtime)
      when 'POST /api/doc/create'
        j = req.json
        if j['kind'] == 'links'
          path = @store.create_link(j)
        else
          path = @store.new_doc(j['kind'], j['slug'] || j['title'], j['title'])
        end
        ok('path' => path)
      when 'POST /api/doc/delete'
        check_doc_path(req.json['path'])
        @store.delete_file(req.json['path'])
        @runner.refresh_citations
        ok
      when 'POST /api/link/action' then link_action(req.json)
      when 'POST /api/link/check' then link_check(req.json)
      when 'POST /api/yaml/parse'
        begin
          Response.json('ok' => true, 'data' => @store.load_yaml(req.json['text'].to_s, 'the front matter'))
        rescue UserError => e
          Response.json('ok' => false, 'error' => e.message)
        end
      when 'GET /api/data' then Response.json(@store.read_data(req.query['name']))
      when 'PUT /api/data'
        @store.write_data(req.query['name'], req.json['data'])
        @runner.refresh_citations if req.query['name'] == 'references'
        ok
      when 'POST /api/refs/doi'
        Response.json(@runner.doi_lookup(req.json['doi']))
      when 'GET /api/config' then Response.json(@store.read_config)
      when 'PUT /api/config'
        @store.write_config(req.json)
        ok
      when 'GET /api/media' then Response.json('items' => @store.list_media)
      when 'PUT /api/media'
        path = @store.save_media(req.query['name'], req.body, req.query['folder'] || 'assets/images')
        size = @store.image_size(@store.resolve(path.sub(%r{\A/}, '')))
        ok('path' => path, 'width' => size && size[0], 'height' => size && size[1])
      when 'POST /api/media/delete'
        path = req.json['path'].to_s.sub(%r{\A/}, '')
        raise UserError.new('Only pictures in assets/images can be deleted here.', 403) unless path.start_with?('assets/images/')
        @store.delete_file(path)
        ok
      when 'GET /api/media/refs' then Response.json('refs' => @store.references(req.query['path']))
      when 'GET /api/files' then Response.json('files' => @store.editable_files)
      when 'GET /api/preview' then Response.json(@runner.preview_status)
      when 'POST /api/preview/start' then Response.json(@runner.start_preview)
      when 'POST /api/preview/stop' then Response.json(@runner.stop_preview)
      when 'POST /api/check' then Response.json('issues' => Audit.check_source(@store))
      when 'POST /api/audit' then audit
      when 'GET /api/audit/last' then Response.json(@last_audit || { 'issues' => [], 'counts' => nil })
      when 'GET /api/built'
        f = File.join(@runner.audit_dir, req.query['name'].to_s.gsub('..', ''))
        Response.json('text' => File.file?(f) ? File.read(f).force_encoding('UTF-8') : nil)
      when 'GET /api/git' then Response.json(@runner.git_status)
      when 'POST /api/git/publish'
        errs = Audit.check_source(@store).select { |i| i['level'] == 'error' }
        unless errs.empty? || req.json['force']
          return Response.json({ ok: false, blocked: true, issues: errs }, 200)
        end
        Response.json(@runner.publish(req.json['message']))
      when 'POST /api/git/pull' then Response.json(@runner.pull)
      when 'GET /api/indexnow' then Response.json('key' => @runner.indexnow_key)
      when 'POST /api/indexnow/setup' then ok('key' => @runner.indexnow_setup)
      when 'POST /api/indexnow/submit' then indexnow_submit(req.json)
      when 'GET /api/publishmode' then Response.json('mode' => @store.publish_mode)
      when 'PUT /api/publishmode'
        m = req.json['mode'].to_s
        raise UserError.new('Unknown mode.', 422) unless %w[direct pull_request].include?(m)
        @store.set_publish_mode(m)
        Response.json('mode' => @store.publish_mode)
      when 'GET /api/webconsole' then Response.json('enabled' => @store.web_console_enabled?)
      when 'PUT /api/webconsole'
        @store.set_web_console(req.json['enabled'] == true)
        ok
      when 'GET /api/checklist' then Response.json(@store.state['checklist'] || {})
      when 'PUT /api/checklist'
        s = @store.state
        s['checklist'] = req.json['checklist'] || {}
        @store.save_state(s)
        ok
      when 'POST /api/quit'
        Thread.new { sleep 0.4; @runner.stop_preview; exit!(0) }
        ok
      else
        Response.json({ error: 'Not found' }, 404)
      end
    end

    def check_doc_path(path)
      path = path.to_s
      raise UserError.new('Only text files can be edited here.', 403) unless Store::TEXT_EXT.include?(File.extname(path).downcase)
      @store.resolve(path)
    end

    def doc_url(path)
      kind = Store::KINDS.find { |_, dir| path.to_s.start_with?(dir + '/') }
      return nil unless kind
      slug = File.basename(path, '.*')
      fm = (@store.read_doc(path)['front'] rescue {})
      @store.url_for(kind[0], slug, fm)
    end

    def state
      cfg = @store.read_config
      counts = {}
      Store::KINDS.each_key { |k| counts[k] = @store.list_kind(k).size }
      pubs = (@store.read_data('publications')['data'] rescue nil) || []
      counts['publications'] = pubs.size
      Response.json('site' => { 'title' => cfg['title'], 'url' => cfg['url'], 'email' => cfg['email'], 'root' => @store.root },
                    'counts' => counts, 'preview' => @runner.preview_status, 'git' => @runner.git_status, 'port' => @port,
                    'windows' => Console.windows?, 'last_audit' => @last_audit && @last_audit['counts'], 'indexnow' => @runner.indexnow_key)
    end

    def audit
      source = Audit.check_source(@store)
      build = @runner.build_for_audit
      unless build['ok']
        return Response.json('build' => build, 'issues' => source, 'counts' => nil)
      end
      res = Audit.new(@store, @runner.audit_dir).run
      res['issues'] = source + res['issues']
      %w[error warn info].each { |l| res['counts'][l] = res['issues'].count { |i| i['level'] == l } }
      res['build'] = { 'ok' => true, 'output' => build['output'] }
      @last_audit = res
      Response.json(res)
    end

    def indexnow_submit(j)
      cfg = @store.read_config
      host = cfg['url'].sub(%r{\Ahttps://}, '').sub(%r{/.*}, '')
      urls = Array(j['urls']).map(&:to_s).select { |u| u.start_with?("https://#{host}/") }.first(200)
      raise UserError.new('There are no addresses to send.', 422) if urls.empty?
      Response.json(@runner.indexnow_submit(host, urls))
    end

    def link_action(j)
      path = j['path'].to_s
      raise UserError.new('That is not a short link file.', 400) unless path =~ %r{\A_links/[\w.-]+\.md\z}
      doc = @store.read_doc(path)
      front = doc['front_raw']
      case j['action']
      when 'pause' then front = @store.patch_scalar(front, 'status', 'paused')
      when 'resume' then front = @store.patch_scalar(front, 'status', 'live')
      when 'end' then front = @store.patch_scalar(front, 'status', 'ended')
      when 'set'
        raise UserError.new('Unknown field.', 400) unless %w[destination opens_on ends_on after_end fallback_url fallback_label label ended_message paused_message].include?(j['key'])
        v = j['value'].to_s
        formatted = %w[opens_on ends_on].include?(j['key']) ? v : JSON.generate(v)
        front = @store.patch_scalar(front, j['key'], formatted)
      else raise UserError.new('Unknown action.', 400)
      end
      @store.write_doc(path, front, doc['body'])
      ok
    end

    # Does the destination answer? (Run from this computer, so the answer is what you would see.)
    def link_check(j)
      url = j['url'].to_s
      raise UserError.new('Only https:// addresses can be checked.', 422) unless url.start_with?('https://')
      uri = URI(url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 8
      http.read_timeout = 10
      res = http.get(uri.request_uri.empty? ? '/' : uri.request_uri, 'User-Agent' => 'site-console-link-check')
      Response.json('status' => res.code.to_i, 'ok' => res.code.to_i < 400, 'location' => res['location'])
    rescue StandardError => e
      Response.json('status' => 0, 'ok' => false, 'error' => e.message[0, 200])
    end
  end
end
