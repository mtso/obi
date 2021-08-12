#!/usr/bin/bash

set -x

mkdir -p build/releases

mkdir -p build/x86_64-apple-darwin
deno compile --allow-all --output build/x86_64-apple-darwin/obi --target x86_64-apple-darwin obi.ts
cd build/x86_64-apple-darwin
zip -r ../releases/obi-x86_64-apple-darwin.zip obi
cd ../.. 

mkdir -p build/x86_64-unknown-linux-gnu
deno compile --allow-all --output build/x86_64-unknown-linux-gnu/obi --target x86_64-unknown-linux-gnu obi.ts
cd build/x86_64-unknown-linux-gnu
zip -r ../releases/obi-x86_64-unknown-linux-gnu.zip obi
cd ../..

mkdir -p build/x86_64-pc-windows-msvc
deno compile --allow-all --output build/x86_64-pc-windows-msvc/obi --target x86_64-pc-windows-msvc obi.ts
cd build/x86_64-pc-windows-msvc
zip -r ../releases/obi-x86_64-pc-windows-msvc.zip obi.exe
cd ../..

mkdir -p build/aarch64-apple-darwin
deno compile --allow-all --output build/aarch64-apple-darwin/obi --target aarch64-apple-darwin obi.ts
cd build/aarch64-apple-darwin
zip -r ../releases/obi-aarch64-apple-darwin.zip obi
cd ../..
