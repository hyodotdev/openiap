require 'json'

# Read version from monorepo root
# Works both when podspec is in packages/apple/ and when copied to root
version_file = if File.exist?(File.join(__dir__, '../../openiap-versions.json'))
  File.join(__dir__, '../../openiap-versions.json')
elsif File.exist?(File.join(__dir__, 'openiap-versions.json'))
  File.join(__dir__, 'openiap-versions.json')
else
  # Fallback for CI: try to find it in the repo root
  File.join(__dir__, 'openiap-versions.json')
end
versions = JSON.parse(File.read(version_file))

Pod::Spec.new do |s|
  s.name             = 'openiap'
  s.version          = versions['apple']
  s.summary          = 'OpenIAP - Modern Swift library for in-app purchases'
  s.description      = <<-DESC
    OpenIAP is a modern Swift library for handling in-app purchases using StoreKit 2.
    Supports iOS, macOS, and tvOS with a simple and intuitive API.
  DESC

  s.homepage         = 'https://github.com/hyodotdev/openiap'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'hyodotdev' => 'hyo@hyo.dev' }
  s.source           = { :git => 'https://github.com/hyodotdev/openiap.git', :tag => s.version.to_s }

  s.ios.deployment_target = '15.0'
  s.osx.deployment_target = '14.0'
  s.tvos.deployment_target = '16.0'
  s.watchos.deployment_target = '8.0'

  s.swift_version = '5.9'

  # Support both local development (:path) and distribution (git)
  # When podspec is in packages/apple/ (local :path), use 'Sources/**/*.swift'
  # When podspec is in repo root (git distribution), use 'packages/apple/Sources/**/*.swift'
  sources_dir = File.join(File.dirname(__FILE__), 'Sources')
  s.source_files = File.directory?(sources_dir) ? 'Sources/**/*.swift' : 'packages/apple/Sources/**/*.swift'

  s.frameworks = 'StoreKit'
  s.requires_arc = true
  s.module_name = 'OpenIAP'
end
