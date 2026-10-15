# A very small web server built only from Ruby's standard library, so nothing has to be
# installed. It listens on 127.0.0.1 (this computer only) and answers one request per connection.
require 'socket'
require 'json'
require 'uri'
require 'timeout'

module Console
  class Request
    attr_reader :method, :target, :path, :query, :headers, :body

    def initialize(method, target, headers, body)
      @method = method
      @target = target
      @headers = headers
      @body = body || ''
      path, qs = target.split('?', 2)
      @path = URI.decode_www_form_component(path.to_s.gsub('+', '%2B'))
      @query = {}
      URI.decode_www_form(qs.to_s).each { |k, v| @query[k] = v }
    end

    def json
      @json ||= @body.strip.empty? ? {} : JSON.parse(@body.dup.force_encoding('UTF-8'))
    end

    def cookie(name)
      raw = @headers['cookie'].to_s
      raw.split(/;\s*/).each do |pair|
        k, v = pair.split('=', 2)
        return v if k == name
      end
      nil
    end

    def host
      @headers['host'].to_s
    end
  end

  class Response
    attr_accessor :status, :headers, :body

    REASONS = {
      200 => 'OK', 204 => 'No Content', 302 => 'Found', 400 => 'Bad Request', 401 => 'Unauthorized',
      403 => 'Forbidden', 404 => 'Not Found', 405 => 'Method Not Allowed', 409 => 'Conflict',
      413 => 'Payload Too Large', 422 => 'Unprocessable Entity', 500 => 'Internal Server Error'
    }.freeze

    def initialize(status = 200, body = '', headers = {})
      @status = status
      @body = body
      @headers = headers
    end

    def self.json(obj, status = 200)
      new(status, JSON.generate(obj), 'Content-Type' => 'application/json; charset=utf-8')
    end

    def self.text(str, status = 200, type = 'text/plain; charset=utf-8')
      new(status, str, 'Content-Type' => type)
    end

    def reason
      REASONS[@status] || 'OK'
    end
  end

  class Server
    MAX_BODY = 40 * 1024 * 1024
    MAX_HEADER = 64 * 1024

    attr_reader :port

    def initialize(host, port, &app)
      @host = host
      @port = port
      @app = app
    end

    # Try the wanted port, then the next ones, until one is free.
    def open_socket(tries = 25)
      last = nil
      tries.times do |i|
        begin
          @tcp = TCPServer.new(@host, @port + i)
          @port += i
          return @port
        rescue Errno::EADDRINUSE, Errno::EACCES => e
          last = e
        end
      end
      raise last
    end

    def run
      loop do
        begin
          sock = @tcp.accept
        rescue IOError, Errno::EBADF
          break
        end
        Thread.new(sock) { |s| serve(s) }
      end
    end

    def stop
      @tcp.close if @tcp
    end

    private

    def serve(sock)
      sock.binmode
      req = read_request(sock)
      return unless req
      res = begin
        @app.call(req)
      rescue StandardError => e
        warn "[console] #{e.class}: #{e.message}\n  #{e.backtrace.first(6).join("\n  ")}"
        Response.json({ error: "#{e.class}: #{e.message}" }, 500)
      end
      write_response(sock, res)
    rescue Timeout::Error, Errno::ECONNRESET, Errno::EPIPE, IOError
      nil
    ensure
      begin
        sock.close
      rescue StandardError
        nil
      end
    end

    def read_request(sock)
      Timeout.timeout(30) do
        line = sock.gets("\r\n")
        return nil if line.nil?
        method, target, = line.split(' ', 3)
        return nil unless method && target
        headers = {}
        total = 0
        while (h = sock.gets("\r\n"))
          total += h.bytesize
          raise IOError, 'header too large' if total > MAX_HEADER
          break if h == "\r\n"
          k, v = h.split(':', 2)
          headers[k.strip.downcase] = v.to_s.strip if k
        end
        len = headers['content-length'].to_i
        if len > MAX_BODY
          write_response(sock, Response.json({ error: 'That file is too large.' }, 413))
          return nil
        end
        body = len > 0 ? read_exact(sock, len) : ''
        Request.new(method.upcase, target, headers, body)
      end
    end

    def read_exact(sock, len)
      buf = String.new.force_encoding('BINARY')
      while buf.bytesize < len
        chunk = sock.read([len - buf.bytesize, 65_536].min)
        break if chunk.nil? || chunk.empty?
        buf << chunk
      end
      buf
    end

    def write_response(sock, res)
      body = res.body.to_s
      body = body.dup.force_encoding('BINARY')
      head = String.new("HTTP/1.1 #{res.status} #{res.reason}\r\n")
      res.headers.each { |k, v| head << "#{k}: #{v}\r\n" }
      head << "Content-Length: #{body.bytesize}\r\n"
      head << "Cache-Control: no-store\r\n"
      head << "X-Content-Type-Options: nosniff\r\n"
      head << "Referrer-Policy: no-referrer\r\n"
      head << "Connection: close\r\n\r\n"
      sock.write(head.dup.force_encoding('BINARY'))
      sock.write(body)
      sock.flush
    end
  end
end
