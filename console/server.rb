#!/usr/bin/env ruby
# The site console: a private control panel for joshua.olunlade.com that runs on this computer only.
#
#   ruby console/server.rb            start it (the Start-Console file does this for you)
#   ruby console/server.rb --no-open  start it without opening the browser
#   ruby console/server.rb --port 4311 --site /path/to/the/site
#
# Nothing here is part of the website. The folder is excluded from the build.
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8
$stdout.sync = true
$stderr.sync = true

require 'optparse'
require 'securerandom'
require_relative 'lib/app'

opts = { port: 4311, open: true, site: File.expand_path('..', __dir__) }
OptionParser.new do |o|
  o.on('--port N', Integer) { |v| opts[:port] = v }
  o.on('--site PATH') { |v| opts[:site] = File.expand_path(v) }
  o.on('--no-open') { opts[:open] = false }
end.parse!

unless File.exist?(File.join(opts[:site], '_config.yml'))
  warn "This does not look like the site folder (no _config.yml in #{opts[:site]})."
  exit 1
end

store = Console::Store.new(opts[:site])
token = ENV['CONSOLE_TOKEN'].to_s.empty? ? SecureRandom.hex(24) : ENV['CONSOLE_TOKEN']
app = Console::App.new(store, token)
server = Console::Server.new('127.0.0.1', opts[:port]) { |req| app.call(req) }
app.port = server.open_socket

url = "http://127.0.0.1:#{app.port}/?t=#{token}"
puts
puts '  Site console is running.'
puts "  Site folder: #{store.root}"
puts "  Open this address if the browser did not open by itself:"
puts "  #{url}"
puts
puts '  Leave this window open while you work. Close it (or press Ctrl+C) to stop the console.'
puts

at_exit { app.runner.stop_preview rescue nil }
Signal.trap('INT') { puts "\n  Stopping..."; exit(0) }
Signal.trap('TERM') { exit(0) } rescue nil

if opts[:open]
  Thread.new do
    sleep 0.6
    begin
      if Console.windows?
        system('cmd', '/c', 'start', '', url)
      elsif RbConfig::CONFIG['host_os'] =~ /darwin/
        system('open', url)
      else
        system('xdg-open', url, out: File::NULL, err: File::NULL)
      end
    rescue StandardError
      nil
    end
  end
end

server.run
