#!/usr/bin/env bash
set -euo pipefail

FFMPEG_VERSION="8.0.1"
JPEG_TURBO_VERSION="3.2.0"
EXIFTOOL_VERSION="13.59"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/src-tauri/resources/bin"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

curl --fail --location --proto '=https' \
  "https://github.com/FFmpeg/FFmpeg/archive/refs/tags/n${FFMPEG_VERSION}.tar.gz" \
  --output "$BUILD_DIR/ffmpeg.tar.gz"
tar -xf "$BUILD_DIR/ffmpeg.tar.gz" -C "$BUILD_DIR"

for architecture in x86_64 arm64; do
  source_dir="$BUILD_DIR/FFmpeg-n${FFMPEG_VERSION}"
  architecture_dir="$BUILD_DIR/ffmpeg-$architecture"
  mkdir -p "$architecture_dir"
  pushd "$architecture_dir" >/dev/null
  "$source_dir/configure" \
    --arch="$architecture" \
    --cc="clang -arch $architecture" \
    --extra-cflags="-arch $architecture" \
    --extra-ldflags="-arch $architecture" \
    --disable-debug \
    --disable-doc \
    --disable-ffplay \
    --disable-ffprobe \
    --disable-network \
    --disable-x86asm \
    --enable-videotoolbox
  make -j"$(sysctl -n hw.logicalcpu)" ffmpeg
  popd >/dev/null
done

curl --fail --location --proto '=https' \
  "https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/${JPEG_TURBO_VERSION}/libjpeg-turbo-${JPEG_TURBO_VERSION}.tar.gz" \
  --output "$BUILD_DIR/libjpeg-turbo.tar.gz"
tar -xf "$BUILD_DIR/libjpeg-turbo.tar.gz" -C "$BUILD_DIR"
for architecture in x86_64 arm64; do
  jpeg_source_dir="$BUILD_DIR/libjpeg-turbo-${JPEG_TURBO_VERSION}"
  jpeg_architecture_dir="$BUILD_DIR/libjpeg-$architecture"
  mkdir -p "$jpeg_architecture_dir"
  pushd "$jpeg_architecture_dir" >/dev/null
  CC="clang -arch $architecture" \
    CFLAGS="-O3 -arch $architecture" \
    LDFLAGS="-arch $architecture" \
    "$jpeg_source_dir/configure" \
    --disable-shared \
    --with-pic
  make -j"$(sysctl -n hw.logicalcpu)" jpegtran
  popd >/dev/null
done

curl --fail --location --proto '=https' \
  "https://exiftool.org/Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz" \
  --output "$BUILD_DIR/exiftool.tar.gz"
tar -xf "$BUILD_DIR/exiftool.tar.gz" -C "$BUILD_DIR"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
lipo -create \
  "$BUILD_DIR/ffmpeg-x86_64/ffmpeg" \
  "$BUILD_DIR/ffmpeg-arm64/ffmpeg" \
  -output "$OUTPUT_DIR/ffmpeg"
lipo -create \
  "$BUILD_DIR/libjpeg-x86_64/jpegtran" \
  "$BUILD_DIR/libjpeg-arm64/jpegtran" \
  -output "$OUTPUT_DIR/jpegtran"
cp "$BUILD_DIR/Image-ExifTool-${EXIFTOOL_VERSION}/exiftool" "$OUTPUT_DIR/exiftool"
cp -R "$BUILD_DIR/Image-ExifTool-${EXIFTOOL_VERSION}/lib" "$OUTPUT_DIR/lib"
chmod +x "$OUTPUT_DIR/ffmpeg" "$OUTPUT_DIR/jpegtran" "$OUTPUT_DIR/exiftool"

lipo -verify_arch x86_64 arm64 "$OUTPUT_DIR/ffmpeg" "$OUTPUT_DIR/jpegtran"
