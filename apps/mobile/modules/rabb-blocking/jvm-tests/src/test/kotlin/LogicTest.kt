import com.rabbai.blocking.logic.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RestrictionDecisionTest {
    private val window = Window("morning", 1_000, 2_000)
    private fun input(
        now: Long = 1_500, fg: String? = "com.example.social", selected: Set<String> = setOf("com.example.social"),
        windows: List<Window> = listOf(window), suspended: Long = 0, tier1: Boolean = true,
    ) = DecisionInput(now, fg, selected, windows, suspended, "com.rabbai.app", tier1)

    @Test fun blocksSelectedAppInsideWindow() = assertEquals(Decision.Block("com.example.social"), RestrictionDecision.decide(input()))
    @Test fun allowsOutsideWindow() { assertEquals(Decision.Allow, RestrictionDecision.decide(input(now = 999))); assertEquals(Decision.Allow, RestrictionDecision.decide(input(now = 2_000))) }
    @Test fun windowStartInclusiveEndExclusive() { assertTrue(RestrictionDecision.isRestrictionActive(1_000, listOf(window), 0)); assertTrue(!RestrictionDecision.isRestrictionActive(2_000, listOf(window), 0)) }
    @Test fun allowsUnselectedApp() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(fg = "com.example.other")))
    @Test fun neverBlocksItself() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(fg = "com.rabbai.app", selected = setOf("com.rabbai.app"))))
    @Test fun allowsWhenNoForegroundApp() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(fg = null)))
    @Test fun allowsWhileSuspendedAfterRitual() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(suspended = 1_800)))
    @Test fun blocksAgainOnceSuspensionEnds() = assertEquals(Decision.Block("com.example.social"), RestrictionDecision.decide(input(now = 1_900, suspended = 1_800)))
    @Test fun neverBlocksWhenTier1FlagIsOff() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(tier1 = false)))
    @Test fun overlappingWindowsAnyActiveWindowBlocks() = assertEquals(Decision.Block("com.example.social"), RestrictionDecision.decide(input(now = 2_500, windows = listOf(window, Window("custom", 2_000, 3_000)))))
    @Test fun noWindowsMeansNoBlocking() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(windows = emptyList())))
    @Test fun emptySelectionBlocksNothing() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(selected = emptySet())))
    @Test fun bypassSuspensionBehavesLikeRitualSuspension() = assertEquals(Decision.Allow, RestrictionDecision.decide(input(suspended = 1_999)))
}

class TierResolverTest {
    private val all = TierInput(true, true, true, true, true, false, false)

    @Test fun tier1WhenEverythingIsGranted() { val r = TierResolver.resolve(all); assertEquals(Tier.TIER1, r.tier); assertTrue(r.unmet.isEmpty()) }
    @Test fun tier0WhenUsageAccessMissing() { val r = TierResolver.resolve(all.copy(hasUsageAccess = false)); assertEquals(Tier.TIER0, r.tier); assertEquals(listOf(Requirement.USAGE_ACCESS), r.unmet.map { it.requirement }) }
    @Test fun tier0WhenOverlayMissing() = assertEquals(Tier.TIER0, TierResolver.resolve(all.copy(hasOverlay = false)).tier)
    @Test fun tier0WhenServiceStopped() { val r = TierResolver.resolve(all.copy(serviceRunning = false)); assertEquals(Tier.TIER0, r.tier); assertTrue(r.unmet.any { it.requirement == Requirement.SERVICE }) }
    @Test fun tier0WhenFlagOff() = assertEquals(Tier.TIER0, TierResolver.resolve(all.copy(tier1FlagEnabled = false)).tier)
    @Test fun missingNotificationsDoesNotLowerTierButIsReported() { val r = TierResolver.resolve(all.copy(notificationsGranted = false)); assertEquals(Tier.TIER1, r.tier); assertTrue(r.unmet.any { it.requirement == Requirement.NOTIFICATIONS }) }
    @Test fun tier2NeedsFlagAndServiceBoth() {
        assertEquals(Tier.TIER1, TierResolver.resolve(all.copy(accessibilityServiceEnabled = true)).tier)
        assertEquals(Tier.TIER1, TierResolver.resolve(all.copy(accessibilityFlagEnabled = true)).tier)
        assertEquals(Tier.TIER2, TierResolver.resolve(all.copy(accessibilityFlagEnabled = true, accessibilityServiceEnabled = true)).tier)
    }
    @Test fun accessibilityDefaultsOffSoNoTier2() = assertTrue(TierResolver.resolve(all).tier != Tier.TIER2)
    @Test fun everythingMissingIsTier0WithEveryReason() { val r = TierResolver.resolve(TierInput(false, false, false, false, false, false, false)); assertEquals(Tier.TIER0, r.tier); assertEquals(5, r.unmet.size) }
}
