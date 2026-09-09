---
name: youtube-transcript
description: Extracts transcripts from YouTube videos when the user provides a YouTube URL or asks to transcribe, fetch captions, get subtitles, summarize, or analyze a video. Uses the bundled dependency-free extractor first and can optionally use yt-dlp or Whisper when captions are unavailable.
allowed-tools: Bash,Read,Write
---

# YouTube Transcript

Extract the spoken text from a YouTube video and save it as structured JSON or readable text.

## Workflow

1. Validate the YouTube URL.
2. Run the bundled extractor, which uses Python 3 standard-library modules only:

```bash
python3 .agents/skills/youtube-transcript/scripts/fetch_transcript.py "YOUTUBE_URL" -o transcript.json
```

3. Read the JSON output. It includes video metadata, timestamped segments, the selected caption language, and the extraction source.
4. For a plain-text transcript, preserve speaking order and timestamps when useful. Remove repeated rolling-caption text only when the output is clearly auto-generated.
5. Tell the user where the transcript was saved and whether it came from manual or auto-generated captions.

## Language

The extractor defaults to English but falls back to the first available caption track. Prefer the requested language when known:

```bash
python3 .agents/skills/youtube-transcript/scripts/fetch_transcript.py "YOUTUBE_URL" --language es -o transcript-es.json
```

## Fallbacks

If the bundled extractor reports that no captions are available:

1. Check whether `yt-dlp` is installed with `command -v yt-dlp`.
2. If it is available, inspect subtitle tracks with `yt-dlp --list-subs "YOUTUBE_URL"`, then try manual subtitles before auto-generated subtitles:

```bash
yt-dlp --write-sub --write-auto-sub --sub-langs "en,es" --skip-download --output "transcript.%(id)s.%(ext)s" "YOUTUBE_URL"
```

3. Only if no captions exist, explain that audio must be downloaded and ask for confirmation before downloading it or installing Whisper. Whisper requires `ffmpeg`, Python packages, model storage, and additional processing time.
4. Never silently install system packages, download large audio files, or install a Whisper model without the user's confirmation.

## Output

- Use the bundled JSON output for summaries, analysis, study notes, or timestamped citations.
- If the user requests a raw transcript, convert the `segments` array to readable text and retain timestamps when requested.
- Warn that auto-generated captions may contain recognition errors.
- Respect YouTube's terms and copyright. Do not bypass private, paid, or access-controlled videos.

## Troubleshooting

- Private, age-restricted, geo-blocked, or unavailable videos may fail.
- If YouTube blocks the request, report the error and offer the user's own transcript or a local audio file as an alternative.
- The extractor does not download video or audio; it only requests captions and public metadata.
