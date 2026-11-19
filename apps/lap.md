# Lap

<img src="https://raw.githubusercontent.com/julyx10/lap/main/docs/public/icon.png" width="100" style="border-radius:20px;" alt="Lap Icon">

**Category:** Local Photo Management & Offline Media Library  
**Platforms:** macOS, Windows, Linux  
**Pricing:** Free & Open Source (GPL-3.0)  
**Official Resources:** [Official Website](https://julyx10.github.io/lap/) | [GitHub Repository](https://github.com/julyx10/lap) | [Releases](https://github.com/julyx10/lap/releases)

## Overview

Lap is an open-source, local-first photo manager designed to handle massive personal photo and video libraries (100,000+ items) without requiring cloud uploads or subscription fees. Built with Rust and Tauri, it operates directly on your existing directory structure without modifying or locking your files into a proprietary database. It pairs folder-first navigation with on-device machine learning for fast, private discovery.

## Key Features

* **Folder-First Architecture:** Works natively with your existing local folders and storage drives. Files remain untouched in their original locations with zero forced import routines or database lock-in.
* **On-Device Private AI Search:** Perform natural language queries (such as "sunset at the beach"), visual similarity matches, and face clustering completely offline using local hardware acceleration.
* **Massive Library Optimization:** Smoothly navigates libraries containing hundreds of thousands of photos and videos using high-speed thumbnail caching, even when external drives are disconnected.
* **Standards-Compliant Metadata & XMP Sidecars:** Reads and writes EXIF, IPTC, and XMP metadata directly to industry-standard XMP sidecar files to ensure long-term data portability.
* **Comprehensive Media Support:** Native playback for Apple Live Photos, Google Motion Photos, major video containers (MP4, MOV, MKV, AVI), and automatic grouping for RAW + JPEG/HEIC pairs.
* **Culling & Organization:** Built-in duplicate image detection, perceptual similarity grouping, ratings, smart albums, hierarchical tags, and photo editing/collages.

---

[Back to Recommendations Directory](../README.md)
