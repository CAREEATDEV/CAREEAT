// Objective-C bridge exposing HydraAppGroup to the RN bridge.
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HydraAppGroup, NSObject)
RCT_EXTERN_METHOD(writeSnapshot:(NSString *)appGroup
                  json:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(readSnapshot:(NSString *)appGroup
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(reloadWidget:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
