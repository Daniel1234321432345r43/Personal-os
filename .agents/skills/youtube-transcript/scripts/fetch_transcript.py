#!/usr/bin/env python3
"""Fetch a public YouTube transcript using Python's standard library.

Usage:
  python3 fetch_transcript.py URL -o transcript.json
  python3 fetch_transcript.py URL --language es --text-output transcript.txt
"""

import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "Chrome/120.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "en-US,en;q=0.9",
}
INNERTUBE_CONTEXT = {
    "client": {"clientName": "ANDROID", "clientVersion": "20.10.38"}
}


def request(url: str, data: Optional[bytes] = None) -> str:
    headers = dict(HEADERS)
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read().decode("utf-8")


def video_id_from_url(value: str) -> str:
    value = value.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        return value
    parsed = urllib.parse.urlparse(value)
    host = parsed.netloc.lower().split(":", 1)[0]
    if host == "youtu.be":
        candidate = parsed.path.lstrip("/").split("/", 1)[0]
    elif host.endswith("youtube.com"):
        if parsed.path == "/watch":
            candidate = urllib.parse.parse_qs(parsed.query).get("v", [""])[0]
        else:
            parts = [part for part in parsed.path.split("/") if part]
            candidate = parts[1] if len(parts) >= 2 and parts[0] in {
                "embed", "shorts", "live", "v"
            } else ""
    else:
        candidate = ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
        raise ValueError("Could not find an 11-character YouTube video ID in the URL")
    return candidate


def decode_json_string(value: str) -> str:
    try:
        return json.loads('"' + value + '"')
    except (ValueError, json.JSONDecodeError):
        return html.unescape(value)


def fetch_page(video_id: str) -> str:
    return request("https://www.youtube.com/watch?v=" + video_id)


def find_api_key(page: str) -> str:
    match = re.search(r'"INNERTUBE_API_KEY"\s*:\s*"([^"\\]+)"', page)
    if not match:
        raise RuntimeError("YouTube did not expose an InnerTube API key")
    return match.group(1)


def fetch_caption_tracks(video_id: str, page: str) -> List[Dict[str, Any]]:
    payload = json.dumps({
        "context": INNERTUBE_CONTEXT,
        "videoId": video_id,
    }).encode("utf-8")
    api_url = (
        "https://www.youtube.com/youtubei/v1/player?key="
        + urllib.parse.quote(find_api_key(page), safe="")
    )
    response = json.loads(request(api_url, payload))
    renderer = response.get("captions", {}).get(
        "playerCaptionsTracklistRenderer", {}
    )
    tracks = renderer.get("captionTracks", [])
    if not tracks:
        raise RuntimeError("No public captions are available for this video")
    return tracks


def select_track(tracks: List[Dict[str, Any]], language: str) -> Dict[str, Any]:
    language = language.lower()
    for track in tracks:
        if track.get("languageCode", "").lower() == language:
            return track
    for track in tracks:
        if track.get("languageCode", "").lower().split("-", 1)[0] == language:
            return track
    return tracks[0]


def parse_caption_xml(content: str) -> List[Dict[str, Any]]:
    root = ET.fromstring(content)
    segments: List[Dict[str, Any]] = []

    for element in root.iter("p"):
        start = element.get("t")
        if start is None:
            continue
        text = "".join(element.itertext()).strip()
        if not text:
            continue
        segments.append({
            "start": round(float(start) / 1000, 1),
            "duration": round(float(element.get("d", "0")) / 1000, 1),
            "text": html.unescape(text),
        })
    if segments:
        return segments

    for element in root.iter("text"):
        text = "".join(element.itertext()).strip()
        if not text:
            continue
        segments.append({
            "start": round(float(element.get("start", "0")), 1),
            "duration": round(float(element.get("dur", "0")), 1),
            "text": html.unescape(text),
        })
    return segments


def fetch_segments(track: Dict[str, Any]) -> List[Dict[str, Any]]:
    track_url = track.get("baseUrl")
    if not track_url:
        raise RuntimeError("The selected caption track has no download URL")
    content = request(track_url)
    try:
        segments = parse_caption_xml(content)
    except ET.ParseError as error:
        raise RuntimeError("YouTube returned captions in an unsupported format") from error
    if not segments:
        raise RuntimeError("The caption track contained no spoken text")
    return segments


def extract_metadata(page: str) -> Dict[str, Any]:
    metadata: Dict[str, Any] = {}
    patterns = {
        "title": r'"title"\s*:\s*"((?:[^"\\]|\\.)*)"',
        "channel": r'"ownerChannelName"\s*:\s*"((?:[^"\\]|\\.)*)"',
        "duration": r'"lengthSeconds"\s*:\s*"(\d+)"',
        "published": r'"publishDate"\s*:\s*"([^"]+)"',
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, page)
        if not match:
            continue
        value = match.group(1)
        if key == "duration":
            metadata[key] = int(value)
        else:
            metadata[key] = decode_json_string(value)
    return metadata


def format_time(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return "{}:{:02d}:{:02d}".format(hours, minutes, seconds)
    return "{}:{:02d}".format(minutes, seconds)


def write_text(path: str, result: Dict[str, Any]) -> None:
    lines = []
    for segment in result["segments"]:
        lines.append("[{}] {}".format(format_time(segment["start"]), segment["text"]))
    with open(path, "w", encoding="utf-8") as output:
        output.write("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="YouTube video URL or video ID")
    parser.add_argument("-o", "--output", help="Write structured JSON to this file")
    parser.add_argument("--text-output", help="Also write a timestamped plain-text transcript")
    parser.add_argument("-l", "--language", default="en", help="Preferred caption language")
    args = parser.parse_args()

    try:
        video_id = video_id_from_url(args.url)
        page = fetch_page(video_id)
        track = select_track(fetch_caption_tracks(video_id, page), args.language)
        result: Dict[str, Any] = {
            "video_id": video_id,
            "url": "https://www.youtube.com/watch?v=" + video_id,
            "metadata": extract_metadata(page),
            "language": track.get("languageCode", "unknown"),
            "caption_type": "auto-generated" if track.get("kind") == "asr" else "manual",
            "segments": fetch_segments(track),
        }
        result["total_segments"] = len(result["segments"])
        if args.output:
            with open(args.output, "w", encoding="utf-8") as output:
                json.dump(result, output, ensure_ascii=False, indent=2)
            print("Saved transcript to {}".format(args.output))
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.text_output:
            write_text(args.text_output, result)
            print("Saved readable transcript to {}".format(args.text_output))
        return 0
    except (OSError, ValueError, RuntimeError, urllib.error.URLError) as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
