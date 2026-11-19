package com.rabbai.blocking.logic

enum class Tier(val wire: String) { TIER0("tier0"), TIER1("tier1"), TIER2("tier2") }

enum class Requirement(val wire: String) { USAGE_ACCESS("usage_access"), OVERLAY("overlay"), SERVICE("service"), FLAG("flag"), NOTIFICATIONS("notifications") }

data class Unmet(val requirement: Requirement, val message: String)

data class TierInput(
    val hasUsageAccess: Boolean,
    val hasOverlay: Boolean,
    val serviceRunning: Boolean,
    val notificationsGranted: Boolean,
    val tier1FlagEnabled: Boolean,
    val accessibilityFlagEnabled: Boolean,
    val accessibilityServiceEnabled: Boolean,
)

data class TierResult(val tier: Tier, val unmet: List<Unmet>)

/**
 * Capability tiers (AGENTS.md): Tier 0 reminders only, Tier 1 detection plus block screen, Tier 2 accessibility (flag, default off).
 * The unmet list is shown to the user verbatim so the app never overstates enforcement.
 */
object TierResolver {
    fun resolve(i: TierInput): TierResult {
        val unmet = mutableListOf<Unmet>()
        if (!i.tier1FlagEnabled) unmet += Unmet(Requirement.FLAG, "App detection is not enabled in this build.")
        if (!i.hasUsageAccess) unmet += Unmet(Requirement.USAGE_ACCESS, "Usage Access is off, so Rabb.ai cannot see which app is open.")
        if (!i.hasOverlay) unmet += Unmet(Requirement.OVERLAY, "Display over other apps is off, so the reading prompt cannot appear over an app.")
        if (!i.serviceRunning) unmet += Unmet(Requirement.SERVICE, "The detection service is not running. Your phone may have stopped it to save battery.")
        if (!i.notificationsGranted) unmet += Unmet(Requirement.NOTIFICATIONS, "Notifications are off. The service still works but its status notice is hidden.")

        val tier1Ready = i.tier1FlagEnabled && i.hasUsageAccess && i.hasOverlay && i.serviceRunning
        val tier2Ready = i.accessibilityFlagEnabled && i.accessibilityServiceEnabled
        val tier = when {
            tier2Ready -> Tier.TIER2
            tier1Ready -> Tier.TIER1
            else -> Tier.TIER0
        }
        return TierResult(tier, unmet)
    }
}
