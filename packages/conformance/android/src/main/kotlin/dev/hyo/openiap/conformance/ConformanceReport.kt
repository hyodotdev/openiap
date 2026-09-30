package dev.hyo.openiap.conformance

import com.google.gson.GsonBuilder
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import java.io.File

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class ConformanceBehavior(val id: String)

/** Writes only executed assertions; a missing required behavior cannot pass. */
internal object ConformanceReports {
    private val runs = mutableMapOf<String, MutableMap<String, String>>()

    fun watcher(suite: StoreConformanceSuite): TestWatcher = object : TestWatcher() {
        private var outcome = "pass"
        override fun failed(error: Throwable, description: Description) { outcome = "fail" }
        override fun skipped(error: org.junit.AssumptionViolatedException, description: Description) { outcome = "not-applicable" }
        override fun finished(description: Description) {
            val behavior = description.getAnnotation(ConformanceBehavior::class.java)?.id
                ?: if (outcome != "pass") "suite.${description.methodName}" else return
            val target = System.getProperty("openiap.conformanceReport") ?: return
            record(suite, target, behavior, outcome)
        }
    }

    @Synchronized
    private fun record(suite: StoreConformanceSuite, target: String, id: String, outcome: String) {
        val adapter = suite.reportAdapter
        val path = target.replace("{storeId}", adapter.storeId)
        val results = runs.getOrPut(path) { mutableMapOf() }
        if (results[id] != "fail") results[id] = outcome
        val required = suite.requiredReportBehaviors
        val report = mapOf(
            "suiteVersion" to ConformanceBehaviors.SUITE_VERSION,
            "clientProtocolVersion" to ConformanceBehaviors.CLIENT_PROTOCOL_VERSION,
            "storeId" to adapter.storeId,
            "store" to adapter.store.rawValue,
            "capabilities" to adapter.capabilities.map { it.id }.sorted(),
            "scope" to mapOf("kind" to suite.reportScope, "requiredBehaviors" to required.sorted(),
                "complete" to required.all { results.containsKey(it) }),
            "conformant" to (required.all { results[it] == "pass" } && results.values.none { it == "fail" }),
            "results" to results.toSortedMap().map { (behavior, verdict) -> mapOf("id" to behavior, "outcome" to verdict) },
        )
        val file = File(path)
        file.parentFile?.mkdirs()
        file.writeText(GsonBuilder().setPrettyPrinting().create().toJson(report) + "\n")
    }
}
