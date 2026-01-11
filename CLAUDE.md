# GeekHub API

## RSS Cache File Naming

Files are saved to `data/` directory with the following pattern:

```
rss_<hash>_<timestamp>.json
```

- `<hash>`: First 12 characters of MD5 hash of the RSS URL
- `<timestamp>`: ISO 8601 timestamp with special characters replaced by `-`

Example:
```
URL: https://hnrss.org/newest?points=100
Hash: 0055c44846cb (first 12 chars of MD5)
File: rss_0055c44846cb_2026-01-09T21-50-14-712Z.json
```

This allows grouping files by URL prefix for easy cache lookup.
