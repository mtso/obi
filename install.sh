#!/bin/sh

set -e

if ! command -v unzip >/dev/null; then
  echo "Error: unzip is required to install Obi." 1>&2
  exit 1
fi

if ! command -v deno >/dev/null; then
  echo "Error: Deno is required to use Obi (see: https://github.com/denoland/deno." 1>&2
  exit 1
fi

if [ "$OS" = "Windows_NT" ]; then
  target="x86_64-pc-windows-msvc"
else
  case $(uname -sm) in
  "Darwin x86_64") target="x86_64-apple-darwin" ;;
  "Darwin arm64") target="aarch64-apple-darwin" ;;
  *) target="x86_64-unknown-linux-gnu" ;;
  esac
fi

obi_uri="https://github.com/mtso/obi/archive/refs/tags/0.0.1.zip"

obi_install="${OBI_INSTALL:-$HOME/.obi}"
bin_dir="$obi_install/bin"
exe="$bin_dir/obi"
sh_exe="$exe-0.0.1/obi"

if [ ! -d "$bin_dir" ]; then
  mkdir -p "$bin_dir"
fi

curl --fail --location --progress-bar --output "$exe.zip" "$obi_uri"
unzip -d "$bin_dir" -o "$exe.zip"
chmod +x "$sh_exe"
# chmod +x "$exe"
rm "$exe.zip"

echo "Obi was installed successfully to $sh_exe"
if command -v obi >/dev/null; then
  echo "Usage: obi [path to obi file]"
  # echo "Run 'obi --help' to get started"
else
  case $SHELL in
  /bin/zsh) shell_profile=".zshrc" ;;
  *) shell_profile=".bash_profile" ;;
  esac
  echo "Manually add the directory to your \$HOME/$shell_profile (or similar)"
  echo "  export OBI_INSTALL=\"$obi_install\""
  echo "  export PATH=\"\$OBI_INSTALL/bin/obi-0.0.1:\$PATH\""
  echo "Usage: obi [path to obi file]"
  # echo "Run '$exe --help' to get started"
fi