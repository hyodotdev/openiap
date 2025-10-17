require 'json'

# Read version from monorepo root
version_file = File.join(__dir__, '../../openiap-versions.json')
versions = JSON.parse(File.read(version_file))

Pod::Spec.new do |s|
  s.name             = 'openiap'
  s.version          = versions['apple']
  s.summary          = 'OpenIAP - Modern Swift library for in-app purchases'
  s.description      = <<-DESC
    OpenIAP is a modern Swift library for handling in-app purchases using StoreKit 2.
    Supports iOS and macOS with a simple and intuitive API.
  DESC

  s.homepage         = 'https://github.com/hyodotdev/openiap'
  s.license          = { :type => 'MIT', :file => 'packages/apple/LICENSE' }
  s.author           = { 'hyodotdev' => 'hyo@hyo.dev' }
  s.source           = { :git => 'https://github.com/hyodotdev/openiap.git', :tag => "apple-v#{s.version}" }

  s.ios.deployment_target = '15.0'
  s.osx.deployment_target = '14.0'

  s.swift_version = '5.9'
  s.source_files = 'packages/apple/Sources/**/*.swift'

  s.frameworks = 'StoreKit'
  s.requires_arc = true
  s.module_name = 'OpenIAP'
end