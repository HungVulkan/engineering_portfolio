# Portfolio · Vũ Quốc Hùng

Personal portfolio of a 3rd-year Electronics and Communication Engineering student at VNU-HCMUS. Focus: physical design (RTL to layout, STA). Looking for a physical design internship.

**Pages:** General · Certificates · Projects · Blog

## Tech

Plain HTML, CSS and JavaScript. No build step. Certificates, projects and blog posts are loaded from JSON files and sorted newest first.

## Structure

```
index.html            General page
certificates.html     All certificates
projects.html         All projects
blog.html             All blog posts
post.html             One blog post (post.html?p=<id>)
assets/               style.css, app.js
data/                 certificates.json, projects.json, blog.json
certs/, projects/, blog/   Optional images
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Add content

Add an entry to `data/certificates.json` or `data/projects.json`. Only `title` is required; `link`, `image`, `date` and `tags` are optional. A certificate also takes `issuer` and `field` (e.g. `"IC Design"`, `"Data"`, `"Electronic"`, `"Embedded"`, or a list of them); the Certificates page filters by issuer and by field. See [GUIDE.md](GUIDE.md) for the full field list.

## Add a blog post

Add an object to `data/blog.json`. Posts are sorted by `date` (newest first); two posts with the same date are ordered by position in the file, the later one counts as newer. General shows the latest 3.

```json
{
  "title": "Post title",
  "date": "2026-11-15",
  "summary": "Optional. Short text for the card (defaults to the start of the first paragraph).",
  "cover": "blog/cover.jpg",
  "content": [
    "A paragraph. Use \n for a line break inside it.",
    { "heading": "A section heading" },
    { "image": "blog/photo1.jpg", "caption": "Italic caption shown under the image" },
    "Another paragraph."
  ]
}
```

- Required: `title`, `date` (`YYYY-MM-DD`). Optional: `summary`, `cover` (defaults to the first image in the post), `id` (link name, defaults to date + title).
- `content` is a list of blocks: a string is a paragraph, `{ "heading" }` is a heading, `{ "image", "caption" }` is an image. Use as many images as you like; `caption` is optional.
- Put images in `blog/` and refer to them as `blog/<file>`.

## Contact

[GitHub](https://github.com/HungVulkan) · [LinkedIn](https://www.linkedin.com/in/quochungvu2309/) · [Facebook](https://www.facebook.com/vqhhcmus) · vqhung2309@outlook.com
