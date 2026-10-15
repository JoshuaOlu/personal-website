#!/bin/sh
# Opens the site console in your browser. On a Mac you can also double-click start-console.command.
cd "$(dirname "$0")" || exit 1
command -v ruby >/dev/null 2>&1 || { echo "Ruby was not found. Install Ruby, then try again."; exit 1; }
exec ruby console/server.rb
