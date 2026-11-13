package com.rabbai.blocking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.rabbai.blocking.logic.Decision
import com.rabbai.blocking.logic.DecisionInput
import com.rabbai.blocking.logic.RestrictionDecision
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Consent based prototype (Tier 1). Polls UsageStatsManager for the foreground app while the screen is interactive and shows
 * BlockActivity over a selected app when the decision logic says so. The OS or an OEM battery manager can stop this service at any time.
 * START_STICKY, BootReceiver and WatchdogWorker restart it, but nothing here is a guarantee. The status screen reports what is running.
 */
class ForegroundDetectionService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loop: Job? = null
    private var lastBlocked: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        startInForeground()
        if (loop?.isActive != true) loop = scope.launch { run() }
        running = true
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        scope.cancel()
        super.onDestroy()
    }

    private fun startInForeground() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.rabb_fgs_title), NotificationManager.IMPORTANCE_MIN))
        val n: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(getString(R.string.rabb_fgs_title))
            .setContentText(getString(R.string.rabb_fgs_text))
            .setOngoing(true).build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(ID, n)
    }

    private suspend fun run() {
        val store = SecureStore(applicationContext)
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        var foreground: String? = null
        var selected = store.selectedPackages(); var windows = store.windows(); var suspended = store.suspendedUntil(); var tier1 = store.tier1Flag()
        var tick = 0
        while (scope.isActive) {
            if (pm.isInteractive) {
                val now = System.currentTimeMillis()
                if (tick++ % 10 == 0) { selected = store.selectedPackages(); windows = store.windows(); suspended = store.suspendedUntil(); tier1 = store.tier1Flag(); store.setHeartbeat(now) }
                if (!Permissions.hasUsageAccess(applicationContext)) { delay(2000); continue } // revoked while running: Tier drops on the next status read
                foreground = latestForeground(usm, now) ?: foreground
                val decision = RestrictionDecision.decide(DecisionInput(now, foreground, selected, windows, suspended, packageName, tier1))
                if (decision is Decision.Block && Permissions.hasOverlay(applicationContext)) {
                    if (lastBlocked != decision.packageName) {
                        lastBlocked = decision.packageName
                        startActivity(Intent(applicationContext, BlockActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
                    }
                } else if (decision is Decision.Allow) lastBlocked = null
                delay(700)
            } else delay(3000)
        }
    }

    private fun latestForeground(usm: UsageStatsManager, now: Long): String? {
        val events = usm.queryEvents(now - 10_000, now)
        val e = UsageEvents.Event()
        var pkg: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.eventType == UsageEvents.Event.ACTIVITY_RESUMED) pkg = e.packageName
        }
        return pkg
    }

    companion object {
        const val ACTION_STOP = "com.rabbai.blocking.STOP"
        private const val CHANNEL = "rabb_blocking"
        private const val ID = 4201
        @Volatile var running = false
        fun start(c: Context) = androidx.core.content.ContextCompat.startForegroundService(c, Intent(c, ForegroundDetectionService::class.java))
        fun stop(c: Context) { c.startService(Intent(c, ForegroundDetectionService::class.java).setAction(ACTION_STOP)) }
    }
}
