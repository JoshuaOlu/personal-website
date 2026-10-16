#!/usr/bin/env ruby
# Reads _data/references.yml and the [@key] citations in _writing and _projects, and writes the
# formatted text the pages use (into _data/cite/). Run from the site folder:  ruby scripts/citations.rb
# The deploy workflow runs this before every build, and the console runs it when you save.
require_relative '../console/lib/citations'

root = File.expand_path('..', __dir__)
report = Console::Citations.build(root)
puts "Citations: #{report['pieces']} piece#{report['pieces'] == 1 ? '' : 's'} with references."
report['unknown'].each do |file, keys|
  puts "WARNING: #{file} cites #{keys.map { |k| "[@#{k}]" }.join(', ')} but #{keys.size == 1 ? 'it is' : 'they are'} not in _data/references.yml"
end
