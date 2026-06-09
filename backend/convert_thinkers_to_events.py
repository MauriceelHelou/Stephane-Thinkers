#!/usr/bin/env python3
"""
Mass-convert Thinkers that were mistakenly created as Timeline Events back into
real Timeline Events, via the deployed (Railway) API.

Safe by default: runs in DRY-RUN mode and changes nothing until you pass --apply.

Usage:
    # 1. Configure (Railway backend URL + site password if AUTH_REQUIRED=true)
    export API_URL="https://your-backend.up.railway.app"
    export SITE_PASSWORD="..."          # omit if auth is disabled

    # 2. Preview what WOULD happen (no writes):
    python convert_thinkers_to_events.py --timeline-id <TIMELINE_UUID>

    # 3. Convert for real:
    python convert_thinkers_to_events.py --timeline-id <TIMELINE_UUID> --apply

Selection options (combine as needed):
    --timeline-id UUID   Only thinkers on this timeline (recommended).
    --names-file PATH    Only thinkers whose name matches a line in this file.
    --all                Every thinker in the DB (dangerous; requires no other filter).

Other options:
    --event-type TYPE    Default 'other'. One of:
                         council|publication|war|invention|cultural|political|other
    --apply              Actually create events + delete thinkers.
    --keep-thinkers      Create events but do NOT delete the original thinkers.
"""
import argparse
import os
import sys

import requests

VALID_EVENT_TYPES = [
    "council", "publication", "war", "invention",
    "cultural", "political", "other",
]


def get_token(api_url: str) -> str | None:
    """Log in if auth is required; returns a bearer token or None."""
    check = requests.get(f"{api_url}/api/auth/check", timeout=30)
    check.raise_for_status()
    if not check.json().get("auth_required"):
        return None
    password = os.environ.get("SITE_PASSWORD")
    if not password:
        sys.exit("Auth is required but SITE_PASSWORD env var is not set.")
    resp = requests.post(f"{api_url}/api/auth/login", json={"password": password}, timeout=30)
    if resp.status_code != 200:
        sys.exit(f"Login failed ({resp.status_code}): {resp.text}")
    return resp.json().get("token")


def fetch_thinkers(api_url: str, headers: dict, timeline_id: str | None) -> list[dict]:
    """Page through all thinkers (optionally filtered by timeline)."""
    out, skip, limit = [], 0, 100
    while True:
        params = {"skip": skip, "limit": limit}
        if timeline_id:
            params["timeline_id"] = timeline_id
        resp = requests.get(f"{api_url}/api/thinkers/", headers=headers, params=params, timeout=60)
        resp.raise_for_status()
        batch = resp.json()
        out.extend(batch)
        if len(batch) < limit:
            break
        skip += limit
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--timeline-id")
    parser.add_argument("--names-file")
    parser.add_argument("--exclude-names-file",
                        help="Names (one per line) to LEAVE as thinkers, e.g. real people.")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--event-type", default="other", choices=VALID_EVENT_TYPES)
    parser.add_argument("--year-field", default="birth_year",
                        choices=["birth_year", "anchor_year"],
                        help="Which field becomes the event year. Default birth_year "
                             "(the real start year); anchor_year is a canvas-position artifact.")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--keep-thinkers", action="store_true")
    args = parser.parse_args()

    api_url = os.environ.get("API_URL", "").rstrip("/")
    if not api_url:
        sys.exit("Set the API_URL env var to your Railway backend URL.")

    if not (args.timeline_id or args.names_file or args.all):
        sys.exit("Pick a selection: --timeline-id, --names-file, or --all.")

    token = get_token(api_url)
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    thinkers = fetch_thinkers(api_url, headers, args.timeline_id)

    if args.names_file:
        with open(args.names_file, encoding="utf-8") as f:
            wanted = {line.strip() for line in f if line.strip()}
        thinkers = [t for t in thinkers if t["name"] in wanted]

    if args.exclude_names_file:
        with open(args.exclude_names_file, encoding="utf-8") as f:
            excluded = {line.strip() for line in f if line.strip()}
        before = len(thinkers)
        thinkers = [t for t in thinkers if t["name"] not in excluded]
        print(f"Excluding {before - len(thinkers)} thinker(s) by name (kept as thinkers).\n")

    if not thinkers:
        print("No matching thinkers found. Nothing to do.")
        return

    mode = "APPLY" if args.apply else "DRY-RUN (no changes)"
    print(f"=== {mode} === {len(thinkers)} thinker(s) selected\n")

    created = deleted = skipped = 0
    for t in thinkers:
        tid = t["id"]
        tl = t.get("timeline_id")
        # Prefer the chosen field, fall back to the other if it's missing.
        other_field = "anchor_year" if args.year_field == "birth_year" else "birth_year"
        year = t.get(args.year_field)
        if year is None:
            year = t.get(other_field)
        if not tl:
            print(f"  SKIP  '{t['name']}' — no timeline_id (events require one).")
            skipped += 1
            continue
        if year is None:
            print(f"  SKIP  '{t['name']}' — no anchor_year/birth_year to use as year.")
            skipped += 1
            continue

        payload = {
            "timeline_id": tl,
            "name": t["name"],
            "year": year,
            "event_type": args.event_type,
            "description": t.get("biography_notes"),
        }

        if not args.apply:
            print(f"  WOULD create event: {payload['name']} ({year}) [{args.event_type}]"
                  f"{'' if args.keep_thinkers else ' + delete thinker'}")
            continue

        resp = requests.post(f"{api_url}/api/timeline-events/", headers=headers, json=payload, timeout=60)
        if resp.status_code != 201:
            print(f"  FAIL  create '{t['name']}' ({resp.status_code}): {resp.text}")
            skipped += 1
            continue
        created += 1
        print(f"  OK    created event '{t['name']}' ({year})")

        if not args.keep_thinkers:
            d = requests.delete(f"{api_url}/api/thinkers/{tid}", headers=headers, timeout=60)
            if d.status_code not in (200, 204):
                print(f"  WARN  event created but delete thinker failed ({d.status_code}): {d.text}")
            else:
                deleted += 1

    print(f"\nDone. created={created} deleted={deleted} skipped={skipped}")
    if not args.apply:
        print("This was a DRY RUN. Re-run with --apply to perform the conversion.")


if __name__ == "__main__":
    main()
