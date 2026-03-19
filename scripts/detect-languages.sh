#!/bin/bash
# detect-languages: Use claude -p to discover programming languages on Ubuntu
#
# Runs claude in print mode on an unsandbox container to probe the system
# for installed interpreters and compilers, then reports what it finds.
#
# Usage:
#   ./scripts/detect-languages.sh
#   ./scripts/detect-languages.sh --account 3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Pass through any flags (--account N) and append the prompt
PROMPT='You are investigating an Ubuntu system to find every installed programming language.

Do the following:
1. Run "which" and "command -v" checks for known interpreters and compilers:
   python3, python, ruby, perl, node, nodejs, php, lua, luajit,
   gcc, g++, gfortran, rustc, go, javac, java, scala, kotlinc,
   ghc, ocaml, erlc, elixir, swift, fpc, gnat, nim, zig, nasm,
   tcc, clang, clang++, dotnet, mono, csc,
   R, Rscript, julia, octave,
   bash, zsh, fish, dash, sh, ksh, tcsh, csh,
   awk, gawk, mawk, sed,
   sqlite3, psql, mysql,
   racket, guile, sbcl, clisp, chicken-csi,
   tclsh, wish,
   nasm, fasm,
   deno, bun, ts-node,
   groovy, clojure, lein,
   cobc, gprolog, swipl,
   crystal, v, d, dmd, ldc2, gdc,
   zig, odin, hare,
   factor, forth, gforth

2. Run: find /usr/bin /usr/local/bin /snap/bin -maxdepth 1 -executable -type f 2>/dev/null | sort
   Look for any language runtimes missed above.

3. Run: dpkg -l 2>/dev/null | grep -iE "compiler|interpreter|runtime|jdk|jre" | head -40

4. For each found language, get its version (e.g. python3 --version, gcc --version | head -1).

Output a clean table with columns: Language, Binary Path, Version
Sort alphabetically by language name.
Only include languages actually found on the system (binary exists and runs).'

exec "$SCRIPT_DIR/unsandbox-claude.sh" "$@" "$PROMPT"
