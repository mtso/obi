#!/usr/bin/bash

set -x

mkdir -p build/x86_64-apple-darwin
deno compile --allow-all --output build/x86_64-apple-darwin/obi-x86_64-apple-darwin --target x86_64-apple-darwin obi.ts

mkdir -p build/x86_64-unknown-linux-gnu
deno compile --allow-all --output build/x86_64-unknown-linux-gnu/obi-x86_64-unknown-linux-gnu --target x86_64-unknown-linux-gnu obi.ts

mkdir -p build/x86_64-pc-windows-msvc
deno compile --allow-all --output build/x86_64-pc-windows-msvc/obi-x86_64-pc-windows-msvc --target x86_64-pc-windows-msvc obi.ts

mkdir -p build/aarch64-apple-darwin
deno compile --allow-all --output build/aarch64-apple-darwin/obi-aarch64-apple-darwin --target aarch64-apple-darwin obi.ts
