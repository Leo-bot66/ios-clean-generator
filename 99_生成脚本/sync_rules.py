"""Update existing, licensed module sources; never execute upstream scripts.

Every repository is pinned to a commit for the whole run. Downloads, parsing,
coverage and referenced-script checks must pass before replacing the snapshot.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import copy
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "01_网站源码" / "site"
DATA = SITE / "data" / "modules.json"
CONFIG = Path(__file__).with_name("upstreams.json")
SECTION = re.compile(r"^\[([^\]]+)\]\s*$")
ALLOWED = {"General", "Host", "Rule", "URL Rewrite", "Header Rewrite",
           "Body Rewrite", "Map Local", "Script", "MITM"}


def get(url: str) -> bytes:
    headers = {"User-Agent": "ios-clean-generator-rule-maintenance", "Accept": "*/*"}
    if urllib.parse.urlparse(url).netloc == "api.github.com" and os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
                content = response.read(2_000_001)
                if not content or len(content) > 2_000_000:
                    raise ValueError("empty or oversized upstream response")
                return content
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError("download failed")


def parse_module(text: str) -> tuple[dict, dict]:
    if text.lstrip().lower().startswith(("<!doctype", "<html", "{\"message\"")):
        raise ValueError("HTML/API error returned instead of a module")
    meta, sections, current = {}, {}, None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        match = SECTION.fullmatch(line)
        if match:
            current = match[1]
            if current not in ALLOWED:
                raise ValueError(f"unsupported section: {current}")
            sections.setdefault(current, [])
        elif current is None:
            if line.startswith("#!"):
                key, _, value = line[2:].partition("=")
                meta[key.strip()] = value.strip()
        else:
            sections[current].append(line)
    sections = {key: lines for key, lines in sections.items() if lines}
    if not sections:
        raise ValueError("module has no recognized sections")
    return meta, sections


def rule_count(sections: dict) -> int:
    return sum(1 for name, lines in sections.items() if name != "MITM"
               for line in lines if not line.startswith(("#", "//", ";")))


def references(sections: dict) -> set[str]:
    urls = set()
    for lines in sections.values():
        for line in lines:
            if line.startswith(("#", "//", ";")):
                continue
            for url in re.findall(r'https://[^\s,\"\'<>]+', line):
                # Only actual external resources, not interception URL patterns.
                if "\\" in url or any(c in url for c in ("^", "$", "(", ")", "*")):
                    continue
                if urllib.parse.urlparse(url).netloc in {"raw.githubusercontent.com", "github.com", "cdn.jsdelivr.net"}:
                    urls.add(url)
    return urls


def source_path(source: dict, cfg: dict, mapping: dict) -> str:
    override = cfg["overrides"].get(source["raw"])
    if override:
        return override
    repo = cfg["repositories"][source["name"]]
    if source["name"] == "奶思":
        return repo["modulePrefix"] + source["raw"].split("/", 1)[1]
    path = mapping.get(source["raw"], "")
    if not path.startswith(repo["prefix"]):
        raise ValueError("source missing from provenance CSV: " + source["raw"])
    return path[len(repo["prefix"]):]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--skip-links", action="store_true", help="diagnostics only; cannot write snapshot")
    args = parser.parse_args()
    if args.skip_links and not args.check_only:
        parser.error("--skip-links requires --check-only")
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    old = json.loads(DATA.read_text(encoding="utf-8"))
    result = copy.deepcopy(old)
    with (ROOT / "06_许可与合规" / "文件来源清单.csv").open(encoding="utf-8-sig", newline="") as stream:
        mapping = {row["目标路径"]: row["上游仓库路径"] for row in csv.DictReader(stream)}
    versions = {}
    for name, repo in cfg["repositories"].items():
        commit = json.loads(get(f"https://api.github.com/repos/{repo['repo']}/commits/{repo['branch']}"))
        versions[name] = {"repository": repo["repo"], "commit": commit["sha"],
                          "committedAt": commit["commit"]["committer"]["date"]}
        print(f"Pinned {name}: {commit['sha'][:12]}", flush=True)
    failures, changed, dependencies = [], [], set()
    targets = [(app, source) for app in result["apps"] for source in app["sources"]]

    def update(target: tuple) -> tuple:
        app, source = target
        repo = versions[source["name"]]
        path = source_path(source, cfg, mapping)
        url = f"https://raw.githubusercontent.com/{repo['repository']}/{repo['commit']}/{urllib.parse.quote(path)}"
        content = get(url)
        meta, sections = parse_module(content.decode("utf-8-sig"))
        if not rule_count(sections) and rule_count(source["sections"]):
            raise ValueError("upstream withdrew active rules; manual review required")
        if rule_count(sections) < rule_count(source["sections"]) * 0.4:
            raise ValueError("active rules dropped by more than 60%; manual review required")
        updated = {**source, "sections": sections, "url": url, "commit": repo["commit"],
                   "sha256": hashlib.sha256(content).hexdigest()}
        for field, key in (("args", "arguments"), ("argsDesc", "arguments-desc")):
            updated.pop(field, None)
            if meta.get(key):
                updated[field] = meta[key]
        did_change = any(updated.get(key) != source.get(key) for key in ("sections", "args", "argsDesc"))
        return app, source, updated, did_change

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(update, target): target for target in targets}
        for job in concurrent.futures.as_completed(jobs):
            app, source = jobs[job]
            try:
                _, _, updated, did_change = job.result()
                dependencies.update(references(updated["sections"]))
                source.clear()
                source.update(updated)
                if did_change:
                    changed.append(f"{app['id']} / {source['name']}")
            except Exception as error:
                failures.append(f"{app['id']} / {source['name']}: {error}")
            print(f"Checked {app['id']} / {source['name']}", flush=True)
    if not args.skip_links:
        def check_link(url: str) -> None:
            text = get(url).decode("utf-8-sig")
            if text.lstrip().lower().startswith(("<!doctype", "<html")):
                raise ValueError("HTML error instead of script/rules")
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            jobs = {pool.submit(check_link, url): url for url in sorted(dependencies)}
            for job in concurrent.futures.as_completed(jobs):
                try:
                    job.result()
                except Exception as error:
                    failures.append(f"dependency {jobs[job]}: {error}")
    for failure in failures:
        print("ERROR: " + failure)
    print(f"Sources: {len(targets)}, changed: {len(changed)}, external resources: {len(dependencies)}, errors: {len(failures)}")
    print("\n".join(sorted(changed)))
    if failures:
        print("Previous snapshot retained; no data was written.")
        return 1
    previous_status = SITE / "data" / "rule-status.json"
    previous = json.loads(previous_status.read_text(encoding="utf-8")) if previous_status.exists() else {}
    version_changed = versions != previous.get("upstreams")
    updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds") if changed or version_changed else previous["updatedAt"]
    result["updatedAt"] = updated_at
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    result["checkedAt"] = checked_at
    for app in result["apps"]:
        app["available"] = any(rule_count(source["sections"]) for source in app["sources"])
    status = {"updatedAt": updated_at, "checkedAt": checked_at, "apps": len(result["apps"]), "sources": len(targets),
              "availableApps": sum(app["available"] for app in result["apps"]),
              "externalResources": len(dependencies), "upstreams": versions,
              "validation": "modules parsed and referenced resources reachable; device behavior not verified"}
    if not args.check_only:
        # All remote reads complete before any snapshot is replaced.
        DATA.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        previous_status.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("Snapshot updated successfully: " + updated_at)
    return 0


if __name__ == "__main__":
    sys.exit(main())
