#!/usr/bin/env bash
set -euo pipefail

# Post-process Types.kt after it's copied from gql package

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_FILE="${REPO_ROOT}/openiap/src/main/java/dev/hyo/openiap/Types.kt"

if [[ ! -f "$TARGET_FILE" ]]; then
  echo "⚠️  Types.kt not found at $TARGET_FILE"
  exit 0
fi

echo "🔧 Post-processing Types.kt..."

TARGET_FILE="${TARGET_FILE}" python3 <<'PY'
from pathlib import Path
import os
import re

target = Path(os.environ["TARGET_FILE"])
text = target.read_text()

lines = text.splitlines()

def first_index(predicate):
    for idx, line in enumerate(lines):
        if predicate(line):
            return idx
    return None

# Fix package declaration
package_idx = first_index(lambda line: line.startswith('package '))
annotation_indices = [idx for idx, line in enumerate(lines) if line.startswith('@file:')]

if package_idx is None:
    insert_idx = annotation_indices[0] + 1 if annotation_indices else 0
    lines.insert(insert_idx, 'package dev.hyo.openiap')
    package_idx = insert_idx
else:
    lines[package_idx] = 'package dev.hyo.openiap'

if annotation_indices and annotation_indices[0] > package_idx:
    annotation_block = [lines[idx] for idx in annotation_indices]
    for idx in reversed(annotation_indices):
        lines.pop(idx)
    package_idx = first_index(lambda line: line.startswith('package '))
    for offset, line in enumerate(annotation_block):
        lines.insert(package_idx + offset, line)
    package_idx += len(annotation_block)

text = '\n'.join(lines)

# Kotlin enums that declare a companion object require a trailing semicolon
enum_pattern = re.compile(r"(\n\s*\w+\([^)]*\))\n\n(\s+companion object)")
text = enum_pattern.sub(lambda m: f"{m.group(1)};\n\n{m.group(2)}", text)

# Ensure data classes implementing shared interfaces mark interface properties with override
class_pattern = re.compile(
    r"public data class [^(]+\((?P<body>.*?)\)\s*:\s*(?P<interfaces>[^\{]+)\{",
    re.S,
)

product_props = {
    "currency", "debugDescription", "description", "displayName",
    "displayPrice", "id", "platform", "price", "title", "type",
}

purchase_props = {
    "currentPlanId", "id", "ids", "isAutoRenewing", "platform",
    "productId", "purchaseState", "purchaseToken", "quantity", "transactionDate",
}

def needs_product_common(interfaces):
    return any(name in interfaces for name in ("ProductCommon", "Product", "ProductSubscription"))

def needs_purchase_common(interfaces):
    return any(name in interfaces for name in ("PurchaseCommon", "Purchase"))

def patch_class(match):
    body = match.group("body")
    raw_interfaces = match.group("interfaces")
    interfaces = {token.strip() for token in raw_interfaces.replace("\n", " ").split(",")}

    override_targets = set()
    if needs_product_common(interfaces):
        override_targets.update(product_props)
    if needs_purchase_common(interfaces):
        override_targets.update(purchase_props)

    if not override_targets:
        return match.group(0)

    prop_pattern = re.compile(r"(^\s*)(val|var)\s+(\w+)(.*)$", re.M)

    def replace_prop(prop_match):
        indent, keyword, name, rest = prop_match.groups()
        if name not in override_targets:
            return prop_match.group(0)
        if keyword.startswith("override"):
            return prop_match.group(0)
        return f"{indent}override {keyword} {name}{rest}"

    patched_body = prop_pattern.sub(replace_prop, body)
    return match.group(0).replace(body, patched_body)

text = class_pattern.sub(patch_class, text)
lines = text.splitlines()

# Fix enum raw values
pattern1 = re.compile(r'(.)([A-Z][a-z0-9]+)')
pattern2 = re.compile(r'([a-z0-9])([A-Z])')

def camel_to_kebab(name: str) -> str:
    s1 = pattern1.sub(r'\1-\2', name)
    s2 = pattern2.sub(r'\1-\2', s1)
    return s2.replace('_', '-').lower()

i = 0
while i < len(lines):
    line = lines[i]
    header_match = re.match(r'^public enum class (\w+)\(val rawValue: String\) \{$', line)
    if not header_match:
        i += 1
        continue
    enum_name = header_match.group(1)

    constant_indices = []
    j = i + 1
    while j < len(lines):
        constant_indices.append(j)
        if lines[j].strip().endswith(';'):
            break
        j += 1
    if not constant_indices:
        i = j
        continue

    constants = []
    for idx in constant_indices:
        const_line = lines[idx]
        match = re.match(r'^(\s*)(\w+)\("([^"]+)"\)(,|;)$', const_line)
        if not match:
            continue
        indent, name, old_raw, trailing = match.groups()
        new_raw = camel_to_kebab(name)
        constants.append({
            "index": idx, "indent": indent, "name": name,
            "old_raw": old_raw, "new_raw": new_raw, "trailing": trailing,
        })
        if old_raw != new_raw:
            lines[idx] = f'{indent}{name}("{new_raw}"){trailing}'

    k = j + 1
    while k < len(lines) and 'when (value)' not in lines[k]:
        k += 1
    if k >= len(lines):
        i = j
        continue

    case_start = k + 1
    else_idx = case_start
    while else_idx < len(lines) and 'else ->' not in lines[else_idx]:
        else_idx += 1
    if else_idx >= len(lines):
        i = j
        continue

    while case_start < else_idx and not lines[case_start].strip():
        case_start += 1
    if case_start >= else_idx:
        i = else_idx
        continue

    indent_match = re.match(r'^(\s*)', lines[case_start])
    case_indent = indent_match.group(1) if indent_match else ' ' * 12

    new_case_lines = []
    for const in constants:
        seen = set()
        candidates = [const["new_raw"], const["old_raw"], const["name"]]
        if const["name"].endswith("Ios"):
            ios_upper = const["name"][:-3] + "IOS"
            if ios_upper:
                candidates.append(ios_upper)
        for candidate in candidates:
            if candidate and candidate not in seen:
                new_case_lines.append(
                    f'{case_indent}"{candidate}" -> {enum_name}.{const["name"]}'
                )
                seen.add(candidate)

    lines[case_start:else_idx] = new_case_lines
    i = else_idx

text = '\n'.join(lines)
if not text.endswith('\n'):
    text += '\n'

target.write_text(text)
PY

echo "✅ Post-processing complete"
