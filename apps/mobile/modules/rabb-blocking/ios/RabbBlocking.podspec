Pod::Spec.new do |s|
  s.name           = 'RabbBlocking'
  s.version        = '0.1.0'
  s.summary        = 'Rabb.ai Screen Time module (FamilyControls, ManagedSettings, DeviceActivity)'
  s.description    = 'Swift Expo module implementing the AppBlockingService contract on iOS.'
  s.author         = 'Rabb.ai'
  s.homepage       = 'https://rabb.ai'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'SwiftUI', 'UserNotifications'
  s.source_files   = '*.{h,m,swift}', 'Shared/*.swift'
end
