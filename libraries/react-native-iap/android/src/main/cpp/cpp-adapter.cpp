#include <jni.h>
#include <fbjni/fbjni.h>

#ifdef ANDROID
#undef ANDROID
#endif
#ifdef IOS
#undef IOS
#endif

#include "NitroIapOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::iap::registerAllNatives();
  });
}
