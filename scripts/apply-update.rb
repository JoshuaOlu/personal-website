# Applies site updates (the numbered .patch files) to this repo, safely, in order.
#
#   ruby scripts/apply-update.rb                  looks in your Downloads folder and applies every update
#                                                 that is waiting, in order (0011, then 0012, ...)
#   ruby scripts/apply-update.rb path\to\0011-x.patch [more.patch ...]     applies those files
#   ruby scripts/apply-update.rb path\to\folder   looks in that folder instead of Downloads
#
# Works the same in PowerShell, Git Bash, Mac and Linux. Only the files an update mentions are touched, so your
# own edits stay. If an update does not fit, everything is undone and you are told which file is the problem.
# Each good update becomes one local commit (undo it with: git revert HEAD). Nothing is pushed; use Publish.
require 'open3'
require 'rbconfig'

def git(*args)
  out, st = Open3.capture2e('git', *args)
  [st.success?, out]
end

ok, top = git('rev-parse', '--show-toplevel')
abort 'Run this from inside your site folder (the git repo).' unless ok
Dir.chdir(top.strip)

TRACK = File.join('scripts', 'applied-updates.txt')

# ── what is already applied: the list in the repo, the old local list, and the commit messages ──
def applied_numbers
  nums = []
  nums += File.read(TRACK).scan(/^\s*(\d+)\s*$/).flatten.map(&:to_i) if File.exist?(TRACK)
  _, gitdir = git('rev-parse', '--git-dir')
  old = File.join(File.expand_path(gitdir.strip), 'applied-updates')
  nums += File.read(old).split.map(&:to_i) if File.exist?(old)
  _, log = git('log', '--format=%s', '-n', '400')
  nums += log.lines.map { |l| l[/\ASite update (\d+):/, 1] }.compact.map(&:to_i)
  nums.uniq.sort
end

# ── which patch files to consider ──
def downloads_dir
  [ENV['SITE_UPDATES_DIR'], File.join(Dir.home, 'Downloads')].compact.find { |d| File.directory?(d) }
end

args = ARGV.dup
files = []
if args.empty?
  dir = downloads_dir
  abort 'I could not find your Downloads folder. Give me the patch file:  ruby scripts/apply-update.rb path\to\0011-name.patch' unless dir
  files = Dir.glob(File.join(dir, '*.patch'))
  where = "your Downloads folder (#{dir})"
else
  args.each do |a|
    if File.directory?(a) then files += Dir.glob(File.join(a, '*.patch'))
    elsif File.file?(a) then files << a
    else abort "I cannot find #{a}"
    end
  end
  where = 'the files you gave me'
end

# one file per number: the newest copy wins (so "0011-name (1).patch" re-downloads do no harm)
by_num = {}
files.each do |f|
  n = File.basename(f)[/\A(\d{4})-/, 1]
  next unless n
  n = n.to_i
  by_num[n] = f if n.positive? && (!by_num[n] || File.mtime(f) > File.mtime(by_num[n]))
end

done = applied_numbers
last = [done.max || 0, 6].max
pending = by_num.keys.select { |n| n > last }.sort
if pending.empty?
  newest = by_num.keys.max
  if newest && newest <= last
    puts "Nothing to do. You are up to date (the last update applied is #{last})."
  else
    puts "No new update files found in #{where}. The last update applied is #{last}."
  end
  exit 0
end

ok, status = git('status', '--porcelain')
unless status.strip.empty?
  puts 'You have changes that are not saved yet. Save them first so an update cannot mix with them:'
  puts '   git add -A'
  puts '   git commit -m "My changes"'
  puts status.lines.first(10).join
  exit 1
end

applied = 0
pending.each do |num|
  if num != last + 1
    puts "Update #{last + 1} has not been downloaded yet, and #{format('%04d', num)} needs it first."
    puts "Download update #{last + 1} to the same place and run this again."
    break
  end
  patch = File.expand_path(by_num[num])
  name = File.basename(patch)
  ok, out = git('apply', '--3way', '--index', '--whitespace=nowarn', patch)
  unless ok
    git('reset', '--hard', '-q', 'HEAD')
    puts "Update #{num} did not fit your current files, so it was not applied and nothing was changed."
    puts out.lines.grep(/error|conflict/i).first(8).join
    puts 'Send me those lines and I will make a version that fits.'
    exit(applied.zero? ? 1 : 0)
  end
  # Some updates also reword text inside your data files. They carry a small script for that, which edits only
  # the words and leaves your own formatting alone. If it fails, the update is undone.
  mig = File.join('scripts', 'migrations', format('%04d.rb', num))
  if File.file?(mig)
    mout, st = Open3.capture2e(RbConfig.ruby, mig)
    puts mout unless mout.strip.empty?
    unless st.success?
      git('reset', '--hard', '-q', 'HEAD')
      puts "The wording step of update #{num} failed, so it was not applied and nothing was changed."
      exit(applied.zero? ? 1 : 0)
    end
  end
  File.open(TRACK, 'a') { |f| f.puts num }
  git('add', '-A')
  ok, out = git('commit', '-q', '-m', "Site update #{num}: #{name.sub(/\A\d+-/, '').sub(/\.patch\z/, '').sub(/ \(\d+\)\z/, '')}")
  abort "Applied, but could not save the commit:\n#{out}" unless ok
  puts "Update #{num} applied: #{name.sub(/\A\d+-/, '').sub(/\.patch\z/, '')}"
  last = num
  applied += 1
end

if applied.positive?
  puts
  puts "#{applied} update#{applied == 1 ? '' : 's'} applied and saved as local commits (not published yet)."
  puts 'To undo the last one:  git revert HEAD'
  puts 'To put it on the live site: Publish in the console, or  git push'
end
