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

VERSION="0.2.1"
obi_uri="https://github.com/mtso/obi/archive/refs/tags/$VERSION.zip"

obi_install="${OBI_INSTALL:-$HOME/.obi}"
tmp_dir="$obi_install/tmp"
sdk_dir="$obi_install/sdk"
bin_dir="$sdk_dir/bin"
exe="$sdk_dir/bin/obi"

rm -rf "$sdk_dir"
if [ ! -d "$tmp_dir" ]; then
  mkdir -p "$tmp_dir"
fi

curl --fail --location --progress-bar --output "$tmp_dir/source.zip" "$obi_uri"
unzip -d "$tmp_dir" -o "$tmp_dir/source.zip"
mv "$tmp_dir/obi-$VERSION" "$sdk_dir"
chmod +x "$exe"
rm "$tmp_dir/source.zip"
rmdir "$tmp_dir"

echo "Obi was installed successfully to $exe"
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
  echo "  export PATH=\"\$OBI_INSTALL/sdk/bin:\$PATH\""
  echo "Usage: obi [path to obi file]"
  # echo "Run '$exe --help' to get started"
fi