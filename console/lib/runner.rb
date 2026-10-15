# Runs Jekyll (build and live preview) and Git, always with a time limit and never
# through a shell, so file names with spaces or odd characters are safe.
require 'open3'
require 'timeout'
require 'shellwords'
require 'rbconfig'
require 'fileutils'
require 'net/http'
require 'socket'
require 'openssl'
require 'securerandom'

module Console
  def self.windows?
    RbConfig::CONFIG['host_os'] =~ /mswin|mingw|cygwin/i ? true : false
  end

  class Runner
    attr_reader :preview_port

    def initialize(store)
      @store = store
      @root = store.root
      @preview_pid = nil
      @preview_port = nil
      @preview_exit = nil
      @build_lock = Mutex.new
    end

    # ── Jekyll ───────────────────────────────────────────────────────────────
    def jekyll_cmd
      return Shellwords.split(ENV['CONSOLE_JEKYLL']) if ENV['CONSOLE_JEKYLL'].to_s.strip != ''
      File.exist?(File.join(@root, 'Gemfile')) ? %w[bundle exec jekyll] : %w[jekyll]
    end

    def run(cmd, env: {}, timeout: 120, chdir: @root)
      out = +''
      status = nil
      begin
        Timeout.timeout(timeout) do
          out, st = Open3.capture2e(env, *cmd, chdir: chdir)
          status = st
        end
      rescue Timeout::Error
        return { 'ok' => false, 'output' => "Stopped after #{timeout} seconds.\n#{out}", 'code' => nil }
      rescue Errno::ENOENT => e
        return { 'ok' => false, 'output' => "Could not start #{cmd.first}. Is it installed and on your PATH? (#{e.message})", 'code' => nil }
      end
      { 'ok' => status.success?, 'output' => out.force_encoding('UTF-8').scrub, 'code' => status.exitstatus }
    end

    def audit_dir
      File.join(@store.runtime_dir, 'audit-site')
    end

    def build_for_audit
      @build_lock.synchronize do
        FileUtils.rm_rf(audit_dir)
        FileUtils.mkdir_p(@store.runtime_dir)
        run(jekyll_cmd + ['build', '--destination', audit_dir], env: { 'JEKYLL_ENV' => 'production' }, timeout: 240)
      end
    end

    # ── live preview ─────────────────────────────────────────────────────────
    def log_path
      File.join(@store.runtime_dir, 'preview.log')
    end

    def preview_running?
      return false unless @preview_pid
      return false if @preview_exit
      true
    end

    def preview_status
      tail = File.exist?(log_path) ? File.read(log_path).force_encoding('UTF-8').scrub.lines.last(40).join : ''
      { 'running' => preview_running?, 'port' => preview_running? ? @preview_port : nil,
        'url' => preview_running? ? "http://127.0.0.1:#{@preview_port}/" : nil, 'log' => tail }
    end

    def free_port(start)
      (start..start + 20).each do |p|
        begin
          s = TCPServer.new('127.0.0.1', p)
          s.close
          return p
        rescue Errno::EADDRINUSE, Errno::EACCES
          next
        end
      end
      raise UserError.new('No free port was found for the preview.', 500)
    end

    def start_preview
      return preview_status if preview_running?
      FileUtils.mkdir_p(@store.runtime_dir)
      port = free_port(4000)
      live = free_port(35_729)
      cmd = jekyll_cmd + ['serve', '--host', '127.0.0.1', '--port', port.to_s,
                          '--destination', File.join(@store.runtime_dir, 'preview-site')]
      cmd += ['--livereload', '--livereload-port', live.to_s] unless ENV['CONSOLE_LIVERELOAD'] == '0'
      File.write(log_path, "$ #{cmd.join(' ')}\n")
      opts = { chdir: @root, out: [log_path, 'a'], err: [:child, :out] }
      opts[Console.windows? ? :new_pgroup : :pgroup] = true
      @preview_exit = nil
      @preview_port = port
      @preview_pid = Process.spawn({ 'JEKYLL_ENV' => 'development' }, *cmd, opts)
      pid = @preview_pid
      Thread.new do
        Process.wait(pid)
        @preview_exit = $?.exitstatus if @preview_pid == pid
      end
      wait_for_port(port, 45)
      preview_status
    rescue Errno::ENOENT => e
      @preview_pid = nil
      raise UserError.new("Could not start Jekyll. Is Ruby with Jekyll installed? (#{e.message})", 500)
    end

    def wait_for_port(port, seconds)
      deadline = Time.now + seconds
      while Time.now < deadline
        return true if @preview_exit
        begin
          TCPSocket.new('127.0.0.1', port).close
          return true
        rescue StandardError
          sleep 0.4
        end
      end
      false
    end

    def stop_preview
      pid = @preview_pid
      return preview_status unless pid
      begin
        if Console.windows?
          system('taskkill', '/PID', pid.to_s, '/T', '/F', out: File::NULL, err: File::NULL)
        else
          begin
            Process.kill('TERM', -pid)
          rescue Errno::ESRCH, Errno::EPERM
            Process.kill('TERM', pid)
          end
        end
      rescue Errno::ESRCH
        nil
      end
      @preview_pid = nil
      @preview_exit = 0
      preview_status
    end

    # ── Git ──────────────────────────────────────────────────────────────────
    def git(*args, timeout: 90)
      run(['git'] + args, env: { 'GIT_TERMINAL_PROMPT' => '0', 'GIT_PAGER' => 'cat', 'LC_ALL' => 'C' }, timeout: timeout)
    end

    def git_repo?
      File.exist?(File.join(@root, '.git')) && git('rev-parse', '--is-inside-work-tree')['ok']
    end

    # Writing pieces marked published: false that were never sent to GitHub. They stay on this
    # computer until you publish them, so nobody can read a draft in the public repository.
    def private_drafts
      tracked = git('ls-files', '_writing')['output'].lines.map(&:strip)
      Dir.glob(File.join(@root, '_writing', '*.{md,markdown,html}')).map { |f| f.sub(@root + File::SEPARATOR, '').tr('\\', '/') }.select do |rel|
        next false if tracked.include?(rel)
        head = File.read(File.join(@root, rel), encoding: 'UTF-8')[/\A---\s*\n(.*?)\n---/m, 1].to_s
        head =~ /^published:\s*false\s*(#.*)?$/
      end
    end

    def git_status
      return { 'repo' => false } unless git_repo?
      branch = git('rev-parse', '--abbrev-ref', 'HEAD')['output'].strip
      porcelain = git('status', '--porcelain', '-uall')['output']
      changes = porcelain.lines.map do |l|
        code = l[0, 2]
        path = l[3..-1].to_s.strip.sub(/\A"|"\z/, '')
        label = if code.include?('?') || code.include?('A') then 'new'
                elsif code.include?('D') then 'deleted'
                elsif code.include?('R') then 'renamed'
                else 'changed'
                end
        { 'code' => code.strip, 'path' => path, 'label' => label }
      end
      drafts = private_drafts
      kept_private = changes.select { |c| drafts.include?(c['path']) }
      changes -= kept_private
      remote = git('remote', 'get-url', 'origin')
      remote_url = remote['ok'] ? remote['output'].strip : nil
      ahead = behind = nil
      counts = git('rev-list', '--left-right', '--count', '@{u}...HEAD')
      if counts['ok']
        behind, ahead = counts['output'].split.map(&:to_i)
      end
      log = git('log', '-6', '--format=%h|%an|%ar|%s')['output'].lines.map do |l|
        h, a, w, s = l.strip.split('|', 4)
        { 'hash' => h, 'author' => a, 'when' => w, 'subject' => s }
      end
      { 'repo' => true, 'mode' => @store.publish_mode, 'branch' => branch, 'changes' => changes, 'remote' => remote_url, 'actions_url' => actions_url(remote_url),
        'ahead' => ahead, 'behind' => behind, 'log' => log, 'private_drafts' => kept_private.map { |c| c['path'] } }
    end

    def actions_url(remote)
      return nil unless remote
      if (m = remote.match(%r{github\.com[:/]+([^/]+)/([^/]+?)(?:\.git)?\z}))
        "https://github.com/#{m[1]}/#{m[2]}/actions"
      end
    end

    def publish(message)
      st = git_status
      raise UserError.new('This folder is not a Git repository, so there is nothing to publish to.', 422) unless st['repo']
      raise UserError.new('There is nothing new to publish.', 422) if st['changes'].empty?
      message = message.to_s.strip
      message = 'Update site' if message.empty?
      steps = []
      add = git('add', '-A', '--', '.', *private_drafts.map { |d| ":(exclude)#{d}" })
      steps << ['Stage changes', add]
      return { 'ok' => false, 'steps' => fmt(steps) } unless add['ok']
      commit = git('commit', '-m', message)
      steps << ['Save a version', commit]
      return { 'ok' => false, 'steps' => fmt(steps) } unless commit['ok']
      return publish_as_pull_request(steps) if @store.publish_mode == 'pull_request'
      push = git('push', timeout: 150)
      if !push['ok'] && push['output'] =~ /no upstream branch|has no upstream/
        branch = git('rev-parse', '--abbrev-ref', 'HEAD')['output'].strip
        push = git('push', '--set-upstream', 'origin', branch, timeout: 150)
      end
      steps << ['Send to GitHub', push]
      if !push['ok'] && push['output'] =~ /GH006|protected branch|Protected branch update failed/i
        push['output'] += "\n\nGitHub is protecting the live branch, so a direct send is refused. In Settings, choose \"Send changes as a pull request\" and publish again."
      end
      { 'ok' => push['ok'], 'steps' => fmt(steps) }
    end

    EDIT_BRANCH = 'console-edits'

    # Pull-request mode: the saved version goes to a side branch and you merge it on GitHub.
    def publish_as_pull_request(steps)
      push = git('push', '--force', 'origin', "HEAD:refs/heads/#{EDIT_BRANCH}", timeout: 150)
      steps << ["Send to the waiting branch (#{EDIT_BRANCH})", push]
      return { 'ok' => false, 'steps' => fmt(steps) } unless push['ok']
      url = compare_url
      { 'ok' => true, 'steps' => fmt(steps), 'pr_url' => url }
    end

    def default_branch
      ref = git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
      return ref['output'].strip.sub(%r{\Aorigin/}, '') if ref['ok'] && !ref['output'].strip.empty?
      git('branch', '-r')['output'] =~ %r{origin/(main|master)\b} ? $1 : 'main'
    end

    def compare_url
      remote = git('remote', 'get-url', 'origin')['output'].to_s.strip
      m = remote.match(%r{github\.com[:/]+([^/]+)/([^/]+?)(?:\.git)?\z}) or return nil
      "https://github.com/#{m[1]}/#{m[2]}/compare/#{default_branch}...#{EDIT_BRANCH}?expand=1"
    end

    def pull
      if @store.publish_mode == 'pull_request'
        fetch = git('fetch', 'origin', timeout: 120)
        steps = [['Check GitHub', fetch]]
        return { 'ok' => false, 'steps' => fmt(steps) } unless fetch['ok']
        br = default_branch
        # If the waiting branch was merged, the live branch now holds exactly our files: line up with it.
        same = git('diff', '--quiet', 'HEAD', "origin/#{br}")['ok']
        clean = git('status', '--porcelain')['output'].to_s.strip.empty?
        if same && clean
          r = git('reset', '--hard', "origin/#{br}")
          steps << ['Line up with the live site', r]
          return { 'ok' => r['ok'], 'steps' => fmt(steps) }
        end
      end
      r = git('pull', '--ff-only', timeout: 120)
      { 'ok' => r['ok'], 'steps' => fmt([['Get the latest from GitHub', r]]) }
    end

    def fmt(steps)
      steps.map { |name, r| { 'name' => name, 'ok' => r['ok'], 'output' => r['output'].to_s.strip } }
    end

    # ── IndexNow ─────────────────────────────────────────────────────────────
    def indexnow_key
      Dir.children(@root).each do |f|
        return f.sub(/\.txt\z/, '') if f =~ /\A[0-9a-f]{32}\.txt\z/
      end
      nil
    end

    def indexnow_setup
      key = indexnow_key
      return key if key
      key = SecureRandom.hex(16)
      @store.write_text("#{key}.txt", key)
      key
    end

    def indexnow_submit(host, urls)
      key = indexnow_key or raise UserError.new('Set up IndexNow first.', 422)
      uri = URI('https://api.indexnow.org/IndexNow')
      body = JSON.generate('host' => host, 'key' => key, 'keyLocation' => "https://#{host}/#{key}.txt", 'urlList' => urls)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 10
      http.read_timeout = 20
      res = http.post(uri.path, body, 'Content-Type' => 'application/json; charset=utf-8')
      { 'ok' => %w[200 202].include?(res.code), 'status' => res.code, 'body' => res.body.to_s[0, 300] }
    rescue SocketError, Timeout::Error, Errno::ECONNREFUSED, OpenSSL::SSL::SSLError => e
      { 'ok' => false, 'status' => 0, 'body' => "Could not reach IndexNow: #{e.message}" }
    end
  end
end
