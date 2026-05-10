#!/bin/bash
# Fix an exported Godot iOS Xcode project so GodotIap frameworks are embedded
# as framework bundles and retain their Info.plist files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DEFAULT_ADDON_SOURCE_DIR="$PROJECT_ROOT/addons/godot-iap"
if [ ! -d "$DEFAULT_ADDON_SOURCE_DIR/bin/ios" ] && [ -d "$PROJECT_ROOT/bin/ios" ]; then
    DEFAULT_ADDON_SOURCE_DIR="$PROJECT_ROOT"
fi

DEFAULT_IOS_EXPORT_DIR="$PROJECT_ROOT/Example/ios"
if [ ! -d "$DEFAULT_IOS_EXPORT_DIR" ] && [ -d "$PROJECT_ROOT/../.." ]; then
    DEFAULT_IOS_EXPORT_DIR="$(cd "$PROJECT_ROOT/../.." && pwd)/ios"
fi

IOS_EXPORT_DIR="${IOS_EXPORT_DIR:-$DEFAULT_IOS_EXPORT_DIR}"
ADDON_SOURCE_DIR="${GODOT_IAP_ADDON_DIR:-$DEFAULT_ADDON_SOURCE_DIR}"
XCODEPROJ="${XCODEPROJ:-}"

if [ -z "$XCODEPROJ" ]; then
    XCODEPROJS=()
    while IFS= read -r project; do
        XCODEPROJS+=("$project")
    done < <(find "$IOS_EXPORT_DIR" -maxdepth 1 -name "*.xcodeproj" -type d | sort)

    if [ "${#XCODEPROJS[@]}" -gt 1 ]; then
        echo "Error: multiple .xcodeproj files found in $IOS_EXPORT_DIR:" >&2
        printf '  %s\n' "${XCODEPROJS[@]}" >&2
        echo "Set XCODEPROJ=/path/to/App.xcodeproj to disambiguate." >&2
        exit 1
    fi

    XCODEPROJ="${XCODEPROJS[0]:-}"
fi

if [ -z "$XCODEPROJ" ] || [ ! -d "$XCODEPROJ" ]; then
    echo "Error: .xcodeproj not found in $IOS_EXPORT_DIR"
    echo "Set XCODEPROJ=/path/to/App.xcodeproj or IOS_EXPORT_DIR=/path/to/export."
    exit 1
fi

PBXPROJ="$XCODEPROJ/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
    echo "Error: project.pbxproj not found at $PBXPROJ"
    exit 1
fi

copy_framework_plists() {
    for framework in GodotIap SwiftGodotRuntime; do
        local source_plist="$ADDON_SOURCE_DIR/bin/ios/$framework.framework/Info.plist"

        if [ ! -f "$source_plist" ]; then
            echo "Warning: source Info.plist not found: $source_plist"
            continue
        fi

        local copied=0
        while IFS= read -r framework_dir; do
            cp "$source_plist" "$framework_dir/Info.plist"
            copied=1
        done < <(find "$IOS_EXPORT_DIR" -type d -path "*/addons/godot-iap/bin/ios/$framework.framework" 2>/dev/null)

        if [ "$copied" -eq 0 ]; then
            echo "Warning: exported $framework.framework not found under $IOS_EXPORT_DIR"
        fi
    done
}

echo "Fixing iOS project: $XCODEPROJ"
copy_framework_plists

# Backup original once per run.
cp "$PBXPROJ" "$PBXPROJ.backup"

export PBXPROJ
python3 <<'PY'
import hashlib
import os
import re
import sys

pbxproj = os.environ["PBXPROJ"]
frameworks = ["GodotIap", "SwiftGodotRuntime"]

with open(pbxproj, "r", encoding="utf-8") as file:
    content = file.read()


def find_framework_ref(framework_name):
    patterns = [
        rf"([A-F0-9]{{24}}|\w+)\s*/\*\s*{framework_name}\.framework\s*\*/\s*=\s*\{{isa\s*=\s*PBXFileReference;[^}}]*\}};",
        rf"([A-F0-9]{{24}}|\w+)\s*=\s*\{{isa\s*=\s*PBXFileReference;[^}}]*{framework_name}\.framework(?:/{framework_name})?[^}}]*\}};",
    ]

    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            return match.group(1)
    return None


def normalize_framework_reference(text, framework_name):
    text = re.sub(
        rf'(path\s*=\s*"[^"]*{framework_name}\.framework)/{framework_name}"',
        r'\1"',
        text,
    )
    text = re.sub(
        rf"(lastKnownFileType\s*=\s*)file(\s*;[^}}]*{framework_name}\.framework(?=[\"\s;]))",
        r"\1wrapper.framework\2",
        text,
    )
    text = re.sub(
        rf"(explicitFileType\s*=\s*)file(\s*;[^}}]*{framework_name}\.framework(?=[\"\s;]))",
        r"\1wrapper.framework\2",
        text,
    )
    return text


def remove_pbx_list_item(block, item_id):
    item_pattern = re.compile(
        rf"^[ \t]*{item_id}(?:\s*/\*[^*]*\*/)?\s*,?\s*$"
    )
    return "".join(
        line
        for line in block.splitlines(keepends=True)
        if not item_pattern.match(line.rstrip("\r\n"))
    )


framework_refs = {}
for framework in frameworks:
    content = normalize_framework_reference(content, framework)
    ref = find_framework_ref(framework)
    if ref:
        framework_refs[framework] = ref

missing = [framework for framework in frameworks if framework not in framework_refs]
if missing:
    print(
        "Warning: framework references not found in Xcode project: "
        + ", ".join(f"{framework}.framework" for framework in missing)
    )
    print("Enable the GodotIap plugin in the iOS export preset and export again.")
    with open(pbxproj, "w", encoding="utf-8") as file:
        file.write(content)
    sys.exit(0)

embed_phase_match = re.search(
    r"([A-F0-9]{24}|\w+)\s*/\*\s*Embed Frameworks\s*\*/\s*=\s*\{.*?isa\s*=\s*PBXCopyFilesBuildPhase;.*?\n\t\t\};",
    content,
    re.DOTALL,
)

if not embed_phase_match:
    print("Error: Could not find Embed Frameworks build phase")
    sys.exit(1)

embed_phase_block = embed_phase_match.group(0)
build_entries = []
embed_entries = []


def embedded_build_file_id(ref):
    build_file_pattern = re.compile(
        rf"([A-F0-9]{{24}}|\w+)\s*(?:/\*[^*]*\*/\s*)?=\s*\{{isa\s*=\s*PBXBuildFile;\s*fileRef\s*=\s*{ref};[^}}]*\}};",
        re.DOTALL,
    )

    fallback_id = None
    for match in build_file_pattern.finditer(content):
        build_id = match.group(1)
        block = match.group(0)
        if build_id not in embed_phase_block:
            continue
        fallback_id = build_id
        if "CodeSignOnCopy" in block:
            return build_id
    return fallback_id


for framework, ref in framework_refs.items():
    embed_id = embedded_build_file_id(ref)
    build_comment = f"{framework}.framework in Embed Frameworks"

    if not embed_id:
        embed_id = hashlib.md5(f"{ref}_embed".encode()).hexdigest().upper()[:24]
        build_entries.append(
            f"\t\t{embed_id} /* {build_comment} */ = "
            f"{{isa = PBXBuildFile; fileRef = {ref}; "
            "settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; }};\n"
        )

    if embed_id not in embed_phase_block:
        embed_entries.append(f"\t\t\t\t{embed_id} /* {build_comment} */,\n")

if build_entries:
    content = content.replace(
        "/* Begin PBXBuildFile section */\n",
        "/* Begin PBXBuildFile section */\n" + "".join(build_entries),
        1,
    )

if embed_entries:
    files_match = re.search(r"files\s*=\s*\(\n?(.*?)\n?\s*\);", embed_phase_block, re.DOTALL)
    if not files_match:
        print("Error: Could not find files list in Embed Frameworks build phase")
        sys.exit(1)

    files_start, files_end = files_match.span(1)
    current_files = files_match.group(1)
    separator = "" if current_files.endswith("\n") or not current_files.strip() else "\n"
    updated_files = current_files + separator + "".join(embed_entries)
    updated_embed_phase_block = (
        embed_phase_block[:files_start] + updated_files + embed_phase_block[files_end:]
    )
    content = content.replace(embed_phase_block, updated_embed_phase_block, 1)


def remove_duplicate_framework_links(text):
    framework_phase_match = re.search(
        r"([A-F0-9]{24}|\w+)\s*/\*\s*Frameworks\s*\*/\s*=\s*\{.*?isa\s*=\s*PBXFrameworksBuildPhase;.*?\n\t\t\};",
        text,
        re.DOTALL,
    )
    if not framework_phase_match:
        return text

    framework_phase_block = framework_phase_match.group(0)
    file_refs = {}
    for match in re.finditer(
        r"^\s*([A-F0-9]{24}|\w+)\s*(?:/\*[^*]*\*/\s*)?=\s*\{isa\s*=\s*PBXFileReference;(.*?)\};",
        text,
        re.MULTILINE,
    ):
        file_refs[match.group(1)] = match.group(2)

    build_files = {}
    for match in re.finditer(
        r"^\s*([A-F0-9]{24}|\w+)\s*(?:/\*[^*]*\*/\s*)?=\s*\{isa\s*=\s*PBXBuildFile;\s*fileRef\s*=\s*([A-F0-9]{24}|\w+);.*?\};",
        text,
        re.MULTILINE,
    ):
        build_files[match.group(1)] = match.group(2)

    duplicate_build_ids = []
    duplicate_file_refs = []
    for framework, canonical_ref in framework_refs.items():
        linked_ids = [
            build_id
            for build_id, ref in build_files.items()
            if build_id in framework_phase_block
            and f"{framework}.framework" in file_refs.get(ref, "")
        ]
        if len(linked_ids) <= 1:
            continue

        keep_id = next(
            (build_id for build_id in linked_ids if build_files[build_id] == canonical_ref),
            linked_ids[0],
        )
        for build_id in linked_ids:
            if build_id == keep_id:
                continue
            duplicate_build_ids.append(build_id)
            duplicate_file_refs.append(build_files[build_id])

    if not duplicate_build_ids:
        return text

    updated_framework_phase_block = framework_phase_block
    for build_id in duplicate_build_ids:
        updated_framework_phase_block = remove_pbx_list_item(
            updated_framework_phase_block, build_id
        )

    text = text.replace(framework_phase_block, updated_framework_phase_block, 1)
    for build_id in duplicate_build_ids:
        text = re.sub(
            rf"^\s*{build_id}\s*(?:/\*[^*]*\*/\s*)?=\s*\{{isa\s*=\s*PBXBuildFile;\s*fileRef\s*=\s*([A-F0-9]{{24}}|\w+);.*?\}};\n",
            "",
            text,
            flags=re.MULTILINE,
        )

    def remove_ref_from_groups(project_text, ref):
        def replace_group(match):
            group_block = match.group(0)
            if ref not in group_block:
                return group_block
            return remove_pbx_list_item(group_block, ref)

        return re.sub(
            r"^\s*([A-F0-9]{24}|\w+)\s*(?:/\*[^*]*\*/\s*)?=\s*\{[^}]*isa\s*=\s*PBXGroup;.*?\n\t\t\};",
            replace_group,
            project_text,
            flags=re.MULTILINE | re.DOTALL,
        )

    for ref in duplicate_file_refs:
        if ref in framework_refs.values():
            continue
        text = remove_ref_from_groups(text, ref)
        text = re.sub(
            rf"^\s*{ref}\s*(?:/\*[^*]*\*/\s*)?=\s*\{{isa\s*=\s*PBXFileReference;.*?\}};\n",
            "",
            text,
            flags=re.MULTILINE,
        )
    return text


content = remove_duplicate_framework_links(content)

with open(pbxproj, "w", encoding="utf-8") as file:
    file.write(content)

print("Framework embedding fixed.")
PY

echo "Framework Info.plist files copied."
