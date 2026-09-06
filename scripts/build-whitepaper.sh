#!/usr/bin/env bash
# Render the Commerce Protocol design rationale to the published PDF.
# Needs npx, Google Chrome and python3; run it after editing the source Markdown.
#
# The renderer versions are pinned because this PDF is a versioned publication:
# an unpinned Markdown or Mermaid release would silently change its layout and
# pagination. Chrome is the host's; version 152.0.7977.77 produced the
# committed 12-page PDF. If pagination shifts after a Chrome update, that is
# why.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/specs/commerce-protocol/DESIGN.md"
rel_out="packages/docs/public/commerce-protocol-rationale.pdf"
out="$root/$rel_out"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$chrome" ] || { echo "Chrome not found at $chrome; set CHROME" >&2; exit 1; }

# Render from copies, and hash those exact bytes instead of re-reading the
# working tree afterwards: a file saved while the build runs would otherwise be
# recorded as the source of a PDF built from the older content.
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
cp "$root/scripts/whitepaper.css" "$work/style.css"
cp "$root/scripts/mermaid.json" "$work/mermaid.json"
cp "$root/scripts/build-whitepaper.sh" "$work/builder.sh"

# Mermaid fences become inline SVG before Markdown conversion, so the same
# source renders as diagrams on GitHub and in the PDF.
python3 - "$src" "$work/src.md" "$work" "$work/mermaid.json" \
  "$work/builder.sh" <<'PYEOF'
import hashlib, re, subprocess, sys, pathlib
src, out, work, config, builder = (pathlib.Path(a) for a in sys.argv[1:6])
source_bytes = src.read_bytes()
text = source_bytes.decode()
def render(match, counter=[0]):
    counter[0] += 1
    n = counter[0]
    mmd = work / f"fig{n}.mmd"; svg = work / f"fig{n}.svg"
    mmd.write_text(match.group(1))
    subprocess.run(["npx", "--yes", "@mermaid-js/mermaid-cli@11.17.0", "-i", str(mmd),
                    "-o", str(svg), "-c", str(config), "-b", "transparent"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    body = svg.read_text()
    body = body[body.index("<svg"):]
    return f'<figure class="mermaid">{body}</figure>'
text = re.sub(r"```mermaid\n(.*?)\n```", render, text, flags=re.S)

# Relative Markdown links are correct on GitHub but resolve to the temporary
# build directory in the PDF. Point them at the repository on the default
# branch so a reader of the PDF can follow them.
BLOB = "https://github.com/hyodotdev/openiap/blob/main"
here = "specs/commerce-protocol"
rewritten = 0
def relink(match):
    global rewritten
    label, target = match.group(1), match.group(2)
    # A scheme (http:, mailto:, …), a network-path reference (//host/x) or an
    # in-document anchor is already absolute and must be left alone.
    if re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", target) or target.startswith(("//", "#")):
        return match.group(0)
    anchor = ""
    if "#" in target:
        target, anchor = target.split("#", 1)
        anchor = "#" + anchor
    rewritten += 1
    joined = pathlib.PurePosixPath(here, target)
    parts = []
    for part in joined.parts:
        if part == "..":
            if parts:
                parts.pop()
        elif part != ".":
            parts.append(part)
    return f"[{label}]({BLOB}/{'/'.join(parts)}{anchor})"
text = re.sub(r"\[([^\]]+)\]\(([^)]+\.md[^)]*)\)", relink, text)
plural = "" if rewritten == 1 else "s"
print(f"  rewrote {rewritten} relative link{plural} for the PDF", file=sys.stderr)
out.write_text(text)
marker = '<figure class="mermaid">'
print(f"  rendered {text.count(marker)} diagrams", file=sys.stderr)

# The bytes this build read, named by their repository path. The PDF's own hash
# is appended once Chrome has written it.
inputs = [
    ("specs/commerce-protocol/DESIGN.md", source_bytes),
    ("scripts/whitepaper.css", (work / "style.css").read_bytes()),
    ("scripts/mermaid.json", config.read_bytes()),
    ("scripts/build-whitepaper.sh", builder.read_bytes()),
]
(work / "inputs.sha256").write_text(
    "".join(f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in inputs)
)
PYEOF

npx --yes marked@18.0.11 -i "$work/src.md" -o "$work/body.html" --gfm
{
  printf '%s\n' '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  printf '%s\n' '<title>Why the Commerce Protocol Draws Its Boundaries Where It Does</title>'
  printf '%s\n' '<link rel="stylesheet" href="style.css"></head><body>'
  cat "$work/body.html"
  printf '%s\n' '</body></html>'
} > "$work/page.html"

# Render privately, then publish. Chrome failing halfway leaves the committed
# PDF untouched, and the manifest can only describe this build's own bytes.
"$chrome" --headless --disable-gpu --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=8000 \
  --print-to-pdf="$work/out.pdf" "file://$work/page.html" 2>/dev/null

# `bun audit:whitepaper` compares this manifest against the working tree, so a
# source edit without a rebuild — or a rebuilt PDF that never got committed —
# fails a check instead of publishing a stale document.
python3 - "$work/inputs.sha256" "$work/out.pdf" "$out" "$rel_out" \
  "$root/scripts/whitepaper.sha256" <<'PYEOF'
import hashlib, pathlib, sys
inputs, rendered, published, rel_out, manifest = sys.argv[1:6]
data = pathlib.Path(rendered).read_bytes()
digest = hashlib.sha256(data).hexdigest()
pathlib.Path(published).write_bytes(data)
if hashlib.sha256(pathlib.Path(published).read_bytes()).hexdigest() != digest:
    sys.exit(f"{published} changed as it was written — is another build running?")
pathlib.Path(manifest).write_text(
    pathlib.Path(inputs).read_text() + f"{digest}  {rel_out}\n"
)
PYEOF
echo "wrote $out"
echo "wrote $root/scripts/whitepaper.sha256"
