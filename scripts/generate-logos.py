#!/usr/bin/env python3
"""
Generate different sized logos from the source logo.png
Source: logo.png (2048x2048) in root directory
"""

import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Installing Pillow...")
    os.system("python3 -m pip install Pillow -q || pip3 install Pillow -q")
    from PIL import Image


# Configuration
SOURCE_LOGO = Path(__file__).parent.parent / "logo.png"
PUBLIC_DIR = Path(__file__).parent.parent / "public"

# Sizes to generate
SIZES = {
    "logo-32.png": 32,    # Header icon (w-8 h-8 = 32px)
    "logo-64.png": 64,    # Login page (w-16 h-16 = 64px)
    "logo-128.png": 128,  # Retina display support
    "logo-192.png": 192,  # Android icon
    "logo-512.png": 512,  # Large icon for PWA
    "favicon.png": 32,    # Site favicon (replaces .ico)
}


def generate_logos():
    """Generate all logo sizes from source"""

    if not SOURCE_LOGO.exists():
        print(f"❌ Source logo not found: {SOURCE_LOGO}")
        return False

    # Ensure public directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    # Open source image
    print(f"📸 Loading source logo: {SOURCE_LOGO}")
    img = Image.open(SOURCE_LOGO)

    # Convert to RGBA if needed
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    source_width, source_height = img.size
    print(f"   Source size: {source_width}x{source_height}, Mode: {img.mode}")

    # Generate each size
    generated = []
    for filename, size in SIZES.items():
        output_path = PUBLIC_DIR / filename

        # Resize using high-quality resampling
        resized = img.resize((size, size), Image.Resampling.LANCZOS)

        # Save
        resized.save(output_path, 'PNG', optimize=True)
        generated.append((filename, size))
        print(f"   ✓ Generated: {filename} ({size}x{size})")

    # Delete old favicon.ico if exists
    old_ico = PUBLIC_DIR / "favicon.ico"
    if old_ico.exists():
        old_ico.unlink()
        print(f"   🗑️  Deleted old favicon.ico")

    print(f"\n✅ Generated {len(generated)} logo files in {PUBLIC_DIR}/")
    return True


if __name__ == "__main__":
    generate_logos()
