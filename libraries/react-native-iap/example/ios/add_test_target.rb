#!/usr/bin/env ruby
# One-shot script to add a `exampleTests` XCTest unit test bundle target to
# example.xcodeproj. Run once from `libraries/react-native-iap/example/ios/`.
# Idempotent: exits early if the target already exists.

require 'xcodeproj'

PROJECT_PATH = 'example.xcodeproj'
TARGET_NAME = 'exampleTests'
TEST_FOLDER = 'exampleTests'

project = Xcodeproj::Project.open(PROJECT_PATH)

if project.targets.any? { |t| t.name == TARGET_NAME }
  puts "Target '#{TARGET_NAME}' already exists; nothing to do."
  exit 0
end

app_target = project.targets.find { |t| t.name == 'example' }
raise "Could not find 'example' app target" unless app_target

# 1. Add a unit test bundle target
test_target = project.new_target(
  :unit_test_bundle,
  TARGET_NAME,
  :ios,
  app_target.build_configurations.first.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '15.1'
)

# 2. Point at Info.plist, match app Swift version, set host application
app_bundle_id = app_target.build_configurations.first.build_settings['PRODUCT_BUNDLE_IDENTIFIER']
test_target.build_configurations.each do |config|
  settings = config.build_settings
  settings['PRODUCT_NAME'] = TARGET_NAME
  settings['WRAPPER_EXTENSION'] = 'xctest'
  settings['INFOPLIST_FILE'] = "#{TEST_FOLDER}/Info.plist"
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = "#{app_bundle_id}.Tests"
  settings['SWIFT_VERSION'] = app_target.build_configurations.first.build_settings['SWIFT_VERSION'] || '5.0'
  settings['TEST_HOST'] = "$(BUILT_PRODUCTS_DIR)/example.app/example"
  settings['BUNDLE_LOADER'] = '$(TEST_HOST)'
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
  settings['CLANG_ENABLE_MODULES'] = 'YES'
  settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'NO'
  settings['LD_RUNPATH_SEARCH_PATHS'] = [
    '$(inherited)',
    '@executable_path/Frameworks',
    '@loader_path/Frameworks'
  ]
end

# 3. Register source files
test_group = project.main_group.find_subpath(TEST_FOLDER, true)
test_group.set_source_tree('SOURCE_ROOT')

Dir.glob("#{TEST_FOLDER}/*.swift").each do |file|
  next if test_group.files.any? { |f| f.path == File.basename(file) }
  file_ref = test_group.new_reference(File.basename(file))
  test_target.add_file_references([file_ref])
end

# 4. Depend on the app target so TEST_HOST is built first
test_target.add_dependency(app_target)

# Scheme wiring is handled by Xcodeproj auto-generation on save. To run the
# tests from CLI: `xcodebuild test -scheme example -only-testing:exampleTests`
# after the developer opens the project once (or the scheme can be created via
# `xcodebuild -list` + manual scheme creation).

project.save
puts "Added target '#{TARGET_NAME}' to #{PROJECT_PATH}."
