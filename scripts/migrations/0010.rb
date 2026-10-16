# Update 10: rewords the places that described the MPhil through an equity lens, in your data files.
# It edits the words only and tolerates your files being saved by the console (which re-flows the text).
# A phrase that is not found (because you already changed it) is simply left alone.
require 'yaml'

SWAPS = {
  '_data/identity.yml' => [
    ['and what that means for equity of access to work-integrated learning.',
     "trying to understand, from the students' own accounts, what is actually going on as they look for and secure these placements."],
    ['The Students Industrial Work Experience Scheme (SIWES) and who gets access to a good placement, and why it matters for equity.',
     "The Students Industrial Work Experience Scheme (SIWES), and how students find, secure and make sense of their industrial placements, understood through their own accounts."]
  ],
  '_data/home.yml' => [
    ["and who gets left out when they do. I trained as a mechanical engineer, and the question that keeps pulling me back is a simple one: who gets a fair chance to learn, and what gets in the way?",
     "I am not testing a theory. I am trying to understand what is actually going on, starting from what the students themselves tell me. I trained as a mechanical engineer, and I keep coming back to a plain question. What does it take for a student to get from the classroom into the world of work?"],
    ['[how Nigerian engineering undergraduates find and secure industrial placements](/siwes/),',
     '[how Nigerian engineering undergraduates go about finding and securing industrial placements](/siwes/).'],
    ['industrial placements or access to learning, I would be glad',
     'industrial placements or how students learn engineering, I would be glad']
  ]
}

def flexible(old)
  Regexp.new(old.split(/\s+/).map { |w| Regexp.escape(w) }.join('\s+'))
end

SWAPS.each do |file, pairs|
  next unless File.file?(file)
  original = File.read(file, encoding: 'UTF-8')
  text = original.dup
  changed = 0
  pairs.each do |old, new|
    rx = flexible(old)
    next unless text =~ rx
    text = text.sub(rx) { new }
    changed += 1
  end
  next if changed.zero?
  begin
    YAML.safe_load(text)
    File.write(file, text)
    puts "  Reworded #{changed} place#{changed == 1 ? '' : 's'} in #{file}"
  rescue StandardError
    puts "  Could not reword #{file} safely, so it was left as it was. You can change it in the console."
  end
end
