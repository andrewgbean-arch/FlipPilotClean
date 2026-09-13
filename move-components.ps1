# FlipPilot OS Component Reorganisation Script (Safe Version)
# Run from project root: powershell -ExecutionPolicy Bypass -File move-components.ps1

$root = "src/components"

# Create module folders
$folders = @(
    "core",
    "motors",
    "marketplace",
    "ai",
    "ui",
    "analytics",
    "navigation"
)

foreach ($f in $folders) {
    $path = "$root/$f"
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host "Created folder: $path"
    }
}

function Move-Safe($file, $folder) {
    $src = "$root/$file"
    $dest = "$root/$folder/$file"

    if (Test-Path $src) {
        Move-Item -Path $src -Destination $dest -Force
        Write-Host "Moved $file → $folder"
    } else {
        Write-Host "SKIPPED (not found): $file"
    }
}

# CORE
Move-Safe "AchievementsCard.tsx" "core"
Move-Safe "FlipDifficultyScore.tsx" "core"
Move-Safe "FlipIntelligencePanel.tsx" "core"
Move-Safe "LiveProfitCounter.tsx" "core"
Move-Safe "VerdictBadge.tsx" "core"
Move-Safe "SellerBadges.tsx" "core"
Move-Safe "RecommendationsCard.tsx" "core"
Move-Safe "WeatherCard.tsx" "core"
Move-Safe "CategoryBadge.tsx" "core"
Move-Safe "BuyerSafetyScore.tsx" "core"
Move-Safe "DealProbabilityAI.tsx" "core"
Move-Safe "OfferCalculator.tsx" "core"
Move-Safe "BreakdownModal.tsx" "core"
Move-Safe "CalculatorModal.tsx" "core"
Move-Safe "WarningModel.tsx" "core"

# MOTORS
Move-Safe "CarHistoryChecker.tsx" "motors"
Move-Safe "MileageFlow.tsx" "motors"
Move-Safe "MileageRiskScore.tsx" "motors"
Move-Safe "MOTAdvisoriesList.tsx" "motors"
Move-Safe "MOTExpiryCountdown.tsx" "motors"
Move-Safe "MOTExpiryCountdownCard.tsx" "motors"
Move-Safe "MOTFailuresList.tsx" "motors"
Move-Safe "MOTHealthScore.tsx" "motors"
Move-Safe "MOTInsightsPanel.tsx" "motors"
Move-Safe "MOTMileageHistory.tsx" "motors"
Move-Safe "MOTPredictionCard.tsx" "motors"
Move-Safe "MOTStatusBadge.tsx" "motors"
Move-Safe "MOTStatusCard.tsx" "motors"
Move-Safe "VehicleActionsRow.tsx" "motors"
Move-Safe "VehicleHeaderCard.tsx" "motors"
Move-Safe "VehicleSummaryCard.tsx" "motors"

# MARKETPLACE
Move-Safe "MarketplaceListingCard.tsx" "marketplace"
Move-Safe "SponsoredCard.tsx" "marketplace"
Move-Safe "ListingQualityScore.tsx" "marketplace"
Move-Safe "PriceDropPredictor.tsx" "marketplace"

# AI
Move-Safe "AIBubble.tsx" "ai"
Move-Safe "AIChatWindow.tsx" "ai"
Move-Safe "NegotiationAI.tsx" "ai"
Move-Safe "PhotoAnalyzer.tsx" "ai"
Move-Safe "ValuationEngine.tsx" "ai"

# UI
Move-Safe "AnimatedButton.tsx" "ui"
Move-Safe "AnimatedHeroHeader.tsx" "ui"
Move-Safe "AnimatedPressable.tsx" "ui"
Move-Safe "GoldButton.tsx" "ui"
Move-Safe "GoldFlashOverlay.tsx" "ui"
Move-Safe "GoldLightning.tsx" "ui"
Move-Safe "GoldParticles.tsx" "ui"
Move-Safe "GoldParticlesBurst.tsx" "ui"
Move-Safe "GoldTrail.tsx" "ui"
Move-Safe "GlowPulseCard.tsx" "ui"
Move-Safe "HeroHeader.tsx" "ui"
Move-Safe "SparklesOverlay.tsx" "ui"
Move-Safe "SymbolView.tsx" "ui"
Move-Safe "external-link.tsx" "ui"
Move-Safe "hint-row.tsx" "ui"

# ANALYTICS
Move-Safe "MarketHeatIndex.tsx" "analytics"
Move-Safe "FlipScoreMeter.tsx" "analytics"
Move-Safe "ConfidenceMeter.tsx" "analytics"
Move-Safe "PriceDropPredictor.tsx" "analytics"
Move-Safe "ValuationEngine.tsx" "analytics"

# NAVIGATION
Move-Safe "CustomTabBar.tsx" "navigation"

Write-Host "`n🎉 FlipPilot OS component structure updated successfully!"
