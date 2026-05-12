#!/usr/bin/env python3
"""Scrape planninepictures.com for images (img/srcset/background-image) and download to assets/."""
import os
import re
import sys
import hashlib
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://planninepictures.com"
OUT_DIR = Path(__file__).resolve().parent / "assets"
OUT_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

IMAGE_EXT_RE = re.compile(r"\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff?)(\?.*)?$", re.IGNORECASE)
CSS_URL_RE = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", re.IGNORECASE)

session = requests.Session()
session.headers.update(HEADERS)

found_urls = set()


def is_image_url(url: str) -> bool:
    path = urlparse(url).path
    return bool(IMAGE_EXT_RE.search(path))


def normalize(url: str, base: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if url.startswith("data:") or url.startswith("javascript:"):
        return ""
    return urljoin(base, url)


def harvest_srcset(value: str, base: str):
    for part in value.split(","):
        candidate = part.strip().split()
        if candidate:
            yield normalize(candidate[0], base)


def parse_html(html: str, base: str):
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(["img", "source"]):
        for attr in ("src", "data-src", "data-lazy-src", "data-original", "data-bg", "data-background"):
            v = tag.get(attr)
            if v:
                u = normalize(v, base)
                if u:
                    found_urls.add(u)
        for attr in ("srcset", "data-srcset"):
            v = tag.get(attr)
            if v:
                for u in harvest_srcset(v, base):
                    if u:
                        found_urls.add(u)

    for tag in soup.find_all(style=True):
        for m in CSS_URL_RE.finditer(tag["style"]):
            u = normalize(m.group(1), base)
            if u and is_image_url(u):
                found_urls.add(u)

    for link in soup.find_all("link", rel=True):
        rels = [r.lower() for r in link.get("rel", [])]
        href = link.get("href")
        if not href:
            continue
        if any(r in ("icon", "apple-touch-icon", "shortcut icon", "mask-icon") for r in rels):
            u = normalize(href, base)
            if u:
                found_urls.add(u)
        if any(r in ("preload",) for r in rels) and link.get("as") == "image":
            u = normalize(href, base)
            if u:
                found_urls.add(u)

    for meta in soup.find_all("meta"):
        prop = (meta.get("property") or meta.get("name") or "").lower()
        if prop in ("og:image", "twitter:image", "og:image:url", "og:image:secure_url"):
            content = meta.get("content")
            if content:
                u = normalize(content, base)
                if u:
                    found_urls.add(u)

    css_links = []
    for link in soup.find_all("link", rel=True):
        rels = [r.lower() for r in link.get("rel", [])]
        if "stylesheet" in rels and link.get("href"):
            css_links.append(normalize(link["href"], base))

    inline_css = "\n".join(s.get_text() or "" for s in soup.find_all("style"))
    return css_links, inline_css


def parse_css(css_text: str, base: str):
    for m in CSS_URL_RE.finditer(css_text):
        raw = m.group(1)
        u = normalize(raw, base)
        if u and is_image_url(u):
            found_urls.add(u)


def fetch(url: str, allow_binary=False):
    try:
        r = session.get(url, timeout=30, allow_redirects=True)
        r.raise_for_status()
        return r
    except requests.RequestException as e:
        print(f"  ! fetch failed: {url}  ({e})", file=sys.stderr)
        return None


def safe_filename(url: str) -> str:
    parsed = urlparse(url)
    name = unquote(os.path.basename(parsed.path)) or "asset"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    if parsed.query:
        h = hashlib.sha1(parsed.query.encode()).hexdigest()[:8]
        stem, _, ext = name.rpartition(".")
        if stem:
            name = f"{stem}__{h}.{ext}"
        else:
            name = f"{name}__{h}"
    return name


def download(url: str):
    target = OUT_DIR / safe_filename(url)
    if target.exists() and target.stat().st_size > 0:
        print(f"  - skip (exists): {target.name}")
        return
    r = fetch(url)
    if r is None:
        return
    ctype = r.headers.get("content-type", "").lower()
    if "html" in ctype:
        print(f"  ! skipped HTML response: {url}")
        return
    target.write_bytes(r.content)
    print(f"  + {target.name}  ({len(r.content):,} bytes)")


def crawl_pages():
    visited = set()
    queue = [BASE_URL + "/"]
    while queue:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        print(f"\n[page] {url}")
        r = fetch(url)
        if r is None or "html" not in r.headers.get("content-type", "").lower():
            continue
        css_links, inline_css = parse_html(r.text, url)
        parse_css(inline_css, url)
        for css_url in css_links:
            cr = fetch(css_url)
            if cr is not None:
                parse_css(cr.text, css_url)

        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = normalize(a["href"], url)
            if not href:
                continue
            p = urlparse(href)
            if p.netloc and p.netloc not in ("planninepictures.com", "www.planninepictures.com"):
                continue
            if p.fragment or p.path.lower().endswith((".pdf", ".zip", ".mp4", ".mov")):
                continue
            clean = f"{p.scheme}://{p.netloc}{p.path}"
            if clean not in visited and len(visited) < 30:
                queue.append(clean)


def main():
    crawl_pages()
    print(f"\nDiscovered {len(found_urls)} candidate image URLs.")
    image_urls = sorted(u for u in found_urls if is_image_url(u))
    print(f"After filtering for image extensions: {len(image_urls)}\n")
    for u in image_urls:
        download(u)
    print(f"\nDone. Files in {OUT_DIR}")


if __name__ == "__main__":
    main()
