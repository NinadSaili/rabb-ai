package com.rabbai.blocking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

/** Restarts detection after reboot or app update when the user had enabled it and permissions are still granted. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            WatchdogWorker.ensureServiceIfNeeded(context)
            WatchdogWorker.schedule(context)
        }
    }
}

/** Process death and OEM kill recovery. Best effort: WorkManager itself can be delayed by battery management. */
class WatchdogWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result { ensureServiceIfNeeded(applicationContext); return Result.success() }

    companion object {
        fun schedule(c: Context) {
            WorkManager.getInstance(c).enqueueUniquePeriodicWork("rabb_watchdog", ExistingPeriodicWorkPolicy.UPDATE, PeriodicWorkRequestBuilder<WatchdogWorker>(15, TimeUnit.MINUTES).build())
        }

        fun ensureServiceIfNeeded(c: Context) = runBlocking {
            val store = SecureStore(c)
            val wanted = store.tier1Flag() && store.selectedPackages().isNotEmpty() && Permissions.hasUsageAccess(c) && Permissions.hasOverlay(c)
            if (wanted && !ForegroundDetectionService.running) runCatching { ForegroundDetectionService.start(c) }
        }
    }
}
