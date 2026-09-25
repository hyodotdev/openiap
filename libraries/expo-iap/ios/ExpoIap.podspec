require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
versions = JSON.parse(File.read(File.join(__dir__, '..', 'openiap-versions.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoIap'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  # Do not change iOS from 13.4: 15.0 can make expo prebuild exclude the module in
  # some Expo SDKs (https://github.com/hyochan/expo-iap/issues/168). The source
  # enforces StoreKit 2's iOS 15.0+ requirement with @available annotations.
  # tvOS is 16.0, the openiap dependency's minimum tvOS deployment target.
  s.platforms      = { :ios => '13.4', :tvos => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'openiap', "#{versions['apple']}"

  # OnsideKit dependency is conditionally included via ENV var set by the Expo plugin.
  # When modules.onside is enabled, the plugin prepends ENV['EXPO_IAP_ONSIDE']='1' to the
  # Podfile, which makes this dependency active and enables #if canImport(OnsideKit) in Swift.
  if ENV['EXPO_IAP_ONSIDE'] == '1'
    s.dependency 'OnsideKit'
  end

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
