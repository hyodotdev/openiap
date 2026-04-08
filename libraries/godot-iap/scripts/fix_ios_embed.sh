#!/bin/bash
# Fix iOS Xcode project to embed GodotIap frameworks
# Run this after Godot iOS export

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Use IOS_EXPORT_DIR if set, otherwise default to Example/ios
IOS_EXPORT_DIR="${IOS_EXPORT_DIR:-$PROJECT_ROOT/Example/ios}"
PBXPROJ="$IOS_EXPORT_DIR/Martie.xcodeproj/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
    echo "Error: project.pbxproj not found at $PBXPROJ"
    exit 1
fi

echo "Fixing iOS project to embed frameworks..."

# Backup original
cp "$PBXPROJ" "$PBXPROJ.backup"

# Read the file and make modifications
python3 << EOF
import re

with open("$PBXPROJ", "r") as f:
    content = f.read()

# Check if GodotIap framework references exist
if "GodotIap.framework" not in content:
    print("Warning: GodotIap.framework not found in project")
    exit(0)

# Find the framework file reference IDs
godotiap_ref_match = re.search(r'(\w+)\s*/\*\s*GodotIap\.framework\s*\*/\s*=\s*\{isa\s*=\s*PBXFileReference', content)
swiftgodot_ref_match = re.search(r'(\w+)\s*/\*\s*SwiftGodotRuntime\.framework\s*\*/\s*=\s*\{isa\s*=\s*PBXFileReference', content)

# Also try alternate pattern (without comment)
if not godotiap_ref_match:
    godotiap_ref_match = re.search(r'(\w+)\s*=\s*\{isa\s*=\s*PBXFileReference[^}]*GodotIap\.framework', content)
if not swiftgodot_ref_match:
    swiftgodot_ref_match = re.search(r'(\w+)\s*=\s*\{isa\s*=\s*PBXFileReference[^}]*SwiftGodotRuntime\.framework', content)

# Try to find by path pattern
if not godotiap_ref_match:
    godotiap_ref_match = re.search(r'(\w+)\s*=\s*\{isa\s*=\s*PBXFileReference;[^}]*path\s*=\s*"[^"]*GodotIap\.framework[^"]*"', content)
if not swiftgodot_ref_match:
    swiftgodot_ref_match = re.search(r'(\w+)\s*=\s*\{isa\s*=\s*PBXFileReference;[^}]*path\s*=\s*"[^"]*SwiftGodotRuntime\.framework[^"]*"', content)

# Find by the specific pattern Godot uses
godotiap_ref = None
swiftgodot_ref = None

for match in re.finditer(r'(\w+)\s*=\s*\{isa\s*=\s*PBXFileReference;[^}]+\}', content):
    block = match.group(0)
    ref_id = match.group(1)
    if 'GodotIap.framework/GodotIap' in block or 'GodotIap.framework"' in block:
        godotiap_ref = ref_id
    if 'SwiftGodotRuntime.framework/SwiftGodotRuntime' in block or 'SwiftGodotRuntime.framework"' in block:
        swiftgodot_ref = ref_id

print(f"GodotIap ref: {godotiap_ref}")
print(f"SwiftGodotRuntime ref: {swiftgodot_ref}")

if not godotiap_ref or not swiftgodot_ref:
    print("Could not find framework references")
    # Print first few PBXFileReference entries for debugging
    refs = re.findall(r'(\w+)\s*=\s*\{isa\s*=\s*PBXFileReference;[^}]+\}', content)[:10]
    for r in refs:
        print(f"Found ref: {r[:200]}...")
    exit(1)

# Generate new IDs for embed build files using hash to avoid collisions
import hashlib
embed_godotiap_id = hashlib.md5(f"{godotiap_ref}_embed".encode()).hexdigest().upper()[:24]
embed_swiftgodot_id = hashlib.md5(f"{swiftgodot_ref}_embed".encode()).hexdigest().upper()[:24]

# Add embed build file entries after PBXBuildFile section start
embed_entries = f'''		{embed_godotiap_id} /* GodotIap.framework in Embed Frameworks */ = {{isa = PBXBuildFile; fileRef = {godotiap_ref}; settings = {{ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }}; }};
		{embed_swiftgodot_id} /* SwiftGodotRuntime.framework in Embed Frameworks */ = {{isa = PBXBuildFile; fileRef = {swiftgodot_ref}; settings = {{ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }}; }};
'''

# Find Embed Frameworks section dynamically first to validate
embed_phase_match = re.search(
    r'(\w+)\s*/\*\s*Embed Frameworks\s*\*/\s*=\s*\{[^}]*isa\s*=\s*PBXCopyFilesBuildPhase',
    content
)

if not embed_phase_match:
    print("Error: Could not find Embed Frameworks build phase")
    print("The project may not be properly configured for framework embedding")
    exit(1)

embed_phase_id = embed_phase_match.group(1)
print(f"Found Embed Frameworks phase: {embed_phase_id}")

# Check if embed entries already exist
if embed_godotiap_id in content:
    print("Embed entries already exist")
else:
    # Add after "/* Begin PBXBuildFile section */"
    content = content.replace(
        "/* Begin PBXBuildFile section */\n",
        "/* Begin PBXBuildFile section */\n" + embed_entries
    )

# Replace empty Embed Frameworks files using dynamic UUID
content = re.sub(
    rf'({embed_phase_id}\s*/\*\s*Embed Frameworks\s*\*/\s*=\s*\{{[^}}]*files\s*=\s*\()[^)]*(\);)',
    rf'\g<1>\n\t\t\t\t\t{embed_godotiap_id} /* GodotIap.framework in Embed Frameworks */,\n\t\t\t\t\t{embed_swiftgodot_id} /* SwiftGodotRuntime.framework in Embed Frameworks */,\n\t\t\t\t\2',
    content
)

# Fix framework references to point to .framework folder, not binary inside
content = re.sub(
    r'(path\s*=\s*"[^"]*GodotIap\.framework)/GodotIap"',
    r'\1"',
    content
)
content = re.sub(
    r'(path\s*=\s*"[^"]*SwiftGodotRuntime\.framework)/SwiftGodotRuntime"',
    r'\1"',
    content
)

# Change lastKnownFileType from file to wrapper.framework
content = re.sub(
    r'(lastKnownFileType\s*=\s*)file(\s*;[^}]*GodotIap)',
    r'\1wrapper.framework\2',
    content
)
content = re.sub(
    r'(lastKnownFileType\s*=\s*)file(\s*;[^}]*SwiftGodotRuntime)',
    r'\1wrapper.framework\2',
    content
)

with open("$PBXPROJ", "w") as f:
    f.write(content)

print("Done!")
EOF

echo "Framework embedding fixed!"
echo "Now open Xcode and build the project."
