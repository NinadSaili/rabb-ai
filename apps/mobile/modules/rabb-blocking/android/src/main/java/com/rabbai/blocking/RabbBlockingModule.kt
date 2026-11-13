package com.rabbai.blocking

import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import com.rabbai.blocking.logic.TierInput
import com.rabbai.blocking.logic.TierResolver
import com.rabbai.blocking.logic.Window
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Android implementation of the AppBlockingService contract (apps/mobile/src/services/blocking/types.ts).
 * Written for the Expo Modules API. Not compiled in the authoring environment: no Android SDK (see docs/STATUS.md).
 */
class RabbBlockingModule : Module() {
    private val scope = CoroutineScope(Dispatchers.Default)
    private val ctx get() = appContext.reactContext ?: throw IllegalStateException("no context")
    private val store by lazy { SecureStore(ctx) }

    private fun status(failure: String? = null, tier: String? = null): Map<String, Any?> {
        // restrictionApplied is true only when detection is actually running with every requirement met.
        val r = runBlockingTier()
        val applied = r.first == "tier1" && ForegroundDetectionService.running
        return mapOf("restrictionApplied" to applied, "tier" to (tier ?: r.first), "lastHeartbeatMs" to r.second, "failure" to (failure ?: if (!ForegroundDetectionService.running) "service_not_running" else null))
    }

    private fun runBlockingTier(): Pair<String, Long?> = kotlinx.coroutines.runBlocking {
        val res = TierResolver.resolve(tierInput())
        res.tier.wire to store.heartbeat().takeIf { it > 0 }
    }

    private suspend fun tierInputSuspend() = TierInput(
        hasUsageAccess = Permissions.hasUsageAccess(ctx), hasOverlay = Permissions.hasOverlay(ctx), serviceRunning = ForegroundDetectionService.running,
        notificationsGranted = Permissions.notificationsEnabled(ctx), tier1FlagEnabled = store.tier1Flag(),
        accessibilityFlagEnabled = store.accessibilityFlag(), accessibilityServiceEnabled = false, // Tier 2 lives in the separate accessibility flavor
    )
    private fun tierInput() = kotlinx.coroutines.runBlocking { tierInputSuspend() }

    override fun definition() = ModuleDefinition {
        Name("RabbBlocking")

        AsyncFunction("getCapabilities") { promise: Promise ->
            scope.launch {
                val r = TierResolver.resolve(tierInputSuspend())
                promise.resolve(mapOf(
                    "platform" to "android", "tier" to r.tier.wire, "guaranteed" to false,
                    "unmet" to r.unmet.map { mapOf("requirement" to it.requirement.wire, "message" to it.message) },
                ))
            }
        }

        AsyncFunction("getPermissionState") { kind: String ->
            val granted = when (kind) {
                "usage_access" -> Permissions.hasUsageAccess(ctx); "overlay" -> Permissions.hasOverlay(ctx)
                "notifications" -> Permissions.notificationsEnabled(ctx); "battery_optimization" -> Permissions.ignoringBatteryOptimizations(ctx)
                else -> return@AsyncFunction "unavailable"
            }
            if (granted) "granted" else "denied"
        }

        // The JS layer shows the prominent disclosure and gets consent BEFORE calling this.
        AsyncFunction("requestPermission") { kind: String ->
            val intent: Intent? = when (kind) {
                "usage_access" -> Permissions.usageAccessIntent(); "overlay" -> Permissions.overlayIntent(ctx)
                "battery_optimization" -> Permissions.batteryIntent(); "notifications" -> Permissions.notificationsIntent(ctx); else -> null
            }
            intent?.let { ctx.startActivity(it) }
            // The user returns from system settings. The caller re-reads state with getPermissionState.
            "not_determined"
        }

        AsyncFunction("setFeatureFlags") { flags: Map<String, Boolean>, promise: Promise ->
            scope.launch { store.setFlags(flags["tier1"] == true, flags["accessibility"] == true); promise.resolve(null) }
        }

        AsyncFunction("presentAppPicker") { promise: Promise ->
            val activity = appContext.currentActivity ?: return@AsyncFunction promise.resolve(mapOf("result" to "failed", "failure" to "native_error"))
            val pm = ctx.packageManager
            val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val apps = pm.queryIntentActivities(launcher, 0).map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
                .filter { it.first != ctx.packageName }.distinctBy { it.first }.sortedBy { it.second.lowercase() }
            scope.launch {
                val current = store.selectedPackages()
                val checked = BooleanArray(apps.size) { apps[it].first in current }
                activity.runOnUiThread {
                    AlertDialog.Builder(activity)
                        .setTitle(R.string.rabb_picker_title)
                        .setMultiChoiceItems(apps.map { it.second }.toTypedArray<CharSequence>(), checked) { _, i, on -> checked[i] = on }
                        .setPositiveButton(R.string.rabb_picker_done) { _, _ ->
                            val chosen = apps.indices.filter { checked[it] }.map { apps[it].first }.toSet()
                            scope.launch { store.setSelectedPackages(chosen); promise.resolve(mapOf("result" to "selected", "summary" to mapOf("count" to chosen.size, "categoryCount" to 0, "webDomainCount" to 0))) }
                        }
                        .setNegativeButton(R.string.rabb_picker_cancel) { _, _ -> promise.resolve(mapOf("result" to "cancelled", "summary" to mapOf("count" to current.size, "categoryCount" to 0, "webDomainCount" to 0))) }
                        .setOnCancelListener { promise.resolve(mapOf("result" to "cancelled", "summary" to mapOf("count" to current.size, "categoryCount" to 0, "webDomainCount" to 0))) }
                        .show()
                }
            }
        }

        // Labels stay on device. The caller must never log or upload them.
        AsyncFunction("getSelectedApplicationDisplayNames") { promise: Promise ->
            scope.launch {
                val pm = ctx.packageManager
                val names = store.selectedPackages().mapNotNull { p -> runCatching { pm.getApplicationLabel(pm.getApplicationInfo(p, 0)).toString() }.getOrNull() }.sorted()
                promise.resolve(mapOf("count" to names.size, "categoryCount" to 0, "webDomainCount" to 0, "names" to names))
            }
        }

        AsyncFunction("applyRestrictions") { promise: Promise ->
            scope.launch {
                store.setSuspendedUntil(0)
                if (Permissions.hasUsageAccess(ctx) && Permissions.hasOverlay(ctx) && store.tier1Flag()) ForegroundDetectionService.start(ctx)
                WatchdogWorker.schedule(ctx)
                promise.resolve(status())
            }
        }

        AsyncFunction("removeRestrictions") { promise: Promise ->
            // Detection is purely window based, so "remove" clears any suspension and relies on the window logic. A 24 hour suspension would hide tomorrow's window.
            scope.launch { store.setSuspendedUntil(System.currentTimeMillis()); promise.resolve(status()) }
        }

        // User controlled off switch: stop the service and watchdog, forget windows. Always allowed.
        AsyncFunction("disableBlocking") { promise: Promise ->
            scope.launch {
                store.setWindows(emptyList())
                store.setSuspendedUntil(System.currentTimeMillis())
                androidx.work.WorkManager.getInstance(ctx).cancelUniqueWork("rabb_watchdog")
                ForegroundDetectionService.stop(ctx)
                promise.resolve(status())
            }
        }

        AsyncFunction("suspendUntil") { untilMs: Double, promise: Promise ->
            scope.launch { store.setSuspendedUntil(untilMs.toLong()); promise.resolve(status()) }
        }

        AsyncFunction("scheduleRestrictions") { windows: List<Map<String, Any>>, promise: Promise ->
            scope.launch {
                store.setWindows(windows.map { Window(it["scheduleId"] as String, (it["startMs"] as Number).toLong(), (it["endMs"] as Number).toLong()) })
                if (store.tier1Flag() && store.selectedPackages().isNotEmpty() && Permissions.hasUsageAccess(ctx) && Permissions.hasOverlay(ctx)) ForegroundDetectionService.start(ctx)
                WatchdogWorker.schedule(ctx)
                promise.resolve(null)
            }
        }

        // Always a fresh read of the OS state.
        AsyncFunction("getRestrictionStatus") { promise: Promise -> scope.launch { promise.resolve(status()) } }
    }
}
