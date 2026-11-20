# Design system

Visual direction: warm and peaceful, audience 16 to 30, balanced gamification. Light mode is the default; dark mode follows the system setting.

## Brand palette and roles

| Brand colour | Hex | Role |
| --- | --- | --- |
| Warm ivory | #F7F4EC | Light background, dark mode text |
| Sage green | #87977A | Fills only: primary buttons, progress ring, selected chips |
| Muted olive | #B1B99A | Tint source for `surfaceAlt` (chips, rows, tracks) |
| Soft gold | #D8B875 | Fills only: milestones, completed ring, streak flame |
| Deep charcoal | #292B26 | Text in light mode, label on sage and gold fills, dark surface |
| Warm grey | #77766F | Not used as text (4.15:1 on ivory). Source for muted text and borders |

Raw sage, gold and warm grey fail WCAG AA as text on ivory (2.84, 1.73 and 4.15 to 1 respectively; asserted in `theme.test.ts`). Text and icons therefore use derived roles:

- `accentText` (#4F5E43 light, #9BAA8D dark): text, icons and outlines in the accent family.
- `textMuted` (#66655E light, #B1B0A7 dark): secondary copy.
- `onAccent` / `onHighlight`: charcoal labels on sage and gold fills.
- `borderStrong`: input and control outlines, at least 3:1.

Every role pair the UI draws is asserted in `apps/mobile/src/theme/theme.test.ts` for light and dark (AA 4.5:1 for text, 3:1 for graphics).

## Components (`apps/mobile/src/components`)

Core: Button (pill, 52pt), Card, AppText, Heading, ScriptureText, PrayerText, StepIndicator, Timer, StatusBadge, PermissionRow, EmptyState, ErrorState, Skeleton.

Added in Phase 1 (`visuals.tsx`): Icon (10 stroke icons via react-native-svg), ProgressRing, StreakCard, WeekStrip, MilestoneBadge, ListRow, Chip.

## Gamification rules

- Progress is shown as rings, week strips and earned badges. Gold marks achievement.
- A missed day is a neutral dashed outline. No red, no loss language, no countdown pressure.
- Copy encourages return ("Welcome back. Every day counts.").
- Achievements are derived from stored completion history; none are awarded by a local flag alone.

## Accessibility

Touch targets 48pt or larger, every control has a role and label, state is never colour alone (selected chips add border weight and accessibility state), font scale up to 250 percent, reduced motion respected, decorative icons hidden from screen readers.
