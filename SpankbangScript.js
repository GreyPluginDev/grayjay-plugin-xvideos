const BASE_URL = "https://spankbang.com";
const PLATFORM = "SpankBang";
const PLATFORM_CLAIMTYPE = 3;

var config = {};
let localConfig = {};

const CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50,
    VIDEO_QUALITIES: {
        "240": { name: "240p", width: 320, height: 240 },
        "320": { name: "320p", width: 480, height: 320 },
        "360": { name: "360p", width: 640, height: 360 },
        "480": { name: "480p", width: 854, height: 480 },
        "720": { name: "720p", width: 1280, height: 720 },
        "1080": { name: "1080p", width: 1920, height: 1080 },
        "2160": { name: "4K", width: 3840, height: 2160 },
        "4k": { name: "4K", width: 3840, height: 2160 }
    },
    INTERNAL_URL_SCHEME: "spankbang://profile/",
    EXTERNAL_URL_BASE: "https://spankbang.com",
    PORNSTAR_IMG_BASE: "https://spankbang.com/pornstarimg/f/",
    SEARCH_FILTERS: {
        DURATION: {
            ANY: "",
            SHORT: "1",
            MEDIUM: "2",
            LONG: "3"
        },
        QUALITY: {
            ANY: "",
            HD: "1",
            FHD: "2",
            UHD: "3"
        },
        PERIOD: {
            ANY: "",
            TODAY: "1",
            WEEK: "2",
            MONTH: "3",
            YEAR: "4"
        },
        ORDER: {
            RELEVANCE: "",
            NEW: "1",
            TRENDING: "2",
            POPULAR: "3",
            VIEWS: "4",
            RATING: "5",
            LENGTH: "6"
        }
    }
};

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

const REGEX_PATTERNS = {
    urls: {
        videoStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/video\/.+$/,
        videoAlternative: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/embed\/.+$/,
        videoShort: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/.*$/,
        channelProfile: /^https?:\/\/(?:www\.)?spankbang\.com\/profile\/([^\/\?]+)/,
        channelOfficial: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        channelS: /^https?:\/\/(?:www\.)?spankbang\.com\/s\/([^\/\?]+)/,
        pornstar: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        pornstarSimple: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/([^\/\?]+)/,
        playlistInternal: /^spankbang:\/\/playlist\/(.+)$/,
        categoryInternal: /^spankbang:\/\/category\/(.+)$/,
        channelInternal: /^spankbang:\/\/channel\/(.+)$/,
        profileInternal: /^spankbang:\/\/profile\/(.+)$/,
        relativeProfile: /^\/profile\/([^\/\?]+)/,
        relativeChannel: /^\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        relativeS: /^\/s\/([^\/\?]+)/,
        relativePornstar: /^\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        relativePornstarSimple: /^\/pornstar\/([^\/\?]+)/
    },
    extraction: {
        videoId: /\/([a-zA-Z0-9]+)\/(?:video|embed|play)/,
        videoIdShort: /spankbang\.com\/([a-zA-Z0-9]+)\//,
        profileName: /\/(?:profile|s)\/([^\/\?]+)/,
        pornstarName: /\/pornstar\/([^\/\?]+)/,
        pornstarWithId: /\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        streamUrl: /stream_url_([0-9]+p)\s*=\s*'([^']+)'/g,
        m3u8Url: /source\s*src="([^"]+\.m3u8[^"]*)"/,
        title: /<h1[^>]*title="([^"]+)"/,
        duration: /itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/,
        views: /"interactionCount"\s*:\s*"?(\d+)"?/,
        uploadDate: /itemprop="uploadDate"\s*content="([^"]+)"/,
        thumbnail: /itemprop="thumbnailUrl"\s*content="([^"]+)"/,
        uploader: /class="n"\s*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</
    },
    parsing: {
        duration: /(\d+)h|(\d+)m|(\d+)s/g,
        htmlTags: /<[^>]*>/g,
        htmlBreaks: /<br\s*\/?>/gi
    }
};

function makeRequest(url, headers = API_HEADERS, context = 'request') {
    try {
        const response = http.GET(url, headers, false);
        if (!response.isOk) {
            throw new ScriptException(`${context} failed with status ${response.code}`);
        }
        return response.body;
    } catch (error) {
        throw new ScriptException(`Failed to fetch ${context}: ${error.message}`);
    }
}

function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    const patterns = [
        REGEX_PATTERNS.extraction.videoId,
        REGEX_PATTERNS.extraction.videoIdShort
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    throw new ScriptException(`Could not extract video ID from URL: ${url}`);
}

function extractChannelId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for channel ID extraction");
    }

    const channelInternalMatch = url.match(REGEX_PATTERNS.urls.channelInternal);
    if (channelInternalMatch && channelInternalMatch[1]) {
        return { type: 'channel', id: channelInternalMatch[1] };
    }

    const profileInternalMatch = url.match(REGEX_PATTERNS.urls.profileInternal);
    if (profileInternalMatch && profileInternalMatch[1]) {
        if (profileInternalMatch[1].startsWith('pornstar:')) {
            return { type: 'pornstar', id: profileInternalMatch[1].replace('pornstar:', '') };
        }
        return { type: 'profile', id: profileInternalMatch[1] };
    }

    const channelOfficialMatch = url.match(REGEX_PATTERNS.urls.channelOfficial);
    if (channelOfficialMatch && channelOfficialMatch[1] && channelOfficialMatch[2]) {
        return { type: 'channel', id: `${channelOfficialMatch[1]}:${channelOfficialMatch[2]}` };
    }

    const relativeChannelMatch = url.match(REGEX_PATTERNS.urls.relativeChannel);
    if (relativeChannelMatch && relativeChannelMatch[1] && relativeChannelMatch[2]) {
        return { type: 'channel', id: `${relativeChannelMatch[1]}:${relativeChannelMatch[2]}` };
    }

    const pornstarMatch = url.match(REGEX_PATTERNS.urls.pornstar);
    if (pornstarMatch && pornstarMatch[1] && pornstarMatch[2]) {
        return { type: 'pornstar', id: pornstarMatch[2], shortId: pornstarMatch[1] };
    }

    const pornstarSimpleMatch = url.match(REGEX_PATTERNS.urls.pornstarSimple);
    if (pornstarSimpleMatch && pornstarSimpleMatch[1]) {
        return { type: 'pornstar', id: pornstarSimpleMatch[1] };
    }

    const relativePornstarMatch = url.match(REGEX_PATTERNS.urls.relativePornstar);
    if (relativePornstarMatch && relativePornstarMatch[1] && relativePornstarMatch[2]) {
        return { type: 'pornstar', id: relativePornstarMatch[2], shortId: relativePornstarMatch[1] };
    }

    const relativePornstarSimpleMatch = url.match(REGEX_PATTERNS.urls.relativePornstarSimple);
    if (relativePornstarSimpleMatch && relativePornstarSimpleMatch[1]) {
        return { type: 'pornstar', id: relativePornstarSimpleMatch[1] };
    }

    const channelProfileMatch = url.match(REGEX_PATTERNS.urls.channelProfile);
    if (channelProfileMatch && channelProfileMatch[1]) {
        return { type: 'profile', id: channelProfileMatch[1] };
    }

    const relativeProfileMatch = url.match(REGEX_PATTERNS.urls.relativeProfile);
    if (relativeProfileMatch && relativeProfileMatch[1]) {
        return { type: 'profile', id: relativeProfileMatch[1] };
    }

    const profileMatch = url.match(REGEX_PATTERNS.extraction.profileName);
    if (profileMatch && profileMatch[1]) {
        return { type: 'profile', id: profileMatch[1] };
    }

    throw new ScriptException(`Could not extract channel ID from URL: ${url}`);
}

function extractProfileId(url) {
    const result = extractChannelId(url);
    if (result.type === 'channel') {
        return `channel:${result.id}`;
    } else if (result.type === 'pornstar') {
        return `pornstar:${result.id}`;
    }
    return result.id;
}

function parseDuration(durationStr) {
    if (!durationStr) return 0;

    let totalSeconds = 0;

    if (typeof durationStr === 'number') {
        return durationStr;
    }

    const colonMatch = durationStr.match(/(\d+):(\d+)(?::(\d+))?/);
    if (colonMatch) {
        if (colonMatch[3]) {
            totalSeconds = parseInt(colonMatch[1]) * 3600 + parseInt(colonMatch[2]) * 60 + parseInt(colonMatch[3]);
        } else {
            totalSeconds = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
        }
        return totalSeconds;
    }

    const parts = durationStr.toLowerCase().match(REGEX_PATTERNS.parsing.duration);
    if (parts) {
        for (const part of parts) {
            const numericValue = parseInt(part);
            if (!isNaN(numericValue)) {
                if (part.includes('h')) {
                    totalSeconds += numericValue * 3600;
                } else if (part.includes('m')) {
                    totalSeconds += numericValue * 60;
                } else if (part.includes('s')) {
                    totalSeconds += numericValue;
                }
            }
        }
    }

    return totalSeconds;
}

function parseViewCount(viewsStr) {
    if (!viewsStr) return 0;

    viewsStr = viewsStr.toString().trim().toLowerCase();

    const multipliers = {
        'k': 1000,
        'm': 1000000,
        'b': 1000000000
    };

    for (const [suffix, multiplier] of Object.entries(multipliers)) {
        if (viewsStr.includes(suffix)) {
            const num = parseFloat(viewsStr.replace(/[^0-9.]/g, ''));
            return Math.floor(num * multiplier);
        }
    }

    return parseInt(viewsStr.replace(/[,.\s]/g, '')) || 0;
}

function extractAvatarFromHtml(html) {
    const avatarPatterns = [
        /src="(https?:\/\/spankbang\.com\/pornstarimg\/[^"]+)"/i,
        /src="(https?:\/\/[^"]*spankbang[^"]*\/avatar\/[^"]+)"/i,
        /src="(\/\/spankbang\.com\/avatar\/[^"]+)"/i,
        /<img[^>]*src="(\/avatar\/[^"]+)"/i,
        /src="(https?:\/\/[^"]+\/pornstarimg\/[^"]+)"/i
    ];

    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let avatarUrl = match[1];
            if (avatarUrl.startsWith('//')) {
                return `https:${avatarUrl}`;
            }
            return avatarUrl.startsWith('http') ? avatarUrl : `https://spankbang.com${avatarUrl}`;
        }
    }
    return "";
}

function extractPornstarAvatarFromHtml(html, pornstarSlug) {
    const patterns = [
        new RegExp(`href="[^"]*pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*>[\\s\\S]*?<img[^>]*(?:data-src|src)="(https?://[^"]*pornstarimg[^"]+)"`, 'i'),
        /src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
        /data-src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return "";
}

function extractUploaderFromVideoToolbar(html) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    const toolbarMatch = html.match(/<ul[^>]*class="[^"]*video_toolbar[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
    const toolbarHtml = toolbarMatch ? toolbarMatch[1] : html;

    const uploaderPatterns = [
        {
            pattern: /<li[^>]*class="[^"]*(?:channel|uploader|user)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?(?:<img[^>]*src="([^"]+)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'pornstar'
        },
        {
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'profile'
        }
    ];

    for (const { pattern, type } of uploaderPatterns) {
        const match = toolbarHtml.match(pattern);
        if (match) {
            let avatarUrl = match[3] || "";
            if (avatarUrl.startsWith('//')) {
                avatarUrl = `https:${avatarUrl}`;
            } else if (avatarUrl && !avatarUrl.startsWith('http')) {
                avatarUrl = `https://spankbang.com${avatarUrl}`;
            }

            if (type === 'channel') {
                uploader.name = match[4].trim();
                uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
                uploader.avatar = avatarUrl;
            } else if (type === 'pornstar') {
                uploader.name = match[4].trim();
                uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                uploader.avatar = avatarUrl || extractPornstarAvatarFromHtml(html, match[2]);
            } else {
                uploader.name = match[3].trim();
                uploader.url = `spankbang://profile/${match[1]}`;
                uploader.avatar = match[2] || "";
            }
            return uploader;
        }
    }

    const simpleChannelPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of simpleChannelPatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[3].trim();
            uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
            uploader.avatar = extractAvatarFromHtml(html);
            return uploader;
        }
    }

    const simplePornstarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of simplePornstarPatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[3].trim();
            uploader.url = `spankbang://profile/pornstar:${match[2]}`;
            uploader.avatar = extractPornstarAvatarFromHtml(html, match[2]) || extractAvatarFromHtml(html);
            return uploader;
        }
    }

    const simpleProfilePatterns = [
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/profile\/([^"]+)"[^>]*title="([^"]+)"/i
    ];

    for (const pattern of simpleProfilePatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[2].trim();
            uploader.url = `spankbang://profile/${match[1]}`;
            uploader.avatar = extractAvatarFromHtml(html);
            return uploader;
        }
    }

    return uploader;
}

function extractUploaderFromSearchResult(block) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    const infoSection = block.match(/<div[^>]*class="[^"]*inf[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const searchHtml = infoSection ? infoSection[1] : block;

    const channelPatterns = [
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of channelPatterns) {
        const match = searchHtml.match(pattern);
        if (match) {
            uploader.name = match[3].trim();
            uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
            return uploader;
        }
    }

    const pornstarPatterns = [
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of pornstarPatterns) {
        const match = searchHtml.match(pattern);
        if (match) {
            uploader.name = match[3].trim();
            uploader.url = `spankbang://profile/pornstar:${match[2]}`;
            uploader.avatar = extractPornstarAvatarFromHtml(block, match[2]);
            return uploader;
        }
    }

    const profilePatterns = [
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of profilePatterns) {
        const match = searchHtml.match(pattern);
        if (match) {
            uploader.name = match[2].trim();
            uploader.url = `spankbang://profile/${match[1]}`;
            return uploader;
        }
    }

    return uploader;
}

function parseVideoPage(html, url) {
    const videoData = {
        id: extractVideoId(url),
        url: url,
        title: "Unknown Title",
        description: "",
        duration: 0,
        views: 0,
        uploadDate: 0,
        thumbnail: "",
        uploader: { name: "", url: "", avatar: "" },
        sources: {},
        rating: 0,
        relatedVideos: []
    };

    const titleMatch = html.match(/<h1[^>]*title="([^"]+)"/);
    if (titleMatch) {
        videoData.title = cleanVideoTitle(titleMatch[1]);
    } else {
        const altTitleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (altTitleMatch) {
            videoData.title = cleanVideoTitle(altTitleMatch[1].replace(/ - SpankBang$/, '').trim());
        }
    }

    const descPatterns = [
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];
    for (const pattern of descPatterns) {
        const descMatch = html.match(pattern);
        if (descMatch && descMatch[1]) {
            videoData.description = descMatch[1].replace(/<[^>]*>/g, '').trim();
            break;
        }
    }

    const durationMatch = html.match(/itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/);
    if (durationMatch) {
        videoData.duration = (parseInt(durationMatch[1]) || 0) * 60 + (parseInt(durationMatch[2]) || 0);
    }

    const viewsMatch = html.match(/"interactionCount"\s*:\s*"?(\d+)"?/);
    if (viewsMatch) {
        videoData.views = parseInt(viewsMatch[1]) || 0;
    }

    const uploadMatch = html.match(/itemprop="uploadDate"\s*content="([^"]+)"/);
    if (uploadMatch) {
        try {
            videoData.uploadDate = Math.floor(new Date(uploadMatch[1]).getTime() / 1000);
        } catch (e) {}
    }

    const thumbMatch = html.match(/itemprop="thumbnailUrl"\s*content="([^"]+)"/);
    if (thumbMatch) {
        videoData.thumbnail = thumbMatch[1];
    }

    const ratingMatch = html.match(/(\d+(?:\.\d+)?)\s*%\s*(?:rating|like)/i);
    if (ratingMatch) {
        videoData.rating = parseFloat(ratingMatch[1]) / 100;
    }

    videoData.uploader = extractUploaderFromVideoToolbar(html);

    const streamRegex = /stream_url_([0-9a-z]+p?)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(html)) !== null) {
        let quality = streamMatch[1].toLowerCase();
        let streamUrl = streamMatch[2];
        if (streamUrl.includes('\\u002F')) {
            streamUrl = streamUrl.replace(/\\u002F/g, '/');
        }
        if (!quality.endsWith('p') && /^\d+$/.test(quality)) {
            quality = quality + 'p';
        }
        videoData.sources[quality] = streamUrl;
    }

    const m3u8Match = html.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/);
    if (m3u8Match) {
        videoData.sources['hls'] = m3u8Match[1];
    }

    if (Object.keys(videoData.sources).length === 0) {
        const streamKeyMatch = html.match(/data-streamkey\s*=\s*['"]([\w]+)['"]/);
        if (streamKeyMatch) {
            const streamKey = streamKeyMatch[1];
            try {
                const streamResponse = http.POST(
                    "https://spankbang.com/api/videos/stream",
                    "id=" + streamKey + "&data=0",
                    {
                        "User-Agent": API_HEADERS["User-Agent"],
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Referer": url,
                        "X-Requested-With": "XMLHttpRequest",
                        "Origin": "https://spankbang.com"
                    },
                    false
                );

                if (streamResponse.isOk && streamResponse.body) {
                    const streamData = JSON.parse(streamResponse.body);
                    for (const [quality, streamUrl] of Object.entries(streamData)) {
                        if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
                            let qualityKey = quality.toLowerCase();
                            if (!qualityKey.endsWith('p') && /^\d+$/.test(qualityKey)) {
                                qualityKey = qualityKey + 'p';
                            }
                            videoData.sources[qualityKey] = streamUrl;
                        } else if (Array.isArray(streamUrl) && streamUrl.length > 0 && streamUrl[0].startsWith('http')) {
                            let qualityKey = quality.toLowerCase();
                            if (!qualityKey.endsWith('p') && /^\d+$/.test(qualityKey)) {
                                qualityKey = qualityKey + 'p';
                            }
                            videoData.sources[qualityKey] = streamUrl[0];
                        }
                    }
                }
            } catch (e) {
                log("Stream API request failed: " + e.message);
            }
        }
    }

    videoData.relatedVideos = parseRelatedVideos(html);

    return videoData;
}

function parseRelatedVideos(html) {
    const relatedVideos = [];

    const relatedSectionPatterns = [
        /<section[^>]*id="[^"]*(?:related|similar|recommended)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        /<div[^>]*class="[^"]*(?:related|similar|recommended)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i,
        /<div[^>]*id="[^"]*(?:related|similar|recommended)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
    ];

    let relatedHtml = html;
    for (const pattern of relatedSectionPatterns) {
        const sectionMatch = html.match(pattern);
        if (sectionMatch) {
            relatedHtml = sectionMatch[1];
            break;
        }
    }

    const videoItemRegex = /<a[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = videoItemRegex.exec(relatedHtml)) !== null && count < 20) {
        const videoId = match[1];
        const videoSlug = match[2];
        const block = match[0];

        const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
        const thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`;

        const titleMatch = block.match(/title="([^"]+)"/);
        let title = titleMatch ? cleanVideoTitle(titleMatch[1]) : "Unknown";

        const durationMatch = block.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const duration = durationMatch ? parseDuration(durationMatch[1].trim()) : 0;

        relatedVideos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: duration,
            views: 0,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: { name: "", url: "", avatar: "" }
        });
        count++;
    }

    if (relatedVideos.length === 0) {
        const altPattern = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*title="([^"]+)"/gi;
        while ((match = altPattern.exec(html)) !== null && relatedVideos.length < 20) {
            const videoId = match[1];
            const videoSlug = match[2];

            const existingVideo = relatedVideos.find(v => v.id === videoId);
            if (!existingVideo) {
                relatedVideos.push({
                    id: videoId,
                    title: cleanVideoTitle(match[3]),
                    thumbnail: `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`,
                    duration: 0,
                    views: 0,
                    url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                    uploader: { name: "", url: "", avatar: "" }
                });
            }
        }
    }

    return relatedVideos;
}

function createVideoSources(videoData) {
    const videoSources = [];

    const qualityOrder = ['4k', '2160p', '1080p', '720p', '480p', '360p', '320p', '240p'];

    for (const quality of qualityOrder) {
        if (videoData.sources[quality]) {
            const qualityKey = quality.replace('p', '');
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: videoData.sources[quality],
                name: quality.toUpperCase(),
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    for (const [quality, url] of Object.entries(videoData.sources)) {
        if (quality === 'hls' || quality === 'm3u8') continue;
        const alreadyAdded = qualityOrder.includes(quality);
        if (!alreadyAdded && url && url.startsWith('http')) {
            const qualityKey = quality.replace('p', '');
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: url,
                name: quality.toUpperCase(),
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    if (videoData.sources.hls || videoData.sources.m3u8) {
        const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
        videoSources.push(new HLSSource({
            url: hlsUrl,
            name: "HLS (Adaptive)",
            priority: true
        }));
    }

    if (videoSources.length === 0) {
        throw new ScriptException("No video sources available for this video");
    }

    return videoSources;
}

function createThumbnails(thumbnail) {
    if (!thumbnail) {
        return new Thumbnails([]);
    }
    return new Thumbnails([
        new Thumbnail(thumbnail, 0)
    ]);
}

function createPlatformAuthor(uploader) {
    const avatar = uploader.avatar || "";
    const authorUrl = uploader.url || "";
    const authorName = uploader.name || "";

    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, authorName, plugin.config.id),
        authorName,
        authorUrl,
        avatar
    );
}

function createPlatformVideo(videoData) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: createPlatformAuthor(videoData.uploader || {}),
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: videoData.url || `${CONFIG.EXTERNAL_URL_BASE}/${videoData.id}/video/`,
        isLive: false
    });
}

function createVideoDetails(videoData, url) {
    const videoSources = createVideoSources(videoData);

    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: createPlatformAuthor(videoData.uploader || {}),
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: url,
        isLive: false,
        description: videoData.description || videoData.title || "",
        video: new VideoSourceDescriptor(videoSources),
        live: null,
        subtitles: []
    });
}

function cleanVideoTitle(title) {
    if (!title) return "Unknown";
    return title
        .replace(/:\s*Porn\s*$/i, '')
        .replace(/\s*-\s*SpankBang\s*$/i, '')
        .replace(/\s*\|\s*SpankBang\s*$/i, '')
        .trim();
}

function parseSearchResults(html) {
    const videos = [];

    const videoItemRegex = /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;

    let itemMatch;
    while ((itemMatch = videoItemRegex.exec(html)) !== null) {
        const block = itemMatch[0];

        const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
        if (!linkMatch) continue;

        const videoId = linkMatch[1];
        const videoSlug = linkMatch[2];

        const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
        const thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`;

        const titleMatch = block.match(/title="([^"]+)"/);
        let title = titleMatch ? titleMatch[1] : "Unknown";
        title = cleanVideoTitle(title);

        const durationMatch = block.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const durationAltMatch = block.match(/>(\d+:\d+(?::\d+)?)</);
        const finalDuration = durationMatch ? durationMatch[1].trim() : (durationAltMatch ? durationAltMatch[1] : "0:00");

        const viewsMatch = block.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const viewsAltMatch = block.match(/>([0-9,.]+[KMB]?)\s*<\/span>/i);
        const viewsStr = viewsMatch ? viewsMatch[1].trim() : (viewsAltMatch ? viewsAltMatch[1] : "0");

        const uploader = extractUploaderFromSearchResult(block);

        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: parseDuration(finalDuration),
            views: parseViewCount(viewsStr),
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: uploader
        });
    }

    if (videos.length === 0) {
        const altVideoRegex = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*title="([^"]+)"/gi;
        let altMatch;
        while ((altMatch = altVideoRegex.exec(html)) !== null) {
            const videoId = altMatch[1];
            const videoSlug = altMatch[2];
            let title = cleanVideoTitle(altMatch[3]);

            videos.push({
                id: videoId,
                title: title,
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`,
                duration: 0,
                views: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    return videos;
}

function parsePornstarsPage(html) {
    const pornstars = [];

    const pornstarPattern = /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi;
    let match;

    while ((match = pornstarPattern.exec(html)) !== null) {
        const shortId = match[1];
        const pornstarSlug = match[2].replace(/\/$/, '');
        let avatar = match[3];

        if (avatar.startsWith('//')) {
            avatar = `https:${avatar}`;
        } else if (!avatar.startsWith('http')) {
            avatar = `https://spankbang.com${avatar}`;
        }

        let name = pornstarSlug.replace(/\+/g, ' ').replace(/-/g, ' ');
        name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
        if (existingIndex === -1) {
            let subscribersStr = "";
            let videoCountStr = "";

            const statsPattern = new RegExp(`href="/${shortId}/pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>[\\s\\S]*?(\\d[\\d,.]*)\\s*[\\s\\S]*?(\\d+)`, 'i');
            const statsMatch = html.match(statsPattern);

            if (statsMatch) {
                subscribersStr = statsMatch[1] || "0";
                videoCountStr = statsMatch[2] || "0";
            }

            pornstars.push({
                id: `pornstar:${pornstarSlug}`,
                shortId: shortId,
                name: name,
                avatar: avatar,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/pornstar/${pornstarSlug}`,
                subscribers: parseViewCount(subscribersStr),
                videoCount: parseInt(videoCountStr) || 0
            });
        }
    }

    if (pornstars.length === 0) {
        const simplePattern = /<a[^>]*href="\/pornstar\/([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
        while ((match = simplePattern.exec(html)) !== null) {
            const pornstarSlug = match[1].replace(/\/$/, '');
            const name = match[2].trim();

            const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
            if (existingIndex === -1) {
                pornstars.push({
                    id: `pornstar:${pornstarSlug}`,
                    shortId: "",
                    name: name,
                    avatar: "",
                    url: `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${pornstarSlug}`,
                    subscribers: 0,
                    videoCount: 0
                });
            }
        }
    }

    return pornstars;
}

function parseComments(html, videoId) {
    const comments = [];

    const commentPatterns = [
        /<div[^>]*class="[^"]*comment[^"]*"[^>]*(?:data-id="(\d+)")?[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?\s*(?:<\/div>)?/gi,
        /<li[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    ];

    for (const pattern of commentPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const commentId = match[1] || `comment_${comments.length}`;
            const block = match[2] || match[1] || match[0];

            const userPatterns = [
                /<a[^>]*class="[^"]*(?:username|author|user)[^"]*"[^>]*>([^<]+)<\/a>/,
                /<span[^>]*class="[^"]*(?:username|author|user)[^"]*"[^>]*>([^<]+)<\/span>/,
                /<strong[^>]*>([^<]+)<\/strong>/
            ];

            let username = "Anonymous";
            for (const userPattern of userPatterns) {
                const userMatch = block.match(userPattern);
                if (userMatch && userMatch[1]) {
                    username = userMatch[1].trim();
                    break;
                }
            }

            const avatarMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/);
            const avatar = avatarMatch ? avatarMatch[1] : "";

            const textPatterns = [
                /<div[^>]*class="[^"]*(?:comment-text|text|body|message)[^"]*"[^>]*>([\s\S]*?)<\/div>/,
                /<p[^>]*class="[^"]*(?:comment-text|text)[^"]*"[^>]*>([\s\S]*?)<\/p>/,
                /<p[^>]*>([\s\S]*?)<\/p>/
            ];

            let text = "";
            for (const textPattern of textPatterns) {
                const textMatch = block.match(textPattern);
                if (textMatch && textMatch[1]) {
                    text = textMatch[1].replace(/<[^>]*>/g, '').trim();
                    break;
                }
            }

            if (!text) continue;

            const likesMatch = block.match(/(\d+)\s*(?:likes?|thumbs?\s*up)/i);
            const likes = likesMatch ? parseInt(likesMatch[1]) : 0;

            const dateMatch = block.match(/(\d+)\s*(hour|day|week|month|year)s?\s*ago/i);
            let timestamp = Math.floor(Date.now() / 1000);
            if (dateMatch) {
                const num = parseInt(dateMatch[1]);
                const unit = dateMatch[2].toLowerCase();
                const multipliers = {
                    'hour': 3600,
                    'day': 86400,
                    'week': 604800,
                    'month': 2592000,
                    'year': 31536000
                };
                timestamp -= num * (multipliers[unit] || 0);
            }

            comments.push({
                contextUrl: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/`,
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, username, plugin.config.id),
                    username,
                    "",
                    avatar
                ),
                message: text,
                rating: new RatingLikes(likes),
                date: timestamp,
                replyCount: 0,
                context: { id: commentId }
            });
        }

        if (comments.length > 0) break;
    }

    return comments;
}

source.enable = function(conf, settings, savedStateStr) {
    config = conf ?? {};
    localConfig = config;
};

source.disable = function() {};

source.saveState = function() {
    return JSON.stringify({});
};

source.getHome = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        const url = `${BASE_URL}/trending_videos/${page}/`;

        const html = makeRequest(url, API_HEADERS, 'home content');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangHomeContentPager(platformVideos, hasMore, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get home content: " + error.message);
    }
};

source.searchSuggestions = function(query) {
    try {
        const suggestUrl = `${BASE_URL}/api/search/suggestions?q=${encodeURIComponent(query)}`;
        const response = http.GET(suggestUrl, API_HEADERS, false);

        if (response.isOk && response.body) {
            try {
                const data = JSON.parse(response.body);
                if (Array.isArray(data)) {
                    return data.slice(0, 10);
                }
                if (data.suggestions && Array.isArray(data.suggestions)) {
                    return data.suggestions.slice(0, 10);
                }
            } catch (e) {}
        }
    } catch (e) {}

    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.search = function(query, type, order, filters, continuationToken) {
    try {
        if (!query || query.trim().length === 0) {
            return new SpankBangSearchPager([], false, {
                query: query,
                continuationToken: null
            });
        }

        const page = continuationToken ? parseInt(continuationToken) : 1;
        const searchQuery = encodeURIComponent(query.trim().replace(/\s+/g, '+'));

        let searchUrl = `${BASE_URL}/s/${searchQuery}/${page}/`;

        const params = [];

        if (filters && typeof filters === 'object') {
            if (filters.duration && filters.duration.length > 0) {
                const durationVal = filters.duration[0];
                if (durationVal && durationVal !== "") {
                    params.push(`d=${durationVal}`);
                }
            }
            if (filters.quality && filters.quality.length > 0) {
                const qualityVal = filters.quality[0];
                if (qualityVal && qualityVal !== "") {
                    params.push(`q=${qualityVal}`);
                }
            }
            if (filters.period && filters.period.length > 0) {
                const periodVal = filters.period[0];
                if (periodVal && periodVal !== "") {
                    params.push(`p=${periodVal}`);
                }
            }
        }

        if (order === Type.Order.Views) {
            params.push("o=4");
        } else if (order === Type.Order.Rating) {
            params.push("o=5");
        } else if (order === Type.Order.Chronological) {
            params.push("o=1");
        }

        if (params.length > 0) {
            searchUrl += "?" + params.join("&");
        }

        log("Search URL: " + searchUrl);

        const html = makeRequest(searchUrl, API_HEADERS, 'search');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangSearchPager(platformVideos, hasMore, {
            query: query,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to search: " + error.message);
    }
};

source.searchChannels = function(query, continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchUrl;

        if (!query || query.trim().length === 0) {
            searchUrl = `${BASE_URL}/pornstars`;
            if (page > 1) {
                searchUrl += `/${page}`;
            }
        } else {
            const searchQuery = encodeURIComponent(query.trim());
            searchUrl = `${BASE_URL}/s/${searchQuery}/`;
            if (page > 1) {
                searchUrl += `${page}/`;
            }
        }

        const html = makeRequest(searchUrl, API_HEADERS, 'pornstar search');
        const pornstars = parsePornstarsPage(html);

        const platformChannels = pornstars.map(p => new PlatformChannel({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.avatar,
            banner: "",
            subscribers: p.subscribers,
            description: `${p.videoCount} videos`,
            url: `spankbang://profile/${p.id}`,
            links: {}
        }));

        const hasMore = pornstars.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangChannelPager(platformChannels, hasMore, {
            query: query,
            continuationToken: nextToken
        });

    } catch (error) {
        log("searchChannels error: " + error.message);
        return new SpankBangChannelPager([], false, { query: query });
    }
};

source.getCreators = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let url = `${BASE_URL}/pornstars`;
        if (page > 1) {
            url += `/${page}`;
        }

        const html = makeRequest(url, API_HEADERS, 'pornstars');
        const pornstars = parsePornstarsPage(html);

        const platformChannels = pornstars.map(p => new PlatformChannel({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.avatar,
            banner: "",
            subscribers: p.subscribers,
            description: `${p.videoCount} videos`,
            url: `spankbang://profile/${p.id}`,
            links: {}
        }));

        const hasMore = pornstars.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangCreatorPager(platformChannels, hasMore, {
            continuationToken: nextToken
        });

    } catch (error) {
        log("getCreators error: " + error.message);
        return new SpankBangCreatorPager([], false, { continuationToken: null });
    }
};

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    if (REGEX_PATTERNS.urls.channelInternal.test(url)) return true;
    if (REGEX_PATTERNS.urls.profileInternal.test(url)) return true;

    if (REGEX_PATTERNS.urls.relativeProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativeChannel.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstar.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstarSimple.test(url)) return true;

    if (REGEX_PATTERNS.urls.channelProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.channelOfficial.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstar.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstarSimple.test(url)) return true;

    return false;
};

source.getChannel = function(url) {
    try {
        const result = extractChannelId(url);
        let profileUrl;
        let internalUrl;

        if (result.type === 'pornstar') {
            if (result.shortId) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${result.shortId}/pornstar/${result.id}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${result.id}`;
            }
            internalUrl = `spankbang://profile/pornstar:${result.id}`;
        } else if (result.type === 'channel') {
            const [shortId, channelName] = result.id.split(':');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            internalUrl = `spankbang://channel/${result.id}`;
        } else {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}`;
            internalUrl = `spankbang://profile/${result.id}`;
        }

        const html = makeRequest(profileUrl, API_HEADERS, 'channel');

        const namePatterns = [
            /<h1[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/h1>/i,
            /<h1[^>]*>([^<]+)<\/h1>/,
            /<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/
        ];

        let name = result.id.replace(/\+/g, ' ');
        for (const pattern of namePatterns) {
            const nameMatch = html.match(pattern);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1].trim();
                break;
            }
        }

        let avatar = "";
        const avatarPatterns = [
            /src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
            /data-src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
            /src="(https?:\/\/[^"]*pornstarimg[^"]+)"/i,
            /src="(https?:\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /src="(\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /<img[^>]*src="(\/avatar\/[^"]+)"/i,
            /class="[^"]*avatar[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*profile-pic[^"]*"[^>]*src="([^"]+)"/i
        ];

        for (const pattern of avatarPatterns) {
            const avatarMatch = html.match(pattern);
            if (avatarMatch && avatarMatch[1]) {
                avatar = avatarMatch[1];
                if (avatar.startsWith('//')) {
                    avatar = `https:${avatar}`;
                } else if (!avatar.startsWith('http')) {
                    avatar = `${CONFIG.EXTERNAL_URL_BASE}${avatar}`;
                }
                break;
            }
        }

        const bannerPatterns = [
            /class="[^"]*cover[^"]*"[^>]*style="[^"]*url\(['"]?([^'")\s]+)['"]?\)/,
            /class="[^"]*banner[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i
        ];

        let banner = "";
        for (const pattern of bannerPatterns) {
            const bannerMatch = html.match(pattern);
            if (bannerMatch && bannerMatch[1]) {
                banner = bannerMatch[1].startsWith('http') ? bannerMatch[1] : `${CONFIG.EXTERNAL_URL_BASE}${bannerMatch[1]}`;
                break;
            }
        }

        const subscriberPatterns = [
            />([0-9,]+)\s*<\/em>/i,
            /<em[^>]*>([0-9,]+)<\/em>/i,
            /(\d+(?:[,.\d]*)?[KMB]?)\s*(?:subscribers?|followers?|views?)/i,
            /class="[^"]*subscribers[^"]*"[^>]*>([^<]+)</i
        ];

        let subscribers = 0;
        for (const pattern of subscriberPatterns) {
            const subMatch = html.match(pattern);
            if (subMatch && subMatch[1]) {
                const subStr = subMatch[1].replace(/<[^>]*>/g, '').trim();
                subscribers = parseViewCount(subStr);
                if (subscribers > 0) break;
            }
        }

        const videoCountMatch = html.match(/(\d+)\s*videos?/i);
        const videoCount = videoCountMatch ? parseInt(videoCountMatch[1]) : 0;

        const descPatterns = [
            /<div[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<p[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/p>/i
        ];

        let description = videoCount > 0 ? `${videoCount} videos` : "";
        for (const pattern of descPatterns) {
            const descMatch = html.match(pattern);
            if (descMatch && descMatch[1]) {
                const descText = descMatch[1].replace(/<[^>]*>/g, '').trim();
                if (descText) {
                    description = descText;
                }
                break;
            }
        }

        return new PlatformChannel({
            id: new PlatformID(PLATFORM, result.type === 'pornstar' ? `pornstar:${result.id}` : result.id, plugin.config.id),
            name: name,
            thumbnail: avatar,
            banner: banner,
            subscribers: subscribers,
            description: description,
            url: internalUrl,
            links: {}
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel: " + error.message);
    }
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    try {
        const result = extractChannelId(url);
        const page = continuationToken ? parseInt(continuationToken) : 1;

        let profileUrl;
        if (result.type === 'pornstar') {
            if (result.shortId) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${result.shortId}/pornstar/${result.id}`;
            } else {
                const baseHtml = makeRequest(`${CONFIG.EXTERNAL_URL_BASE}/pornstar/${result.id}`, API_HEADERS, 'pornstar redirect');
                const redirectMatch = baseHtml.match(/href="\/([a-z0-9]+)\/pornstar\//);
                if (redirectMatch) {
                    profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${redirectMatch[1]}/pornstar/${result.id}`;
                } else {
                    profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${result.id}`;
                }
            }
            if (page > 1) {
                profileUrl += `/${page}`;
            }
        } else if (result.type === 'channel') {
            const [shortId, channelName] = result.id.split(':');
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            }
        } else {
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/videos/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/videos`;
            }
        }

        if (order === Type.Order.Views) {
            profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'o=4';
        } else if (order === Type.Order.Rating) {
            profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'o=5';
        }

        const html = makeRequest(profileUrl, API_HEADERS, 'channel contents');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangChannelContentPager(platformVideos, hasMore, {
            url: url,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel contents: " + error.message);
    }
};

source.getChannelVideos = function(url, continuationToken) {
    return source.getChannelContents(url, Type.Feed.Videos, Type.Order.Chronological, [], continuationToken);
};

source.isContentDetailsUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    return REGEX_PATTERNS.urls.videoStandard.test(url) ||
           REGEX_PATTERNS.urls.videoAlternative.test(url) ||
           REGEX_PATTERNS.urls.videoShort.test(url);
};

source.getContentDetails = function(url) {
    try {
        const html = makeRequest(url, API_HEADERS, 'video details');
        const videoData = parseVideoPage(html, url);
        return createVideoDetails(videoData, url);

    } catch (error) {
        throw new ScriptException("Failed to get video details: " + error.message);
    }
};

source.getContentRecommendations = function(url) {
    try {
        const html = makeRequest(url, API_HEADERS, 'recommendations');
        const videoData = parseVideoPage(html, url);

        if (videoData.relatedVideos && videoData.relatedVideos.length > 0) {
            const platformVideos = videoData.relatedVideos.map(v => createPlatformVideo(v));
            return new SpankBangSearchPager(platformVideos, false, { url: url });
        }

        return new SpankBangSearchPager([], false, { url: url });

    } catch (error) {
        log("getContentRecommendations error: " + error.message);
        return new SpankBangSearchPager([], false, { url: url });
    }
};

source.getComments = function(url) {
    try {
        const videoId = extractVideoId(url);
        const commentsUrl = `${BASE_URL}/${videoId}/comments/`;

        const html = makeRequest(commentsUrl, API_HEADERS, 'comments');
        const comments = parseComments(html, videoId);

        const platformComments = comments.map(c => new Comment(c));

        return new SpankBangCommentPager(platformComments, false, { url: url, videoId: videoId });

    } catch (error) {
        return new SpankBangCommentPager([], false, { url: url });
    }
};

source.getSubComments = function(comment) {
    return new SpankBangCommentPager([], false, {});
};

source.isPlaylistUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    return REGEX_PATTERNS.urls.playlistInternal.test(url) ||
           REGEX_PATTERNS.urls.categoryInternal.test(url);
};

source.searchPlaylists = function(query, type, order, filters, continuationToken) {
    return new SpankBangPlaylistPager([], false, { query: query });
};

source.getPlaylist = function(url) {
    try {
        let searchTerm;

        const categoryMatch = url.match(REGEX_PATTERNS.urls.categoryInternal);
        const playlistMatch = url.match(REGEX_PATTERNS.urls.playlistInternal);

        if (categoryMatch) {
            searchTerm = categoryMatch[1];
        } else if (playlistMatch) {
            searchTerm = playlistMatch[1];
        } else {
            throw new ScriptException("Invalid playlist URL format");
        }

        const searchUrl = `${BASE_URL}/s/${encodeURIComponent(searchTerm)}/`;
        const html = makeRequest(searchUrl, API_HEADERS, 'playlist');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        return new PlatformPlaylistDetails({
            id: new PlatformID(PLATFORM, searchTerm, plugin.config.id),
            name: searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1),
            thumbnail: platformVideos.length > 0 ? platformVideos[0].thumbnails : new Thumbnails([]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, "spankbang", plugin.config.id),
                "SpankBang",
                CONFIG.EXTERNAL_URL_BASE,
                ""
            ),
            datetime: 0,
            url: url,
            videoCount: platformVideos.length,
            contents: new SpankBangSearchPager(platformVideos, false, { query: searchTerm })
        });

    } catch (error) {
        throw new ScriptException("Failed to get playlist: " + error.message);
    }
};

class SpankBangHomeContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

class SpankBangSearchPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.search(
            this.context.query,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

class SpankBangChannelPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.searchChannels(this.context.query, this.context.continuationToken);
    }
}

class SpankBangCreatorPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getCreators(this.context.continuationToken);
    }
}

class SpankBangChannelContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getChannelContents(
            this.context.url,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

class SpankBangPlaylistPager extends PlaylistPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return new SpankBangPlaylistPager([], false, this.context);
    }
}

class SpankBangCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return new SpankBangCommentPager([], false, this.context);
    }
}

log("SpankBang plugin loaded - v7");
