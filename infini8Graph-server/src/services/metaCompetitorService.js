import axios from 'axios';
import runtimeStateService from './runtimeStateService.js';

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const AD_ARCHIVE_FIELDS = [
    'id',
    'page_id',
    'page_name',
    'ad_delivery_start_time',
    'ad_delivery_stop_time',
    'ad_creative_bodies',
    'ad_creative_link_titles',
    'ad_creative_link_descriptions',
    'ad_creative_link_captions',
    'ad_snapshot_url',
    'publisher_platforms'
].join(',');
const PUBLIC_SEARCH_URL = 'https://html.duckduckgo.com/html/';
const DISCOVERY_CACHE_KEY_PREFIX = 'competitor-discovery-candidates';
const PUBLIC_SEARCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const COUNTRY_LABELS = {
    IN: 'India',
    US: 'United States',
    GB: 'United Kingdom',
    AE: 'UAE',
    SG: 'Singapore',
    MY: 'Malaysia'
};

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'best', 'big', 'buy', 'by', 'for', 'from', 'get', 'has',
    'have', 'in', 'into', 'is', 'it', 'its', 'just', 'more', 'new', 'now', 'of', 'on', 'or', 'our', 'out',
    'shop', 'show', 'the', 'this', 'to', 'up', 'visit', 'we', 'with', 'your'
]);

const OFFER_PATTERNS = [
    { key: 'discount', regex: /\b(\d+%\s*off|flat\s*\d+%|save\s*\d+%|discount|deal|offer|sale|festival sale)\b/i, label: 'Discount-led' },
    { key: 'pricing', regex: /\b(under\s*[₹$]?\d+|starting\s*at|from\s*[₹$]?\d+|price drop|lowest price)\b/i, label: 'Price-led' },
    { key: 'bundle', regex: /\b(bundle|combo|pack|2 for|3 for|buy 1 get|bogo)\b/i, label: 'Bundle-led' },
    { key: 'shipping', regex: /\b(free shipping|free delivery|cash on delivery|cod|same day delivery)\b/i, label: 'Fulfillment-led' },
    { key: 'urgency', regex: /\b(limited time|today only|ends tonight|last chance|hurry|while stocks last)\b/i, label: 'Urgency-led' },
    { key: 'message', regex: /\b(dm|message us|whatsapp|call now|book now)\b/i, label: 'Conversation-led' }
];

const CTA_PATTERNS = [
    'shop now',
    'buy now',
    'learn more',
    'visit now',
    'order now',
    'book now',
    'send message',
    'message us',
    'whatsapp',
    'call now',
    'sign up',
    'register now'
];

const ANGLE_PATTERNS = [
    { label: 'Price-led', regex: /\b(price|lowest|save|off|deal|discount|starting at|under ₹|under \$)\b/i },
    { label: 'Urgency-led', regex: /\b(today only|ends tonight|limited time|last chance|hurry|while stocks last)\b/i },
    { label: 'Selection-led', regex: /\b(collection|styles|range|catalog|many options|assortment|shop all)\b/i },
    { label: 'Trust-led', regex: /\b(reviews|trusted|bestseller|customers love|top rated|since \d{4})\b/i },
    { label: 'Convenience-led', regex: /\b(free delivery|same day|cod|cash on delivery|easy returns|doorstep)\b/i },
    { label: 'Event-led', regex: /\b(festival|summer sale|wedding|school opening|diwali|ramzan|pongal|eid)\b/i },
    { label: 'Message-led', regex: /\b(dm|message|whatsapp|chat|comment)\b/i }
];

const VISUAL_PATTERNS = [
    { label: 'UGC/Testimonial-style', regex: /\b(review|customer|before and after|testimonial|real people|unboxing)\b/i },
    { label: 'Catalog-style', regex: /\b(collection|range|catalog|styles|shop all|many options)\b/i },
    { label: 'Offer-card style', regex: /\b(off|save|sale|starting at|lowest price|limited time)\b/i },
    { label: 'Founder/brand-story style', regex: /\b(our story|we started|founder|family business|since \d{4})\b/i },
    { label: 'Conversation-led style', regex: /\b(dm|message|whatsapp|comment)\b/i }
];

const REGIONAL_TERMS = {
    IN: [
        'chennai', 'coimbatore', 'madurai', 'trichy', 'salem', 'erode', 'tamil nadu', 'bangalore',
        'bengaluru', 'hyderabad', 'kerala', 'kochi', 'mumbai', 'delhi', 'india', '₹', 'rs.', 'rupees',
        'pongal', 'ugadi', 'onam', 'navratri', 'diwali', 'eid', 'ramzan'
    ]
};

const BRAND_SUFFIX_PATTERNS = [
    'wear',
    'store',
    'stores',
    'fashion',
    'fashions',
    'style',
    'styles',
    'boutique',
    'clothing',
    'apparel',
    'collection',
    'collections',
    'sarees',
    'saree',
    'ethnic',
    'closet'
];

function asArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s₹$%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(value, length = 180) {
    if (!value) return '';
    return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function toTitleCase(value) {
    return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function buildSearchVariants(query) {
    const original = String(query || '').trim();
    const normalized = normalizeText(original);
    const noSpaces = normalized.replace(/\s+/g, '');
    const variants = new Set([original, normalized, noSpaces, toTitleCase(normalized)]);

    for (const suffix of BRAND_SUFFIX_PATTERNS) {
        const condensedSuffix = new RegExp(`([a-z])(${suffix})$`, 'i');
        if (condensedSuffix.test(original)) {
            variants.add(original.replace(condensedSuffix, `$1 ${suffix}`));
        }

        if (noSpaces.endsWith(suffix)) {
            const base = noSpaces.slice(0, noSpaces.length - suffix.length).trim();
            if (base.length >= 3) {
                variants.add(`${base} ${suffix}`);
                variants.add(toTitleCase(`${base} ${suffix}`));
            }
        }
    }

    if (normalized.includes(' ')) {
        variants.add(normalized.replace(/\s+/g, ''));
    }

    return [...variants]
        .map((value) => value.trim())
        .filter((value, index, arr) => value.length >= 2 && arr.indexOf(value) === index)
        .slice(0, 8);
}

function getDiscoveryCacheKey(userId) {
    return `${DISCOVERY_CACHE_KEY_PREFIX}:${userId}`;
}

function htmlDecode(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function stripHtml(value) {
    return htmlDecode(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function safeUrl(rawValue) {
    try {
        const parsed = new URL(rawValue, 'https://duckduckgo.com');
        const redirectTarget = parsed.searchParams.get('uddg');
        const finalUrl = redirectTarget ? decodeURIComponent(redirectTarget) : parsed.toString();
        return new URL(finalUrl);
    } catch {
        return null;
    }
}

function extractDomain(urlValue) {
    const parsed = safeUrl(urlValue);
    if (!parsed) return null;
    return parsed.hostname.replace(/^www\./, '');
}

function normalizeDomain(urlValue) {
    const domain = extractDomain(urlValue);
    if (!domain) return null;
    return domain.toLowerCase();
}

function extractInstagramHandle(urlValue) {
    const parsed = safeUrl(urlValue);
    if (!parsed || !parsed.hostname.includes('instagram.com')) return null;
    const segment = parsed.pathname.split('/').filter(Boolean)[0];
    if (!segment || ['p', 'reel', 'explore', 'stories', 'accounts'].includes(segment.toLowerCase())) return null;
    return segment;
}

function sanitizeProfileUrl(urlValue) {
    const parsed = safeUrl(urlValue);
    if (!parsed) return null;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

function normalizeCandidateKey(candidate) {
    return candidate.pageId
        || candidate.pageUrl
        || candidate.instagramUrl
        || candidate.website
        || `name:${normalizeText(candidate.name || candidate.searchTerms || '')}`;
}

function cleanBrandTitle(title, urlValue) {
    const domain = normalizeDomain(urlValue) || '';
    let cleaned = stripHtml(title)
        .replace(/\s*[-|]\s*Facebook.*$/i, '')
        .replace(/\s*[-|]\s*Instagram.*$/i, '')
        .replace(/\s*[-|]\s*Official.*$/i, '')
        .replace(/\s*•\s*Instagram photos.*$/i, '')
        .replace(/\s*\/\s*Facebook.*$/i, '')
        .trim();

    if (!cleaned && domain) {
        cleaned = domain.split('.')[0];
    }

    return cleaned;
}

function scoreNameMatch(name, query) {
    const normalizedQuery = normalizeText(query);
    const normalizedName = normalizeText(name);
    const condensedQuery = normalizedQuery.replace(/\s+/g, '');
    const condensedName = normalizedName.replace(/\s+/g, '');

    if (!normalizedName) return 0;
    if (normalizedName === normalizedQuery || condensedName === condensedQuery) return 120;
    if (normalizedName.startsWith(normalizedQuery) || condensedName.startsWith(condensedQuery)) return 85;
    if (normalizedName.includes(normalizedQuery) || condensedName.includes(condensedQuery)) return 60;
    return 0;
}

async function getCachedDiscoveryCandidates(userId, query) {
    if (!userId) return [];

    try {
        const existing = await runtimeStateService.getRuntimeCache(getDiscoveryCacheKey(userId));
        const cachedEntries = Array.isArray(existing) ? existing : [];
        const normalizedQuery = normalizeText(query);

        return cachedEntries
            .filter((candidate) => {
                const haystack = normalizeText([
                    candidate.name,
                    candidate.searchTerms,
                    candidate.instagramHandle,
                    candidate.website
                ].filter(Boolean).join(' '));
                return haystack.includes(normalizedQuery);
            })
            .slice(0, 6)
            .map((candidate) => ({
                ...candidate,
                source: candidate.source ? `${candidate.source}+cache` : 'cache',
                cacheHits: (candidate.cacheHits || 0) + 1
            }));
    } catch {
        return [];
    }
}

async function rememberDiscoveryCandidates(userId, candidates) {
    if (!userId || !Array.isArray(candidates) || candidates.length === 0) return;

    try {
        const cacheKey = getDiscoveryCacheKey(userId);
        const existing = await runtimeStateService.getRuntimeCache(cacheKey);
        const merged = new Map();

        for (const candidate of Array.isArray(existing) ? existing : []) {
            merged.set(normalizeCandidateKey(candidate), candidate);
        }

        for (const candidate of candidates) {
            const key = normalizeCandidateKey(candidate);
            const previous = merged.get(key);
            merged.set(key, {
                ...previous,
                ...candidate,
                lastSeenAt: new Date().toISOString()
            });
        }

        const stored = [...merged.values()].slice(0, 120);
        await runtimeStateService.setRuntimeCache(cacheKey, stored, 60 * 60 * 24 * 30);
    } catch {
        // Discovery cache is a best-effort accelerator, not a hard dependency.
    }
}

function parseDuckDuckGoResults(html) {
    const results = [];
    const anchorRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
    let match;

    while ((match = anchorRegex.exec(html)) && results.length < 10) {
        const href = match[1];
        const title = cleanBrandTitle(match[2], href);
        const url = sanitizeProfileUrl(href);
        if (!url) continue;
        results.push({ title, url });
    }

    return results;
}

async function searchPublicWeb(query) {
    const response = await axios.get(PUBLIC_SEARCH_URL, {
        params: { q: query, kl: 'wt-wt' },
        timeout: 12000,
        headers: {
            'User-Agent': PUBLIC_SEARCH_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    return parseDuckDuckGoResults(response.data);
}

function buildPublicSearchQueries(query, country) {
    const variants = buildSearchVariants(query).slice(0, 4);
    const countryLabel = COUNTRY_LABELS[country] || '';

    const queries = [
        `${variants[0] || query} official website`,
        `${variants[0] || query} instagram`,
        `${variants[0] || query} facebook`
    ];

    for (const variant of variants) {
        queries.push(`site:facebook.com "${variant}"`);
        queries.push(`site:instagram.com "${variant}"`);
        if (countryLabel) {
            queries.push(`"${variant}" "${countryLabel}" site:facebook.com`);
            queries.push(`"${variant}" "${countryLabel}" site:instagram.com`);
        }
    }

    return unique(queries).slice(0, 8);
}

function mapPublicSearchResultToCandidate(result, query) {
    const domain = normalizeDomain(result.url);
    const instagramHandle = extractInstagramHandle(result.url);
    const title = cleanBrandTitle(result.title, result.url) || query;

    if (!domain) return null;

    if (domain.includes('facebook.com')) {
        return {
            name: title,
            pageUrl: sanitizeProfileUrl(result.url),
            pictureUrl: null,
            category: null,
            website: null,
            locationHint: null,
            instagramHandle: null,
            instagramUrl: null,
            searchTerms: title || query,
            source: 'web-facebook',
            publicHits: 1
        };
    }

    if (domain.includes('instagram.com')) {
        return {
            name: title,
            pageUrl: null,
            pictureUrl: null,
            category: null,
            website: null,
            locationHint: null,
            instagramHandle,
            instagramUrl: sanitizeProfileUrl(result.url),
            searchTerms: instagramHandle || title || query,
            source: 'web-instagram',
            publicHits: 1
        };
    }

    return {
        name: title,
        pageUrl: null,
        pictureUrl: null,
        category: null,
        website: sanitizeProfileUrl(result.url),
        locationHint: null,
        instagramHandle: null,
        instagramUrl: null,
        searchTerms: title || query,
        source: 'web-domain',
        publicHits: 1
    };
}

function extractKeywords(text, limit = 4) {
    const counts = {};
    for (const word of normalizeText(text).split(' ')) {
        if (!word || word.length < 4 || STOP_WORDS.has(word)) continue;
        counts[word] = (counts[word] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word);
}

function getPrimaryText(ad) {
    return asArray(ad.ad_creative_bodies)[0]
        || asArray(ad.ad_creative_link_titles)[0]
        || asArray(ad.ad_creative_link_descriptions)[0]
        || asArray(ad.ad_creative_link_captions)[0]
        || '';
}

function getCombinedText(ad) {
    return [
        ...asArray(ad.ad_creative_bodies),
        ...asArray(ad.ad_creative_link_titles),
        ...asArray(ad.ad_creative_link_descriptions),
        ...asArray(ad.ad_creative_link_captions)
    ].join(' | ');
}

function getLongevityDays(startTime, stopTime) {
    if (!startTime) return 0;
    const start = new Date(startTime);
    const end = stopTime ? new Date(stopTime) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diffMs = Math.max(end.getTime() - start.getTime(), 0);
    return Math.round(diffMs / 86400000);
}

function detectOfferSignals(text) {
    return OFFER_PATTERNS.filter((pattern) => pattern.regex.test(text));
}

function detectCreativeAngle(text) {
    return ANGLE_PATTERNS.find((pattern) => pattern.regex.test(text))?.label || 'Value-led';
}

function detectVisualPattern(text) {
    return VISUAL_PATTERNS.find((pattern) => pattern.regex.test(text))?.label || 'Mixed creative';
}

function detectRegionalSignals(rawText, country) {
    const normalized = normalizeText(rawText);
    const regionalMatches = unique((REGIONAL_TERMS[country] || []).filter((term) => normalized.includes(normalizeText(term))));
    const scriptHints = [];

    if (/[\u0B80-\u0BFF]/.test(rawText)) scriptHints.push('Tamil script');
    if (/[\u0900-\u097F]/.test(rawText)) scriptHints.push('Hindi/Devanagari script');
    if (/[\u0C00-\u0C7F]/.test(rawText)) scriptHints.push('Telugu/Kannada script');

    return unique([...regionalMatches, ...scriptHints]);
}

function scoreHook(text) {
    const normalized = normalizeText(text);
    if (!normalized) return 0;

    let score = 0;
    const firstWords = normalized.split(' ').slice(0, 8).join(' ');

    if (/\d/.test(firstWords) || /₹|%|\$/.test(text)) score += 2;
    if (/\b(free|sale|offer|limited|new|save|shop|today)\b/i.test(firstWords)) score += 2;
    if (firstWords.length >= 20 && firstWords.length <= 70) score += 2;
    if (/[!?]/.test(text.slice(0, 80))) score += 1;

    return Math.min(score, 5);
}

function scoreCta(ctaMatches) {
    return Math.min(ctaMatches.length * 2, 5);
}

function scoreContinuity(title, description, caption, body) {
    const sourceKeywords = extractKeywords([title, description, caption].filter(Boolean).join(' '), 6);
    if (sourceKeywords.length === 0) return 1;
    const bodyNormalized = normalizeText(body);
    const overlap = sourceKeywords.filter((keyword) => bodyNormalized.includes(keyword)).length;
    if (overlap >= 3) return 5;
    if (overlap === 2) return 4;
    if (overlap === 1) return 3;
    return 1;
}

function buildAngleSignature(adAnalysis) {
    const offerKey = adAnalysis.offerSignals[0]?.key || 'generic';
    const keywordKey = adAnalysis.keywords.slice(0, 2).join('-') || 'broad';
    return `${adAnalysis.angle}|${offerKey}|${keywordKey}`;
}

function getConfidence(score) {
    if (score >= 80) return 'High';
    if (score >= 55) return 'Medium';
    return 'Exploratory';
}

function buildWhyItMayWork(adAnalysis) {
    const reasons = [];

    if (adAnalysis.longevityDays >= 21) {
        reasons.push(`It has stayed live for ${adAnalysis.longevityDays} days, which is often a keep-running signal.`);
    }
    if (adAnalysis.repetitionCount >= 2) {
        reasons.push(`The same angle appears across ${adAnalysis.repetitionCount} similar variants, suggesting the brand keeps iterating on it.`);
    }
    if (adAnalysis.offerSignals.length > 0) {
        reasons.push(`The creative leads with ${adAnalysis.offerSignals.map((signal) => signal.label.toLowerCase()).join(', ')}, which tends to compress decision time.`);
    }
    if (adAnalysis.hookStrength >= 4) {
        reasons.push('The opening line is concise and value-first, so the hook is easy to understand quickly.');
    }
    if (adAnalysis.ctaSignals.length > 0) {
        reasons.push(`The CTA is explicit (${adAnalysis.ctaSignals.slice(0, 2).join(', ')}), which reduces ambiguity about the next step.`);
    }
    if (adAnalysis.regionalSignals.length > 0) {
        reasons.push(`It uses local cues such as ${adAnalysis.regionalSignals.slice(0, 2).join(', ')}, which can lift relevance for regional audiences.`);
    }
    if (adAnalysis.platformSpread > 1) {
        reasons.push(`It is distributed across ${adAnalysis.platformSpread} Meta placements, which usually means the concept is portable.`);
    }
    if (adAnalysis.continuityScore >= 4) {
        reasons.push('The body, headline, and link text stay aligned, so the click journey looks consistent.');
    }

    return reasons.slice(0, 3);
}

function buildWhatToTest(adAnalysis) {
    const ideas = [];

    if (adAnalysis.angle === 'Price-led' || adAnalysis.offerSignals.some((signal) => signal.key === 'discount')) {
        ideas.push('Test a stronger value-first first frame with the price or discount in the opening line.');
    }
    if (adAnalysis.regionalSignals.length > 0) {
        ideas.push('Try a localized copy variant or region-specific hook instead of one generic message.');
    }
    if (adAnalysis.repetitionCount >= 2) {
        ideas.push('Build 3-5 close variants around the same winning angle instead of one single creative.');
    }
    if (adAnalysis.platformSpread > 1) {
        ideas.push('Adapt the same message for Feed and vertical placements so the angle scales across surfaces.');
    }
    if (adAnalysis.hookStrength < 3) {
        ideas.push('Keep the offer, but test a clearer first sentence so the benefit lands faster.');
    }

    if (ideas.length === 0) {
        ideas.push('Test the same core angle with a clearer offer stack and a sharper CTA.');
    }

    return unique(ideas).slice(0, 3);
}

function summarizeTopItems(items, field, fallback) {
    const counts = {};
    for (const item of items) {
        counts[item[field]] = (counts[item[field]] || 0) + 1;
    }

    const topItems = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, count]) => `${label} (${count})`);

    return topItems.length > 0 ? topItems.join(', ') : fallback;
}

function buildAccountSummary(ads, country) {
    const activeAds = ads.filter((ad) => !ad.adDeliveryStopTime || new Date(ad.adDeliveryStopTime) > new Date());
    const longRunningAds = ads.filter((ad) => ad.longevityDays >= 21);
    const repeatedClusters = unique(ads.filter((ad) => ad.repetitionCount >= 2).map((ad) => ad.signature));
    const localizedAds = ads.filter((ad) => ad.regionalSignals.length > 0);
    const multiPlatformAds = ads.filter((ad) => ad.platformSpread > 1);
    const avgLongevity = ads.length > 0
        ? Math.round(ads.reduce((sum, ad) => sum + ad.longevityDays, 0) / ads.length)
        : 0;

    const topAngles = Object.entries(ads.reduce((acc, ad) => {
        acc[ad.angle] = (acc[ad.angle] || 0) + 1;
        return acc;
    }, {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([angle, count]) => ({ angle, count }));

    const topOffers = Object.entries(ads.flatMap((ad) => ad.offerSignals.map((signal) => signal.label)).reduce((acc, label) => {
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([label, count]) => ({ label, count }));

    const confidenceScore = Math.min(
        100,
        (ads.length >= 8 ? 30 : ads.length >= 4 ? 20 : 10)
        + (longRunningAds.length >= 3 ? 25 : longRunningAds.length > 0 ? 12 : 0)
        + (repeatedClusters.length >= 2 ? 20 : repeatedClusters.length > 0 ? 10 : 0)
        + (localizedAds.length > 0 ? 10 : 0)
        + (multiPlatformAds.length > 0 ? 10 : 0)
        + (topOffers.length > 0 ? 5 : 0)
    );

    return {
        overview: {
            totalAds: ads.length,
            activeAds: activeAds.length,
            longRunningAds: longRunningAds.length,
            avgLongevityDays: avgLongevity,
            repeatedAngleClusters: repeatedClusters.length,
            multiPlatformAds: multiPlatformAds.length,
            localizedAds: localizedAds.length
        },
        topAngles,
        topOffers,
        creativeAngleSummary: topAngles.length > 0
            ? `This competitor is leaning hardest on ${summarizeTopItems(topAngles, 'angle', 'broad messaging')}.`
            : 'There is not enough public creative text yet to summarize their angle mix.',
        offerAnalysis: topOffers.length > 0
            ? `The repeated offer patterns are ${summarizeTopItems(topOffers, 'label', 'no clear offer pattern')}. ${longRunningAds.length} creatives have stayed live for 21+ days, which is a useful proxy for sustained value.`
            : 'The current public creatives do not show one dominant offer mechanic yet.',
        regionalRelevanceAnalysis: localizedAds.length > 0
            ? `${localizedAds.length} ads use local signals tied to ${country}, which suggests the brand is tailoring creative to regional context instead of running one generic national message.`
            : `Most of the public ads look generic rather than explicitly localized for ${country}.`,
        likelyPerformanceRationale: unique(ads.flatMap((ad) => ad.whyItMayWork)).slice(0, 4),
        whatToTest: unique(ads.flatMap((ad) => ad.whatToTest)).slice(0, 4),
        confidenceLevel: getConfidence(confidenceScore),
        confidenceScore
    };
}

function mapSearchCandidate(candidate, query) {
    const pictureUrl = candidate.picture?.data?.url || null;
    const locationHint = [
        candidate.location?.city,
        candidate.location?.state,
        candidate.location?.country
    ].filter(Boolean).join(', ');

    return {
        pageId: candidate.id ? String(candidate.id) : null,
        name: candidate.name || query,
        pageUrl: candidate.link || null,
        pictureUrl,
        category: candidate.category || null,
        website: candidate.website || null,
        locationHint: locationHint || null,
        instagramHandle: candidate.instagram_business_account?.username || null,
        instagramUrl: candidate.instagram_business_account?.username
            ? `https://www.instagram.com/${candidate.instagram_business_account.username}/`
            : null,
        searchTerms: candidate.name || query
    };
}

async function fetchAdsArchive(accessToken, params) {
    try {
        return await axios.get(`${GRAPH_API_BASE}/ads_archive`, {
            params
        });
    } catch (error) {
        if (params.search_terms) {
            const retryParams = {
                ...params,
                search_term: params.search_terms
            };
            delete retryParams.search_terms;
            return axios.get(`${GRAPH_API_BASE}/ads_archive`, { params: retryParams });
        }
        throw error;
    }
}

async function searchPagesByVariant(accessToken, variant) {
    try {
        const response = await axios.get(`${GRAPH_API_BASE}/search`, {
            params: {
                access_token: accessToken,
                type: 'page',
                q: variant,
                fields: 'id,name,link,category,website,location,picture{url},instagram_business_account{id,username}',
                limit: 8
            }
        });

        return response.data.data || [];
    } catch {
        const fallback = await axios.get(`${GRAPH_API_BASE}/search`, {
            params: {
                access_token: accessToken,
                type: 'page',
                q: variant,
                fields: 'id,name,link,category,website,location,picture{url}',
                limit: 8
            }
        });

        return fallback.data.data || [];
    }
}

async function searchAdsArchiveCandidates(accessToken, variant) {
    const response = await fetchAdsArchive(accessToken, {
        access_token: accessToken,
        ad_type: 'ALL',
        ad_active_status: 'ALL',
        search_terms: variant,
        fields: 'page_id,page_name,ad_snapshot_url,publisher_platforms',
        limit: 20
    });

    return response.data.data || [];
}

async function enrichPageCandidate(accessToken, pageId, fallbackName, query) {
    try {
        const response = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,link,category,website,location,picture{url},instagram_business_account{id,username}'
            }
        });

        return mapSearchCandidate(response.data, query);
    } catch {
        try {
            const fallback = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,link,category,website,location,picture{url}'
                }
            });

            return mapSearchCandidate(fallback.data, query);
        } catch {
            return {
                pageId: String(pageId),
                name: fallbackName || query,
                pageUrl: null,
                pictureUrl: null,
                category: null,
                website: null,
                locationHint: null,
                instagramHandle: null,
                searchTerms: fallbackName || query
            };
        }
    }
}

function computeCandidateScore(candidate, query, variantHits = 0, archiveHits = 0) {
    const condensedQuery = normalizeText(query).replace(/\s+/g, '');
    let score = scoreNameMatch(candidate.name, query);
    if (candidate.instagramHandle && normalizeText(candidate.instagramHandle).includes(condensedQuery)) score += 35;
    if (candidate.website && normalizeText(candidate.website).includes(condensedQuery)) score += 25;
    if (candidate.pageUrl && normalizeText(candidate.pageUrl).includes(condensedQuery)) score += 18;
    if (candidate.category) score += 5;
    if (candidate.locationHint) score += 5;
    score += Math.min((candidate.publicHits || 0) * 16, 48);
    score += Math.min((candidate.cacheHits || 0) * 20, 40);
    score += Math.min(variantHits * 14, 42);
    score += Math.min(archiveHits * 8, 40);

    return score;
}

export async function searchCompetitorPages({ accessToken, query, country = 'IN', userId = null }) {
    const variants = buildSearchVariants(query);
    const pageHits = new Map();
    const archiveHits = new Map();
    const publicQueries = buildPublicSearchQueries(query, country);
    const cachedCandidates = await getCachedDiscoveryCandidates(userId, query);

    const results = await Promise.allSettled([
        ...publicQueries.map((publicQuery) => searchPublicWeb(publicQuery)),
        ...variants.map((variant) => searchPagesByVariant(accessToken, variant)),
        ...variants.map((variant) => searchAdsArchiveCandidates(accessToken, variant))
    ]);

    const publicResults = results.slice(0, publicQueries.length);
    const pageResults = results.slice(publicQueries.length, publicQueries.length + variants.length);
    const archiveResults = results.slice(publicQueries.length + variants.length);
    const publicCandidateMap = new Map();

    for (const cachedCandidate of cachedCandidates) {
        publicCandidateMap.set(normalizeCandidateKey(cachedCandidate), cachedCandidate);
    }

    publicResults.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        for (const publicResult of result.value) {
            const candidate = mapPublicSearchResultToCandidate(publicResult, query);
            if (!candidate) continue;
            const key = normalizeCandidateKey(candidate);
            const existing = publicCandidateMap.get(key);
            publicCandidateMap.set(key, {
                ...(existing || {}),
                ...candidate,
                source: existing?.source ? `${existing.source}+web` : candidate.source,
                publicHits: (existing?.publicHits || 0) + 1,
                cacheHits: existing?.cacheHits || 0
            });
        }
    });

    pageResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const variant = variants[index];
        for (const candidate of result.value) {
            const pageId = candidate.id ? String(candidate.id) : `name:${normalizeText(candidate.name || variant)}`;
            const existing = pageHits.get(pageId);
            pageHits.set(pageId, {
                raw: candidate,
                variantHits: (existing?.variantHits || 0) + 1
            });
        }
    });

    archiveResults.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        for (const ad of result.value) {
            const key = ad.page_id ? String(ad.page_id) : `name:${normalizeText(ad.page_name || query)}`;
            const existing = archiveHits.get(key);
            archiveHits.set(key, {
                pageId: ad.page_id ? String(ad.page_id) : null,
                name: ad.page_name || query,
                archiveHits: (existing?.archiveHits || 0) + 1,
                publisherPlatforms: unique([...(existing?.publisherPlatforms || []), ...asArray(ad.publisher_platforms)])
            });
        }
    });

    const archiveOnlyCandidates = [...archiveHits.values()].filter((candidate) => candidate.pageId && !pageHits.has(candidate.pageId));
    const enrichedArchiveCandidates = await Promise.all(
        archiveOnlyCandidates.slice(0, 8).map((candidate) =>
            enrichPageCandidate(accessToken, candidate.pageId, candidate.name, query)
        )
    );

    const combined = [];

    for (const candidate of publicCandidateMap.values()) {
        combined.push(candidate);
    }

    for (const [key, value] of pageHits.entries()) {
        const mapped = mapSearchCandidate(value.raw, query);
        const archiveMeta = archiveHits.get(key) || archiveHits.get(mapped.pageId || '');
        const publicMeta = publicCandidateMap.get(normalizeCandidateKey(mapped))
            || publicCandidateMap.get(mapped.pageUrl)
            || publicCandidateMap.get(mapped.instagramUrl)
            || publicCandidateMap.get(mapped.website);
        combined.push({
            ...(publicMeta || {}),
            ...mapped,
            source: unique([
                publicMeta?.source,
                'meta-page',
                archiveMeta ? 'meta-ads' : null
            ]).join('+'),
            publicHits: publicMeta?.publicHits || 0,
            cacheHits: publicMeta?.cacheHits || 0,
            variantHits: value.variantHits || 1,
            archiveHits: archiveMeta?.archiveHits || 0
        });
    }

    for (const candidate of enrichedArchiveCandidates) {
        const archiveMeta = archiveHits.get(candidate.pageId || '');
        const publicMeta = publicCandidateMap.get(normalizeCandidateKey(candidate))
            || publicCandidateMap.get(candidate.pageUrl)
            || publicCandidateMap.get(candidate.instagramUrl)
            || publicCandidateMap.get(candidate.website);
        combined.push({
            ...(publicMeta || {}),
            ...candidate,
            source: unique([publicMeta?.source, 'meta-ads']).join('+'),
            publicHits: publicMeta?.publicHits || 0,
            cacheHits: publicMeta?.cacheHits || 0,
            variantHits: 0,
            archiveHits: archiveMeta?.archiveHits || 1
        });
    }

    const deduped = combined.reduce((acc, candidate) => {
        const key = candidate.pageId || `name:${normalizeText(candidate.name)}`;
        const existing = acc.get(key);
        if (!existing || computeCandidateScore(candidate, query, candidate.variantHits, candidate.archiveHits) > computeCandidateScore(existing, query, existing.variantHits, existing.archiveHits)) {
            acc.set(key, candidate);
        }
        return acc;
    }, new Map());

    const rankedCandidates = [...deduped.values()]
        .map((candidate) => ({
            ...candidate,
            score: computeCandidateScore(candidate, query, candidate.variantHits, candidate.archiveHits),
            searchTerms: candidate.searchTerms || candidate.name || query
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    await rememberDiscoveryCandidates(userId, rankedCandidates);
    return rankedCandidates;
}

export async function getCompetitorIntelligence({ accessToken, competitor }) {
    const country = (competitor.country || 'IN').toUpperCase();
    const status = competitor.status || 'ACTIVE';
    const params = {
        access_token: accessToken,
        ad_type: 'ALL',
        ad_active_status: status,
        ad_reached_countries: JSON.stringify([country]),
        fields: AD_ARCHIVE_FIELDS,
        limit: 40
    };

    if (competitor.pageId) {
        params.search_page_ids = JSON.stringify([String(competitor.pageId)]);
    } else {
        params.search_terms = competitor.searchTerms;
    }

    const response = await fetchAdsArchive(accessToken, params);
    const rawAds = response.data.data || [];

    const preliminaryAds = rawAds.map((ad) => {
        const primaryText = getPrimaryText(ad);
        const combinedText = getCombinedText(ad);
        const title = asArray(ad.ad_creative_link_titles)[0] || '';
        const description = asArray(ad.ad_creative_link_descriptions)[0] || '';
        const caption = asArray(ad.ad_creative_link_captions)[0] || '';
        const offerSignals = detectOfferSignals(combinedText);
        const ctaSignals = CTA_PATTERNS.filter((pattern) => normalizeText(combinedText).includes(normalizeText(pattern)));
        const regionalSignals = detectRegionalSignals(combinedText, country);
        const angle = detectCreativeAngle(combinedText);
        const visualPattern = detectVisualPattern(combinedText);
        const longevityDays = getLongevityDays(ad.ad_delivery_start_time, ad.ad_delivery_stop_time);
        const hookStrength = scoreHook(primaryText);
        const ctaClarity = scoreCta(ctaSignals);
        const continuityScore = scoreContinuity(title, description, caption, primaryText);
        const platformSpread = unique(asArray(ad.publisher_platforms)).length;
        const keywords = extractKeywords(combinedText, 4);

        return {
            id: ad.id,
            pageId: ad.page_id ? String(ad.page_id) : null,
            pageName: ad.page_name || competitor.name || competitor.searchTerms,
            adDeliveryStartTime: ad.ad_delivery_start_time || null,
            adDeliveryStopTime: ad.ad_delivery_stop_time || null,
            adSnapshotUrl: ad.ad_snapshot_url || null,
            body: primaryText,
            title,
            description,
            caption,
            publisherPlatforms: unique(asArray(ad.publisher_platforms)),
            platformSpread,
            longevityDays,
            offerSignals,
            ctaSignals,
            angle,
            visualPattern,
            regionalSignals,
            hookStrength,
            ctaClarity,
            continuityScore,
            keywords
        };
    });

    const signatureCounts = preliminaryAds.reduce((acc, ad) => {
        const signature = buildAngleSignature(ad);
        acc[signature] = (acc[signature] || 0) + 1;
        return acc;
    }, {});

    const analyzedAds = preliminaryAds
        .map((ad) => {
            const signature = buildAngleSignature(ad);
            const repetitionCount = signatureCounts[signature] || 1;
            const score = Math.min(
                100,
                Math.round(
                    Math.min(ad.longevityDays / 30, 1) * 25
                    + Math.min(repetitionCount / 4, 1) * 20
                    + (ad.offerSignals.length > 0 ? Math.min(ad.offerSignals.length / 2, 1) * 15 : 0)
                    + (ad.hookStrength / 5) * 12
                    + (ad.ctaClarity / 5) * 10
                    + (ad.continuityScore / 5) * 8
                    + (ad.regionalSignals.length > 0 ? 5 : 0)
                    + (ad.platformSpread > 1 ? 5 : 0)
                )
            );

            const adAnalysis = {
                ...ad,
                signature,
                repetitionCount,
                score,
                confidenceLevel: getConfidence(score)
            };

            return {
                ...adAnalysis,
                whyItMayWork: buildWhyItMayWork(adAnalysis),
                whatToTest: buildWhatToTest(adAnalysis)
            };
        })
        .sort((a, b) => b.score - a.score);

    const summary = buildAccountSummary(analyzedAds, country);

    return {
        competitor: {
            name: analyzedAds[0]?.pageName || competitor.name || competitor.searchTerms,
            pageId: competitor.pageId || analyzedAds[0]?.pageId || null,
            searchTerms: competitor.searchTerms,
            country,
            status
        },
        overview: summary.overview,
        creativeAngleSummary: summary.creativeAngleSummary,
        offerAnalysis: summary.offerAnalysis,
        regionalRelevanceAnalysis: summary.regionalRelevanceAnalysis,
        likelyPerformanceRationale: summary.likelyPerformanceRationale,
        whatToTest: summary.whatToTest,
        confidenceLevel: summary.confidenceLevel,
        confidenceScore: summary.confidenceScore,
        topAngles: summary.topAngles,
        topOffers: summary.topOffers,
        ads: analyzedAds.slice(0, 12).map((ad) => ({
            id: ad.id,
            body: truncate(ad.body, 220),
            title: truncate(ad.title, 120),
            description: truncate(ad.description, 160),
            caption: truncate(ad.caption, 100),
            adSnapshotUrl: ad.adSnapshotUrl,
            adDeliveryStartTime: ad.adDeliveryStartTime,
            adDeliveryStopTime: ad.adDeliveryStopTime,
            longevityDays: ad.longevityDays,
            publisherPlatforms: ad.publisherPlatforms,
            angle: ad.angle,
            visualPattern: ad.visualPattern,
            offerSignals: ad.offerSignals.map((signal) => signal.label),
            ctaSignals: ad.ctaSignals,
            regionalSignals: ad.regionalSignals,
            repetitionCount: ad.repetitionCount,
            hookStrength: ad.hookStrength,
            continuityScore: ad.continuityScore,
            score: ad.score,
            confidenceLevel: ad.confidenceLevel,
            whyItMayWork: ad.whyItMayWork,
            whatToTest: ad.whatToTest
        })),
        fetchedAt: new Date().toISOString()
    };
}
