
## File Back Instructions

After answering, do the following:

1. Create a Q&A article at `{qa_dir}/` with the filename being a slugified version of the question (e.g., `effort/qa/how-to-handle-auth-redirects.md`).
2. Use the Q&A article format from the schema (frontmatter with `title`, `question`, `consulted`, `filed`).
3. Update `{home_file}` with a new row for this Q&A article.
4. Append to `{calendar_log}`:

   ```
   ## [{timestamp}] query (filed) | question summary
   - Question: {question}
   - Consulted: [[list of articles read]]
   - Filed to: [[qa/article-name]]
   ```
