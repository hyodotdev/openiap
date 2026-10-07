#!/usr/bin/env bash
set -euo pipefail

maui_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
repo_root=$(cd "$maui_root/../.." && pwd)
google_root="$repo_root/packages/google"
fixture="$google_root/compatibility/community-provider"
example="$maui_root/example/OpenIap.Maui.Example/OpenIap.Maui.Example.csproj"
workspace=$(mktemp -d)
server_pid=""
cleanup() {
    if [[ -n "$server_pid" ]]; then
        kill "$server_pid" 2>/dev/null || true
        wait "$server_pid" 2>/dev/null || true
    fi
    rm -rf "$workspace"
}
trap cleanup EXIT
repository="$workspace/maven"
core_version=$(node -p "require(process.argv[1]).google" "$repo_root/openiap-versions.json")
suite_version=$(node --input-type=module -e "import {SUITE_VERSION} from '$repo_root/packages/conformance/src/spec/suite-version.mjs'; console.log(SUITE_VERSION)")

"$google_root/gradlew" -p "$google_root" :openiap-core:publishToMavenLocal :openiap-conformance:publishToMavenLocal -Dmaven.repo.local="$repository" > "$workspace/core.log" 2>&1
"$google_root/gradlew" -p "$fixture" :vendor-sdk:publishVendorPublicationToMavenLocal :provider:publishFixturePublicationToMavenLocal \
    -Dmaven.repo.local="$repository" -PopenIapRepository="$repository" -PopenIapVersion="$core_version" -PconformanceVersion="$suite_version" > "$workspace/provider.log" 2>&1
python3 - "$repository" "$workspace/port" > "$workspace/http.log" 2>&1 <<'PY' &
import base64, functools, hashlib, http.server, pathlib, sys
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[1])
for _ in range(100):
    server = http.server.HTTPServer(('127.0.0.1', 0), handler)
    repository_url = f'http://127.0.0.1:{server.server_port}'
    cache_name = base64.b64encode(hashlib.sha256(repository_url.encode()).digest()).decode()
    # .NET Android 36.1.69 uses this Base64 name as an unescaped cache path.
    if '/' not in cache_name: break
    server.server_close()
else: raise SystemExit('Could not select a filesystem-safe Maven fixture URL')
pathlib.Path(sys.argv[2]).write_text(str(server.server_port))
server.serve_forever()
PY
server_pid=$!
python3 - "$workspace/port" <<'PY'
import pathlib, sys, time
path = pathlib.Path(sys.argv[1])
for _ in range(100):
    if path.exists(): break
    time.sleep(0.05)
else: raise SystemExit('Fixture Maven server did not start')
PY
port=$(cat "$workspace/port")
cat > "$workspace/repository.targets" <<TARGETS
<Project><ItemGroup>
  <OpenIapProviderRepository Include="file://$repository" />
  <ProjectReference Update="$maui_root/src/OpenIap.Maui/OpenIap.Maui.csproj" JavaArtifact="community.fixture:unused-api:1.0,community.fixture:unused-runtime:1.0" />
  <AndroidMavenLibrary Include="community.fixture:vendor-sdk" Version="\$(FixtureVendorVersion)" Repository="http://127.0.0.1:$port" Bind="false" Condition="'\$(FixtureVendorVersion)' != ''" />
</ItemGroup></Project>
TARGETS

dotnet restore "$example" -p:TargetFrameworks=net10.0-android --nologo > "$workspace/restore.log" 2>&1
args=(-nologo -p:TargetFramework=net10.0-android "-p:IntermediateOutputPath=$workspace/obj/" "-p:MavenCacheDirectory=$workspace/maven-cache" -p:OpenIapStore=community_fixture "-p:CustomAfterMicrosoftCommonTargets=$workspace/repository.targets")
dotnet msbuild "$example" "${args[@]}" -p:OpenIapProvider=community.fixture:provider:1.0.0 \
    -t:_CategorizeAndroidLibraries -getItem:AndroidLibrary,AndroidIgnoredJavaDependency > "$workspace/resolved.json" 2>&1
python3 - "$workspace/resolved.json" <<'PY'
import json, pathlib, sys, zipfile
raw = pathlib.Path(sys.argv[1]).read_text()
items = json.loads(raw[raw.index('{'):])['Items']['AndroidLibrary']
coordinates = [item.get('JavaArtifact', '') for item in items]
assert 'community.fixture:provider:1.0.0' in coordinates, coordinates
assert 'community.fixture:vendor-sdk:1.0.0' in coordinates, coordinates
assert 'org.jetbrains.kotlinx:kotlinx-datetime-jvm:0.7.1' in coordinates, coordinates
assert 'org.jetbrains.kotlinx:kotlinx-datetime:0.7.1' not in coordinates, coordinates
assert any(c.startswith('androidx.compose.runtime:runtime-android:') for c in coordinates), coordinates
redirects = [item['Identity'] for item in json.loads(raw[raw.index('{'):])['Items']['AndroidIgnoredJavaDependency']]
assert 'org.jetbrains.kotlinx:kotlinx-datetime:0.7.1' in redirects, redirects
date_jar = next(item['Identity'] for item in items if item.get('JavaArtifact') == 'org.jetbrains.kotlinx:kotlinx-datetime-jvm:0.7.1')
with zipfile.ZipFile(date_jar) as archive:
    assert 'kotlinx/datetime/LocalDate.class' in archive.namelist()
assert sum(c.startswith('io.github.hyochan.openiap:openiap-core:') for c in coordinates) == 1, coordinates
assert not any(c.startswith(('org.jetbrains.kotlin:kotlin-stdlib:', 'org.jetbrains.kotlinx:kotlinx-coroutines-')) for c in coordinates), coordinates
assert not any(c.startswith(('com.android.billingclient:', 'com.meta.horizon:', 'com.amazon.device:')) for c in coordinates), coordinates
print('MAUI community runtime closure includes the vendor SDK, one core, and no duplicate Kotlin or official billing SDK.')
PY

if ! dotnet msbuild "$example" "${args[@]}" -p:OpenIapProvider=community.fixture:provider:1.0.0 -p:FixtureVendorVersion=1.0.0 \
    -t:_CategorizeAndroidLibraries -getItem:AndroidLibrary > "$workspace/direct-vendor.json" 2>&1; then
    cat "$workspace/direct-vendor.json" >&2
    exit 1
fi
python3 - "$workspace/direct-vendor.json" <<'PY'
import json, pathlib, sys
raw = pathlib.Path(sys.argv[1]).read_text()
items = json.loads(raw[raw.index('{'):])['Items']['AndroidLibrary']
assert sum(item.get('JavaArtifact') == 'community.fixture:vendor-sdk:1.0.0' for item in items) == 1, items
print('MAUI links a directly declared and transitive vendor SDK exactly once.')
PY
if dotnet msbuild "$example" "${args[@]}" -p:OpenIapProvider=community.fixture:provider:1.0.0 -p:FixtureVendorVersion=0.9.0 -t:_CategorizeAndroidLibraries > "$workspace/vendor-conflict.log" 2>&1; then
    echo 'MAUI replaced an incompatible directly supplied vendor SDK.' >&2
    exit 1
fi
grep -Fq 'vendor-sdk resolves 1.0.0, but the app provides 0.9.0' "$workspace/vendor-conflict.log"
echo 'MAUI rejects a provider requiring a newer vendor SDK than the app supplies.'

bad="$repository/community/fixture/incompatible/1.0.0"
mkdir -p "$bad"
cp "$repository/community/fixture/provider/1.0.0/provider-1.0.0.aar" "$bad/incompatible-1.0.0.aar"
cat > "$bad/incompatible-1.0.0.pom" <<'POM'
<project><modelVersion>4.0.0</modelVersion><groupId>community.fixture</groupId><artifactId>incompatible</artifactId><version>1.0.0</version><packaging>aar</packaging><dependencies><dependency><groupId>io.github.hyochan.openiap</groupId><artifactId>openiap-core</artifactId><version>999.0.0</version></dependency></dependencies></project>
POM
if dotnet msbuild "$example" "${args[@]}" -p:OpenIapProvider=community.fixture:incompatible:1.0.0 -t:_CategorizeAndroidLibraries > "$workspace/incompatible.log" 2>&1; then
    echo 'MAUI linked a provider requiring an incompatible core.' >&2
    exit 1
fi
if ! grep -Eq 'Cannot find a version.*openiap-core|Could not (resolve|find).*openiap-core|openiap-core resolves 999' "$workspace/incompatible.log"; then
    cat "$workspace/incompatible.log" >&2
    exit 1
fi
echo 'MAUI rejects a provider whose required core conflicts with the bundled core.'
