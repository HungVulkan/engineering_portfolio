# Portfolio · Vũ Quốc Hùng

Personal portfolio of a 3rd-year Electronics and Communication Engineering student at VNU-HCMUS. Focus: embedded systems, hardware, Edge AI / TinyML and RTOS.

**Pages:** General · Certificates · Projects

## Tech

Plain HTML, CSS and JavaScript. No build step. Certificates and projects are loaded from JSON files and sorted newest first.

## Structure

```
index.html            General page
certificates.html     All certificates
projects.html         All projects
assets/               style.css, app.js
data/                 certificates.json, projects.json
certs/, projects/     Optional images
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Add content

Add an entry to `data/certificates.json` or `data/projects.json`. Only `title` is required; `link`, `image`, `date` and `tags` are optional. See [GUIDE.md](GUIDE.md) for the full field list.
