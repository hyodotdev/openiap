#
# To learn more about a Podspec see http://guides.cocoapods.org/syntax/podspec.html
#
require 'json'
require 'pathname'

podspec_dir = Pathname.new(__dir__).realpath
versions_path = podspec_dir.join('..', 'openiap-versions.json')
openiap_versions = JSON.parse(File.read(versions_path))
pubspec_path = podspec_dir.join('..', 'pubspec.yaml')
pubspec_version = File.read(pubspec_path).match(/^version:\s*([^\s#]+)/)&.[](1)
raise 'flutter_inapp_purchase: version missing in pubspec.yaml' if pubspec_version.to_s.empty?

Pod::Spec.new do |s|
  s.name             = 'flutter_inapp_purchase'
  s.version          = pubspec_version
  s.summary          = 'In App Purchase plugin for flutter. This project has been forked by react-native-iap and we are willing to share same experience with that on react-native.'
  s.description      = <<-DESC
In App Purchase plugin for flutter. This project has been forked by react-native-iap and we are willing to share same experience with that on react-native.
                       DESC
  s.homepage         = 'https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase'
  s.license          = { :file => '../LICENSE' }
  s.author           = { 'Hyo Dev' => 'hyo@hyo.dev' }
  s.source           = { :path => '.' }
  s.source_files = 'Classes/**/*.swift'
  s.dependency 'Flutter'
  # Use OpenIAP Apple native module (via CocoaPods)
  s.dependency 'openiap', openiap_versions['apple']

  s.ios.deployment_target = '15.0'
  s.tvos.deployment_target = '15.0'
  s.swift_version = '5.5'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'VALID_ARCHS' => 'arm64 x86_64',
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
end
