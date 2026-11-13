package com.rabbai.blocking.logic

/** A restriction window registered by the JS layer (epoch milliseconds). */
data class Window(val scheduleId: String, val startMs: Long, val endMs: Long)

data class DecisionInput(
    val nowMs: Long,
    val foregroundPackage: String?,
    val selectedPackages: Set<String>,
    val windows: List<Window>,
    /** Restrictions are suspended while now < suspendedUntilMs (ritual completed or emergency bypass). */
    val suspendedUntilMs: Long,
    val ownPackage: String,
    val tier1Enabled: Boolean,
)

sealed class Decision {
    object Allow : Decision()
    data class Block(val packageName: String) : Decision()
}

/**
 * Pure decision logic, no Android imports, unit tested on the JVM.
 * Rules: never block Rabb.ai itself, never block when the Tier 1 flag is off, block only a selected package
 * inside an active window and outside any suspension.
 */
object RestrictionDecision {
    fun isRestrictionActive(nowMs: Long, windows: List<Window>, suspendedUntilMs: Long): Boolean =
        nowMs >= suspendedUntilMs && windows.any { nowMs >= it.startMs && nowMs < it.endMs }

    fun decide(i: DecisionInput): Decision {
        val pkg = i.foregroundPackage ?: return Decision.Allow
        if (!i.tier1Enabled) return Decision.Allow
        if (pkg == i.ownPackage) return Decision.Allow
        if (pkg !in i.selectedPackages) return Decision.Allow
        return if (isRestrictionActive(i.nowMs, i.windows, i.suspendedUntilMs)) Decision.Block(pkg) else Decision.Allow
    }
}
