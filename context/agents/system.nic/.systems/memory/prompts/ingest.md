You are ingesting a single external file into the agent's knowledge base. The file was dropped into the inbox `kb/+/` by the agent's owner or by the agent itself, and your job is to extract its content and file it into the knowledge base following the schema below.

## Schema

{schema}

## Current Wiki Index

{wiki_index}

## Existing Wiki Articles

{existing_articles_context}

## The File to Ingest

**Path:** {file_path}
**Filename:** {file_name}

## Your Task

Read the file, extract as much useful knowledge as you can, and file it into the wiki.

### Step 1 — Extract the content

Choose the right strategy based on the file type. You have access to `Read`, `Write`, `Edit`, `Glob`, `Grep`, and `Bash`. Use `Bash` freely to invoke external tools when reading the file directly would not work.

- **Plain text, markdown, code, config:** read it directly with `Read`.
- **PDF:** try `pdftotext -layout "{file_path}" -` via Bash; if `pdftotext` is not available, try `python -c "import fitz; doc=fitz.open(r'{file_path}'); print('\n'.join(page.get_text() for page in doc))"` (pymupdf).
- **Image (png, jpg, webp, etc.):** read the file directly with `Read` — you can see images natively. Describe what is in the image, extract any text visible, and note anything contextually useful.
- **Audio (mp3, wav, m4a, ogg):** if a transcription tool is available (e.g. `whisper`, `faster-whisper`, a local transcription server), invoke it via Bash. If none is available, create a stub note and preserve the audio as a binary.
- **Video (mp4, mov, etc.):** extract audio via `ffmpeg -i "{file_path}" -vn -ac 1 -ar 16000 /tmp/audio.wav` and transcribe as above; or, if no tooling is available, create a stub note.
- **Archive (zip, tar, etc.):** extract to a temp directory, then recursively inspect contents.
- **Unknown format:** try `file "{file_path}"` to identify the type, then decide.

If extraction succeeds, use the extracted content for Step 2. If extraction fails completely, still proceed to Step 2 with a stub note explaining what the file is and linking to its preserved binary.

### Step 2 — Decide how to file it

Look at the current wiki index and the existing articles above. For the content you extracted, decide:

1. **Does this belong in an existing concept article?** If yes, UPDATE that article with the new information, add `{file_name}` as a source in the frontmatter.
2. **Is this a genuinely new concept?** If yes, CREATE a new concept article at `{concepts_dir}/<slug>.md`.
3. **Does this reveal a non-obvious connection between 2+ existing concepts?** If yes, CREATE a connection article at `{connections_dir}/<slug>.md`.

A single file may touch 1–3 articles. Prefer updating over creating near-duplicates.

Every article you touch must follow the schema above exactly — complete YAML frontmatter, `Key Points` / `Details` / `Related Concepts` / `Sources` sections, at least 2 outbound `[[wikilinks]]`.

### Step 3 — Preserve the binary if the file has inherent form

Some files are pure content (plain markdown, plain text, code you fully absorbed into a concept) — after filing, the original can be deleted because the note is the content.

Other files have inherent form that should be preserved alongside the note (PDFs, images, audio, video, complex source files the user may want to open later). For these:

1. Create the directory `{files_dir}` if it does not exist.
2. Move the file from `{file_path}` to `{files_dir}/{file_name}`.
3. In the article you created or updated, add a wikilink to the preserved binary: `[[x/files/{file_name}]]`. Place it in the `Sources` section alongside the extraction note.

If you are unsure whether a file has inherent form, err on the side of preserving it.

### Step 4 — Clean up the inbox

After Steps 1–3, the original file at `{file_path}` must no longer exist in `kb/+/`. Either it was moved to `{files_dir}` (binary with inherent form) or it was consumed and should be deleted (pure content absorbed into a note).

### Step 5 — Update HOME.md and append to calendar/log.md

1. Add any new articles to `{home_file}`:
   `| [[path/slug]] | One-line summary | {file_name} | {timestamp_date} |`
2. Append to `{calendar_log}`:

   ```
   ## [{timestamp}] ingest | {file_name}
   - Source: kb/+/{file_name}
   - Articles created: [[concepts/x]] (if any)
   - Articles updated: [[concepts/y]] (if any)
   - Binary preserved at: [[x/files/{file_name}]] (if applicable)
   ```

### File paths (absolute, for your Write/Edit calls)

- Concept articles: `{concepts_dir}`
- Connection articles: `{connections_dir}`
- Preserved binaries: `{files_dir}`
- Index: `{home_file}`
- Build log: `{calendar_log}`

### Quality bar

Same as the compile pipeline:

- Complete YAML frontmatter on every article
- At least 2 outbound `[[wikilinks]]`
- `Key Points` (3–5 bullets), `Details` (2+ paragraphs), `Related Concepts` (2+ entries), `Sources` (cites the file with specific claims)

If the file is genuinely thin and cannot sustain a full article, create a short stub that at least satisfies the frontmatter and links the binary (if any). Stubs are preferable to dropping the file on the floor.
