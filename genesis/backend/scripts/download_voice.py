"""Download a Piper voice model into the Genesis voices folder.

    python scripts/download_voice.py                      # en_US-lessac-medium
    python scripts/download_voice.py en_GB-alba-medium

Voices: https://huggingface.co/rhasspy/piper-voices (the name format is lang_REGION-name-quality).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


def main() -> None:
    voice = sys.argv[1] if len(sys.argv) > 1 else "en_US-lessac-medium"
    try:
        lang_region, name, quality = voice.split("-")
    except ValueError:
        sys.exit("voice must look like en_US-lessac-medium")
    lang = lang_region.split("_")[0]
    data_dir = Path(os.environ.get("GENESIS_DATA_DIR", "./data"))
    dest = Path(os.environ.get("GENESIS_PIPER_VOICES_DIR", data_dir / "voices"))
    dest.mkdir(parents=True, exist_ok=True)
    for suffix in (".onnx", ".onnx.json"):
        url = f"{BASE}/{lang}/{lang_region}/{name}/{quality}/{voice}{suffix}"
        target = dest / f"{voice}{suffix}"
        print(f"downloading {url}")
        with httpx.stream("GET", url, follow_redirects=True, timeout=120) as r:
            r.raise_for_status()
            with open(target, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        print(f"  -> {target} ({target.stat().st_size // 1024} KB)")
    print(f"Done. Set GENESIS_PIPER_VOICE={voice} (or choose it in Settings).")


if __name__ == "__main__":
    main()
