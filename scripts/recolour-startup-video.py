#!/usr/bin/env python3
"""Make the startup video's background exactly the app's Home background colour, leaving the gold untouched.

WHY
  src/assets/videos/startup.mp4 plays straight after the native splash and hands over to Home, so its background
  has to be the app's own (theme.background = #0A1128, which is also the splash colour in app.config.js), or the
  screen visibly changes colour at the start and again at the end. The AI-made original is a royal-blue glow,
  brightest behind the coin and darkest in the corners. A brightness / gamma curve (tried on 2026-09-30 and
  2026-10-05) cannot turn a gradient into one flat colour: it only made the blue darker and threw the red and
  green away for good, so it never matched.

HOW (per frame)
  1. find the pixels that are plainly background: dark, with blue clearly above red and green (gold is the
     other way round);
  2. estimate the smooth background colour under everything, even under the coin, from those pixels;
  3. work out how much of each pixel is gold (warm light on top of the blue) and leave that part alone;
  4. move the rest by (target - estimated background), so the background becomes the target colour exactly.
     Pixels darker than the background (soft shadows) move proportionally less, so they do not turn black.
  Then it is encoded as H.264 High (the same profile and level as before). Video stores colour as whole-number
  YUV and cannot return every colour exactly, so the colour fed to the encoder is calibrated: it is the nearest
  input that comes back as the target after encode + decode. For #0A1128 the nearest are #0B1228 and #0B1229,
  which come back as 10, 17, 39 and 10, 17, 41 (one level off in blue, the colour the eye is least sensitive to).
  The shipped video uses #0B1229.

THE COLOUR TAGS MATTER (found 2026-10-15 by showing every version on a real phone and on the emulator):
  Android treats a video with no colour tags, or tagged BT.709, as "BT.709 transfer", and on phones that colour-
  manage video (the Android emulator does; a Pixel-style compositor does) it converts that into sRGB before
  showing it. That lifts dark colours a lot: a video value of 10, 17, 41 was shown as 28, 32, 58, nothing like
  Home. Tagging the stream as sRGB transfer (H.264 VUI transfer_characteristics = 13, ffmpeg's
  iec61966-2-1) says "no conversion needed", which is true because the background was chosen in sRGB. The
  Samsung S22 does not convert either way, so the tag costs it nothing: it showed 12, 17, 39 for Home's 11, 17, 38.
  Two things that do NOT work: drawing the video as a TextureView (it LIFTS the colours on the Samsung), and
  darkening the video to pre-compensate (it depends on the phone and is wrong on the Samsung).
  Matrix BT.709, primaries BT.709 and limited range are tagged too, so every player decodes the YUV the same way.

USAGE (from the repo root). Always start from the UNTOUCHED original, never from an already-recoloured video:
  git show 1f5ed86^:src/assets/videos/startup.mp4 > startup_original.mp4
  python scripts/recolour-startup-video.py startup_original.mp4 src/assets/videos/startup.mp4 --target "#0A1128" --input-colour "#0B1229"
  (that exact command reproduces the shipped file byte for byte; leave --input-colour off to calibrate for a new --target)
  src/utils/checks/startupVideo.check.ts also reads the shipped video's colour tags (sRGB transfer, BT.709, limited).
  python scripts/recolour-startup-video.py --check src/assets/videos/startup.mp4 --target "#0A1128"

  --check VIDEO        report how close VIDEO's background is to --target (exit 1 if it is off by more than 2)
  --preview 0,40,72    with SRC and --out-dir DIR: write before/after pictures of those frames, no video
  --input-colour HEX   skip the calibration and feed the encoder exactly this colour

NEEDS ffmpeg (on the PATH, or set FFMPEG to its path) and Python with numpy and opencv-python.
src/utils/checks/startupVideo.check.ts fails if the theme background drifts from the colour this video was built
for; when it does, rerun this with the new colour.
"""
import argparse
import itertools
import os
import re
import subprocess
import sys
import tempfile

import cv2
import numpy as np

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
LUMA = np.array([0.2126, 0.7152, 0.0722])  # how much each of R, G, B matters to the eye
# Read video the way Android reads an HD stream (BT.709, limited range), whether or not it is tagged.
DECODE_VF = "scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=rgb24"
ENCODE_VF = "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p"
ENCODE_ARGS = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "14M", "-bufsize", "28M",
               "-profile:v", "high", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1",
               "-color_range", "tv", "-movflags", "+faststart", "-an"]
SCALE = 4  # the background is smooth, so it is estimated at 1/4 size (16x cheaper)


def hex_to_rgb(text):
    text = text.lstrip("#")
    return np.array([int(text[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def probe(path):
    """(width, height, frames per second) of the first video stream."""
    err = subprocess.run([FFMPEG, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    size = re.search(r"Video:.*?, (\d+)x(\d+)", err)
    fps = re.search(r"([\d.]+) fps", err)
    if not size or not fps:
        sys.exit(f"could not read the size and frame rate of {path}")
    return int(size.group(1)), int(size.group(2)), float(fps.group(1))


def decode(path, w, h):
    """Frames as float32 RGB."""
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-i", path, "-vf", DECODE_VF,
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32)
    proc.wait()


def smoothstep(lo, hi, x):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blur(a, sigma):
    return cv2.GaussianBlur(a, (0, 0), sigma, borderType=cv2.BORDER_REPLICATE)


def estimate_background(small, mask):
    """Smooth background colour for every pixel from the pixels where mask == 1 (normalised convolution).
    Several blur sizes: the small ones follow the glow closely where there is plenty of background, the big
    ones carry the estimate across the coin where there is none."""
    est = None
    for sigma in (60, 30, 14, 6):  # big -> small
        den = blur(mask, sigma)
        num = blur(small * mask[..., None], sigma)
        e = num / np.maximum(den[..., None], 1e-4)
        if est is None:
            est = e
        else:
            weight = smoothstep(0.15, 0.6, den)[..., None]
            est = weight * e + (1 - weight) * est
    return est


def recolour(frame, target):
    h, w, _ = frame.shape
    small = cv2.resize(frame, (w // SCALE, h // SCALE), interpolation=cv2.INTER_AREA)
    r, g, b = small[..., 0], small[..., 1], small[..., 2]
    # 1. plainly background: dark, and blue clearly above red and green
    mask = ((r < 60) & (g < 70) & (b > r + 18) & (b > g + 8)).astype(np.float32)
    mask = cv2.erode(mask, np.ones((3, 3), np.uint8))  # stay off the soft edges of gold things
    # 2. the smooth background under everything; a second pass drops dim sparkle halos that slipped in
    bg_small = estimate_background(small, mask)
    near = np.abs(small - bg_small).max(axis=2) < 14
    bg_small = estimate_background(small, mask * near.astype(np.float32))
    bg = cv2.resize(bg_small, (w, h), interpolation=cv2.INTER_CUBIC)
    # 3. how much of each pixel is gold: warm light above the background in red / green
    d = frame - bg
    warm = np.maximum(d[..., 0], 0) + 0.7 * np.maximum(d[..., 1], 0)
    gold = smoothstep(8.0, 70.0, warm)[..., None]
    # 4. move the background part onto the target (shadows, darker than the background, move proportionally less)
    shift = target[None, None, :] - bg
    rel = np.clip(frame / np.maximum(bg, 1.0), 0.0, 1.0)
    scale = np.where(shift < 0, rel, 1.0)
    return np.clip(frame + (1.0 - gold) * scale * shift, 0, 255)


def encode_cmd(out_path, w, h, fps):
    return [FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
            "-vf", ENCODE_VF, *ENCODE_ARGS, out_path]


def calibrate(target):
    """The input colour that comes back closest to `target` after this encoder + decoder (see the docstring)."""
    patch, cols = 32, 19
    cands = [np.array(c) for c in itertools.product(*[range(int(t) - 3, int(t) + 4) for t in target])]
    rows = -(-len(cands) // cols)
    w, h = cols * patch, rows * patch
    img = np.zeros((h, w, 3), np.uint8)
    for i, c in enumerate(cands):
        row, col = divmod(i, cols)
        img[row * patch:(row + 1) * patch, col * patch:(col + 1) * patch] = np.clip(c, 0, 255)
    with tempfile.TemporaryDirectory() as tmp:
        clip = os.path.join(tmp, "calibrate.mp4")
        enc = subprocess.Popen(encode_cmd(clip, w, h, 24), stdin=subprocess.PIPE)
        for _ in range(3):
            enc.stdin.write(img.tobytes())
        enc.stdin.close()
        enc.wait()
        decoded = list(decode(clip, w, h))[0]  # read it all, so ffmpeg lets go of the file (Windows)
    best = None
    for i, c in enumerate(cands):
        row, col = divmod(i, cols)
        centre = decoded[row * patch + 8:(row + 1) * patch - 8, col * patch + 8:(col + 1) * patch - 8].reshape(-1, 3).mean(0)
        err = centre - target
        key = (float((LUMA * err ** 2).sum()), float(np.abs(err).max()), float(np.abs(c - target).sum()))
        if best is None or key < best[0]:
            best = (key, c, centre)
    print(f"calibration: feed #{''.join(f'{int(v):02X}' for v in best[1])} -> comes back as "
          f"{np.round(best[2], 1).tolist()} (wanted {target.astype(int).tolist()})")
    return best[1].astype(np.float32)


def check(path, target):
    """How close the background of a finished video is to `target`; returns True if it is within 2 levels."""
    w, h, _ = probe(path)
    block = 20
    means, corners = [], []
    for i, frame in enumerate(decode(path, w, h)):
        if i % 6:
            continue
        devs = []
        for y in range(0, h - block, block):
            for x in range(0, w - block, block):
                blk = frame[y:y + block, x:x + block]
                if (blk[..., :2].max() - target[:2].max()) > 12:  # something warm or bright in it: gold
                    continue
                devs.append(blk.reshape(-1, 3).mean(0) - target)
        means.append(np.mean(devs, axis=0))
        corners += [frame[y:y + 40, x:x + 40].reshape(-1, 3).mean(0) for (x, y) in ((0, 0), (w - 40, 0), (0, h - 40), (w - 40, h - 40))]
    means = np.array(means)
    print(f"{path}: {len(means)} frames checked")
    print("  average background vs target (R,G,B):", np.round(means.mean(0), 2).tolist())
    print("  frame-to-frame range of that average:", np.round(means.max(0) - means.min(0), 2).tolist())
    print("  the four corners, average over time: ", np.round(np.mean(corners, axis=0), 1).tolist(), "target", target.astype(int).tolist())
    ok = bool((np.abs(means.mean(0)) <= 2).all())
    print("  " + ("OK: within 2 levels" if ok else "OFF by more than 2 levels"))
    return ok


def main():
    ap = argparse.ArgumentParser(description="Recolour the startup video's background (see the top of this file).")
    ap.add_argument("src", nargs="?", help="the untouched original video")
    ap.add_argument("dst", nargs="?", help="where to write the recoloured video")
    ap.add_argument("--target", default="#0A1128", help="the colour the background should come back as")
    ap.add_argument("--input-colour", help="skip the calibration and feed the encoder exactly this colour")
    ap.add_argument("--check", metavar="VIDEO", help="only report how close VIDEO's background is to --target")
    ap.add_argument("--preview", default="", help="frame numbers, e.g. 0,40,72 (with --out-dir)")
    ap.add_argument("--out-dir", default="")
    a = ap.parse_args()
    target = hex_to_rgb(a.target)

    if a.check:
        sys.exit(0 if check(a.check, target) else 1)
    if not a.src or not (a.dst or a.preview):
        ap.error("give SRC and DST (or SRC with --preview and --out-dir, or --check VIDEO)")

    feed = hex_to_rgb(a.input_colour) if a.input_colour else calibrate(target)
    w, h, fps = probe(a.src)
    want = {int(x) for x in a.preview.split(",") if x}
    enc = None if want else subprocess.Popen(encode_cmd(a.dst, w, h, fps), stdin=subprocess.PIPE)
    count = 0
    for i, frame in enumerate(decode(a.src, w, h)):
        if want and i not in want:
            continue
        out = recolour(frame, feed)
        if want:
            both = np.concatenate([frame, out], axis=1).astype(np.uint8)
            half = cv2.resize(both, (both.shape[1] // 2, both.shape[0] // 2), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(a.out_dir, f"before_after_{i:03d}.png"), cv2.cvtColor(half, cv2.COLOR_RGB2BGR))
        else:
            enc.stdin.write(np.rint(out).astype(np.uint8).tobytes())
        count += 1
        if count % 20 == 0:
            print("frames", count, file=sys.stderr, flush=True)
    if enc:
        enc.stdin.close()
        enc.wait()
    if count == 0:
        sys.exit("no frames were read from " + a.src)
    print(f"done, {count} frames" + ("" if want else f" -> {a.dst}"))


if __name__ == "__main__":
    main()
