/**
 * Exact Binomial Probability and Statistical Analysis for Zener ESP Testing.
 * Baseline chance p = 1/5 = 0.20.
 */

const StatsEngine = (function() {
    const P_CHANCE = 0.20;

    /**
     * Exact Binomial Probability Mass Function: P(X = k | n, p)
     * Calculated in log-space to prevent integer overflow.
     */
    function binomialPMF(n, k, p = P_CHANCE) {
        if (k < 0 || k > n) return 0;
        let logCoeff = 0;
        for (let i = 1; i <= k; i++) {
            logCoeff += Math.log(n - i + 1) - Math.log(i);
        }
        const logP = logCoeff + k * Math.log(p) + (n - k) * Math.log(1 - p);
        return Math.exp(logP);
    }

    /**
     * Computes full exact statistical metrics for n trials and k hits.
     * @param {number} n - Total completed trials
     * @param {number} k - Observed hits
     * @param {number} p - Baseline chance (0.20)
     */
    function calculateStats(n, k, p = P_CHANCE) {
        if (n === 0) {
            return {
                total: 0,
                hits: 0,
                hitRatePct: 0,
                expectedHits: 0,
                deviationPct: 0,
                pOneSided: 1,
                pTwoSided: 1,
                direction: 'none',
                classification: 'No trials completed',
                badgeClass: 'text-slate-400'
            };
        }

        const expectedHits = n * p;
        const hitRatePct = (k / n) * 100;
        const deviationPct = hitRatePct - (p * 100);

        // Precompute PMFs for all outcomes 0..n
        const pmfs = [];
        for (let i = 0; i <= n; i++) {
            pmfs.push(binomialPMF(n, i, p));
        }

        // Exact One-Sided p-value:
        // If k >= expected: P(X >= k)
        // If k < expected: P(X <= k)
        let pOneSided = 0;
        if (k >= expectedHits) {
            for (let i = k; i <= n; i++) pOneSided += pmfs[i];
        } else {
            for (let i = 0; i <= k; i++) pOneSided += pmfs[i];
        }

        // Exact Two-Sided p-value (Fisher's exact sum of probabilities <= P(X = k))
        const targetP = pmfs[k];
        let pTwoSided = 0;
        for (let i = 0; i <= n; i++) {
            if (pmfs[i] <= targetP * (1 + 1e-9)) {
                pTwoSided += pmfs[i];
            }
        }

        pOneSided = Math.min(1.0, Math.max(0, pOneSided));
        pTwoSided = Math.min(1.0, Math.max(0, pTwoSided));

        const direction = k > expectedHits ? 'above' : (k < expectedHits ? 'below' : 'equal');

        // Scientific classification
        let classification = 'Consistent with Chance (p ≥ 0.05)';
        let badgeClass = 'text-slate-400';

        if (pTwoSided < 0.01) {
            if (direction === 'above') {
                classification = 'Highly Significant: Psi-Hitting (p < 0.01) ✨✨';
                badgeClass = 'text-emerald-400';
            } else if (direction === 'below') {
                classification = 'Highly Significant: Psi-Missing (p < 0.01) 🔍✨';
                badgeClass = 'text-amber-400';
            }
        } else if (pTwoSided < 0.05) {
            if (direction === 'above') {
                classification = 'Statistically Significant: Above Chance (p < 0.05) ✨';
                badgeClass = 'text-emerald-400';
            } else if (direction === 'below') {
                classification = 'Statistically Significant: Below Chance (p < 0.05) 🔍';
                badgeClass = 'text-amber-400';
            }
        }

        return {
            total: n,
            hits: k,
            hitRatePct,
            expectedHits,
            deviationPct,
            pOneSided,
            pTwoSided,
            direction,
            classification,
            badgeClass
        };
    }

    return {
        P_CHANCE,
        binomialPMF,
        calculateStats
    };
})();
