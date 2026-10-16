#!/bin/sh
# Applies any site updates waiting in your Downloads folder. Run:  ./scripts/update-site.sh
cd "$(dirname "$0")/.." && ruby scripts/apply-update.rb "$@"
