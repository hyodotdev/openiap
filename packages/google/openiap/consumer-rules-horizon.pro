# The Horizon platform SDK annotates with JSR-305 without shipping it; R8 stops
# the build on the missing annotation, which nothing needs at runtime.
-dontwarn javax.annotation.Nullable
