// Reserved for hand-rolled struct / enum definitions if/when the ObjC
// surface gains plain-C structs that ObjC ↔ C# can't auto-marshal.
// Currently empty: every method in the OpenIapModule ObjC bridge ferries
// data as NSDictionary / NSArray / primitive types, which Xamarin.iOS
// handles natively.

using System;

namespace Hyo.OpenIap.Maui.Bindings.iOS;
