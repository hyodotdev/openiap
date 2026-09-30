package dev.hyo.openiap

import android.content.Context
import android.content.pm.PackageManager
import io.github.hyochan.openiap.core.BuildConfig
import java.lang.reflect.InvocationTargetException

/** Implement in any package and register the class in application manifest metadata. */
interface OpenIapProviderFactory {
    val storeId: String
    val coreVersion: String
    val capabilities: Set<String> get() = emptySet()
    fun create(context: Context): OpenIapProtocol
}

/** The single discovery path used by official and external Android providers. */
object OpenIapProvider {
    const val METADATA_KEY = "dev.hyo.openiap.PROVIDER"
    val coreVersion: String get() = BuildConfig.OPENIAP_CORE_VERSION

    fun factory(context: Context): OpenIapProviderFactory {
        try {
            val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
            val className = info.metaData?.getString(METADATA_KEY)
                ?: throw OpenIapError.ProviderConfiguration("No Android store provider registered. Select openiapStore and link its provider artifact.")
            val type = Class.forName(className, true, context.classLoader)
            if (!OpenIapProviderFactory::class.java.isAssignableFrom(type)) {
                throw OpenIapError.ProviderConfiguration("$className must implement OpenIapProviderFactory.")
            }
            val factory = type.getConstructor().newInstance() as OpenIapProviderFactory
            validate(factory.storeId, factory.coreVersion)
            return factory
        } catch (error: OpenIapError) {
            throw error
        } catch (error: ReflectiveOperationException) {
            throw configurationError(error)
        } catch (error: LinkageError) {
            throw configurationError(error)
        } catch (error: PackageManager.NameNotFoundException) {
            throw configurationError(error)
        } catch (error: RuntimeException) {
            throw configurationError(error)
        }
    }

    fun create(context: Context): OpenIapProtocol = create(context, factory(context))

    fun create(context: Context, factory: OpenIapProviderFactory): OpenIapProtocol {
        validate(factory.storeId, factory.coreVersion)
        try {
            return factory.create(context)
        } catch (error: OpenIapError) {
            throw error
        } catch (error: LinkageError) {
            throw configurationError(error)
        }
    }

    fun validate(storeId: String, providerCoreVersion: String, runtimeCoreVersion: String = coreVersion) {
        if (!storeId.matches(Regex("[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*")) || storeId in setOf("auto", "none", "apple", "unknown")) {
            throw OpenIapError.ProviderConfiguration("Invalid Android provider storeId '$storeId'. Use a lowercase stable store id.")
        }
        val version = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\\+[0-9A-Za-z.-]+)?")
        fun parse(value: String): MatchResult = version.matchEntire(value)
            ?: throw OpenIapError.ProviderConfiguration("Invalid core version '$value' for provider '$storeId'. Use a complete semantic version.")
        val built = parse(providerCoreVersion)
        val runtime = parse(runtimeCoreVersion)
        val required = (1..3).map { built.groupValues[it].toBigInteger() }
        val available = (1..3).map { runtime.groupValues[it].toBigInteger() }
        val order = required.zip(available).firstOrNull { (a, b) -> a != b }?.let { (a, b) -> a.compareTo(b) } ?: 0
        val prerelease = built.groupValues[4].isNotEmpty() || runtime.groupValues[4].isNotEmpty()
        if (required[0] != available[0] || order > 0 || (prerelease && providerCoreVersion != runtimeCoreVersion)) {
            throw OpenIapError.ProviderConfiguration("Provider '$storeId' requires openiap-core $providerCoreVersion; this app links $runtimeCoreVersion. Use a compatible provider or core version.")
        }
    }

    private fun configurationError(error: Throwable): OpenIapError.ProviderConfiguration {
        val cause = if (error is InvocationTargetException) error.targetException else error
        return OpenIapError.ProviderConfiguration("Android store provider could not load (${cause.javaClass.simpleName}). Check its factory, public no-argument constructor and openiap-core version.")
            .apply { initCause(cause) }
    }
}
