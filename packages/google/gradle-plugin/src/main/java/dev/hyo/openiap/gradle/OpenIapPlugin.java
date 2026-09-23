package dev.hyo.openiap.gradle;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.gradle.api.GradleException;
import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.api.initialization.Settings;

/**
 * Applies the OpenIAP store resolver to Android modules and links the store it
 * picks. The logic ships as Groovy scripts the consumer's Gradle compiles, so any
 * Gradle version works. Applied in settings, it reaches every module.
 */
public final class OpenIapPlugin implements Plugin<Object> {
    private static final String[] ANDROID_PLUGINS = {
        "com.android.application",
        "com.android.library",
        "com.android.dynamic-feature",
        "com.android.test",
        "com.android.kotlin.multiplatform.library",
    };
    private static final String[] SCRIPTS = {"openiap-store.gradle", "openiap-store-plugin.gradle"};

    @Override
    public void apply(Object target) {
        if (target instanceof Settings) {
            ((Settings) target).getGradle().allprojects(project -> project.getPluginManager().apply(OpenIapPlugin.class));
            return;
        }
        if (!(target instanceof Project)) {
            throw new GradleException("openiap: apply io.github.hyochan.openiap in settings.gradle(.kts) or an Android module");
        }
        Project project = (Project) target;
        AtomicBoolean wired = new AtomicBoolean();
        for (String id : ANDROID_PLUGINS) {
            project.getPluginManager().withPlugin(id, plugin -> {
                if (wired.compareAndSet(false, true)) {
                    File dir = project.getLayout().getBuildDirectory().dir("openiap").get().getAsFile();
                    for (String name : SCRIPTS) {
                        project.apply(Map.of("from", extract(name, new File(dir, name))));
                    }
                }
            });
        }
    }

    private static File extract(String name, File target) {
        try (InputStream in = OpenIapPlugin.class.getResourceAsStream(name)) {
            if (in == null) {
                throw new GradleException("openiap: " + name + " is missing from the plugin jar");
            }
            byte[] bytes = in.readAllBytes();
            // Rewriting an unchanged script would needlessly invalidate Gradle's script cache.
            if (!target.isFile() || !Arrays.equals(Files.readAllBytes(target.toPath()), bytes)) {
                Files.createDirectories(target.getParentFile().toPath());
                Files.write(target.toPath(), bytes);
            }
            return target;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
