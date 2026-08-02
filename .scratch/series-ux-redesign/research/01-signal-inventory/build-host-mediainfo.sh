#!/bin/bash
# Host build of the exact MediaInfoLib v25.10 source the turbomodule bundles.
# Mirrors ~/mediainfo-build/build-android.sh minus the NDK toolchain and JNI flag.
set -e
SRC=/home/jason/mediainfo-build
BUILD=/home/jason/.claude/jobs/d3f8d556/tmp/mi-host

MEDIAINFO_CXX_FLAGS="-DMEDIAINFO_ADVANCED_YES -DMEDIAINFO_ADVANCED2_YES -DMEDIAINFO_IBI_NO -DMEDIAINFO_IBIUSAGE_NO -fvisibility=default"

cmake -B "$BUILD/zenlib" -S "$SRC/ZenLib/Project/CMake" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON
cmake --build "$BUILD/zenlib" --parallel "$(nproc)"

cmake -B "$BUILD/mediainfo" -S "$SRC/MediaInfoLib/Project/CMake" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON \
    -DBUILD_ZENLIB=ON -DBUILD_ZLIB=OFF \
    -DCMAKE_CXX_FLAGS="$MEDIAINFO_CXX_FLAGS"
cmake --build "$BUILD/mediainfo" --parallel "$(nproc)"

find "$BUILD/mediainfo" -name 'libmediainfo.so*' -type f
echo BUILD_OK
