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
        pornstar: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/([^\/\?]+)/,
        playlistInternal: /^spankbang:\/\/playlist\/(.+)$/,
        categoryInternal: /^spankbang:\/\/category\/(.+)$/,
        channelInternal: /^spankbang:\/\/channel\/(.+)$/,
        profileInternal: /^spankbang:\/\/profile\/(.+)$/,
        relativeProfile: /^\/profile\/([^\/\?]+)/,
        relativeChannel: /^\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        relativeS: /^\/s\/([^\/\?]+)/,
        relativePornstar: /^\/pornstar\/([^\/\?]+)/
    },
    extraction: {
        videoId: /\/([a-zA-Z0-9]+)\/(?:video|embed|play)/,
        videoIdShort: /spankbang\.com\/([a-zA-Z0-9]+)\//,
        profileName: /\/(?:profile|s)\/([^\/\?]+)/,
        pornstarName: /\/pornstar\/([^\/\?]+)/,
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

    const relativePornstarMatch = url.match(REGEX_PATTERNS.urls.relativePornstar);
    if (relativePornstarMatch && relativePornstarMatch[1]) {
        return { type: 'pornstar', id: relativePornstarMatch[1] };
    }

    const pornstarMatch = url.match(REGEX_PATTERNS.extraction.pornstarName);
    if (pornstarMatch && pornstarMatch[1]) {
        return { type: 'pornstar', id: pornstarMatch[1] };
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
    
    viewsStr = viewsStr.trim().toLowerCase();
    
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
        /src="(https?:\/\/spankbang\.com\/avatar\/[^"]+)"/i,
        /<img[^>]*src="(\/avatar\/[^"]+)"/i,
        /\!\[.*?\]\((https?:\/\/spankbang\.com\/avatar\/[^)]+)\)/i
    ];
    
    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1].startsWith('http') ? match[1] : `https://spankbang.com${match[1]}`;
        }
    }
    return "";
}

function extractUploaderFromHtml(html) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };
    
    const globalAvatar = extractAvatarFromHtml(html);

    const channelPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i,
        /class="n"\s*>\s*<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)</i,
        /<div[^>]*class="[^"]*info[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)</i
    ];

    for (const pattern of channelPatterns) {
        const match = html.match(pattern);
        if (match) {
            const shortId = match[1];
            const channelName = match[2];
            const displayName = match[3] ? match[3].trim() : channelName.replace(/\+/g, ' ');
            uploader.name = displayName;
            uploader.url = `spankbang://channel/${shortId}:${channelName}`;
            uploader.avatar = globalAvatar || "";
            return uploader;
        }
    }

    const profilePatterns = [
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/profile\/([^"]+)"[^>]*title="([^"]+)"/i,
        /class="n"\s*>\s*<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)</i,
        /<div[^>]*class="[^"]*info[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)</i
    ];

    for (const pattern of profilePatterns) {
        const match = html.match(pattern);
        if (match) {
            const profileName = match[1];
            const displayName = match[2] ? match[2].trim() : profileName.replace(/\+/g, ' ');
            uploader.name = displayName;
            uploader.url = `spankbang://profile/${profileName}`;
            uploader.avatar = globalAvatar || "";
            return uploader;
        }
    }

    const pornstarPatterns = [
        /<a[^>]*href="\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i,
        /class="n"\s*>\s*<a[^>]*href="\/pornstar\/([^"]+)"[^>]*>([^<]+)</i,
        /<div[^>]*class="[^"]*info[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/pornstar\/([^"]+)"[^>]*>([^<]+)</i
    ];

    for (const pattern of pornstarPatterns) {
        const match = html.match(pattern);
        if (match) {
            const pornstarName = match[1];
            const displayName = match[2] ? match[2].trim() : pornstarName.replace(/\+/g, ' ');
            uploader.name = displayName;
            uploader.url = `spankbang://profile/pornstar:${pornstarName}`;
            uploader.avatar = globalAvatar || "";
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
        rating: 0
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

    videoData.uploader = extractUploaderFromHtml(html);

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

    return videoData;
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
    
    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, uploader.name || "", plugin.config.id),
        uploader.name || "Unknown",
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
    const thumbBlockRegex = /<a[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    
    let itemMatch;
    while ((itemMatch = videoItemRegex.exec(html)) !== null) {
        const block = itemMatch[0];
        
        const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
        if (!linkMatch) continue;
        
        const videoId = linkMatch[1];
        const videoSlug = linkMatch[2];
        
        const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
        const thumbnail = thumbMatch ? thumbMatch[1] : "";
        
        const titleMatch = block.match(/title="([^"]+)"/);
        let title = titleMatch ? titleMatch[1] : "Unknown";
        title = cleanVideoTitle(title);
        
        const durationMatch = block.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const durationStr = durationMatch ? durationMatch[1].trim() : "0:00";
        
        const durationAltMatch = block.match(/>(\d+:\d+(?::\d+)?)</);
        const finalDuration = durationMatch ? durationMatch[1].trim() : (durationAltMatch ? durationAltMatch[1] : "0:00");
        
        const viewsMatch = block.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const viewsAltMatch = block.match(/>([0-9,.]+[KMB]?)\s*<\/span>/i);
        const viewsStr = viewsMatch ? viewsMatch[1].trim() : (viewsAltMatch ? viewsAltMatch[1] : "0");

        let uploader = { name: "", url: "", avatar: "" };
        
        const avatarInBlock = extractAvatarFromHtml(block);
        
        const channelPatterns = [
            /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
            /href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i,
            /\[([^\]]+)\]\(\/([a-z0-9]+)\/channel\/([^)]+)\)/i
        ];
        
        for (const pattern of channelPatterns) {
            const channelMatch = block.match(pattern);
            if (channelMatch) {
                if (pattern.toString().includes('\\[')) {
                    uploader = {
                        name: channelMatch[1].trim(),
                        url: `spankbang://channel/${channelMatch[2]}:${channelMatch[3]}`,
                        avatar: avatarInBlock
                    };
                } else {
                    const shortId = channelMatch[1];
                    const channelName = channelMatch[2];
                    const displayName = channelMatch[3] ? channelMatch[3].trim() : channelName.replace(/\+/g, ' ');
                    uploader = {
                        name: displayName,
                        url: `spankbang://channel/${shortId}:${channelName}`,
                        avatar: avatarInBlock
                    };
                }
                break;
            }
        }
        
        if (!uploader.name) {
            const profilePatterns = [
                /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
                /href="\/profile\/([^"]+)"[^>]*title="([^"]+)"/i
            ];
            
            for (const pattern of profilePatterns) {
                const profileMatch = block.match(pattern);
                if (profileMatch) {
                    const profileName = profileMatch[1];
                    const displayName = profileMatch[2] ? profileMatch[2].trim() : profileName.replace(/\+/g, ' ');
                    uploader = {
                        name: displayName,
                        url: `spankbang://profile/${profileName}`,
                        avatar: avatarInBlock
                    };
                    break;
                }
            }
        }
        
        if (!uploader.name) {
            const pornstarPatterns = [
                /<a[^>]*href="\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
                /href="\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i
            ];
            
            for (const pattern of pornstarPatterns) {
                const pornstarMatch = block.match(pattern);
                if (pornstarMatch) {
                    const pornstarName = pornstarMatch[1];
                    const displayName = pornstarMatch[2] ? pornstarMatch[2].trim() : pornstarName.replace(/\+/g, ' ');
                    uploader = {
                        name: displayName,
                        url: `spankbang://profile/pornstar:${pornstarName}`,
                        avatar: avatarInBlock
                    };
                    break;
                }
            }
        }
        
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

function parseChannelResults(html) {
    const channels = [];
    
    const channelBlockPatterns = [
        /<div[^>]*class="[^"]*(?:user-item|channel-item|profile-item)[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g,
        /<a[^>]*href="\/(?:profile|pornstar)\/[^"]+[^>]*>[\s\S]*?<\/a>/g
    ];
    
    for (const pattern of channelBlockPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const block = match[0];
            
            const linkMatch = block.match(/href="\/(profile|pornstar)\/([^"]+)"/);
            if (!linkMatch) continue;
            
            const type = linkMatch[1];
            const profileName = linkMatch[2];
            const profileId = type === 'pornstar' ? `pornstar:${profileName}` : profileName;
            
            const namePatterns = [
                /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/,
                /title="([^"]+)"/,
                />([^<]+)</
            ];
            
            let name = profileName;
            for (const namePattern of namePatterns) {
                const nameMatch = block.match(namePattern);
                if (nameMatch && nameMatch[1]) {
                    name = nameMatch[1].trim();
                    break;
                }
            }
            
            const avatarMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/);
            const avatar = avatarMatch ? avatarMatch[1] : "";
            
            const videoCountMatch = block.match(/(\d+)\s*videos?/i);
            const videoCount = videoCountMatch ? parseInt(videoCountMatch[1]) : 0;
            
            const subscriberMatch = block.match(/(\d+(?:[,.\d]*)?)\s*(?:subscribers?|followers?)/i);
            const subscribers = subscriberMatch ? parseViewCount(subscriberMatch[1]) : 0;
            
            channels.push({
                id: profileId,
                name: name,
                avatar: avatar,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${type}/${profileName}`,
                videoCount: videoCount,
                subscribers: subscribers
            });
        }
        
        if (channels.length > 0) break;
    }
    
    return channels;
}

function parseComments(html, videoId) {
    const comments = [];
    
    const commentPatterns = [
        /<div[^>]*class="[^"]*comment[^"]*"[^>]*data-id="(\d+)"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g,
        /<div[^>]*class="[^"]*comment-item[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g
    ];
    
    for (const pattern of commentPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const block = match[0];
            
            const idMatch = block.match(/data-id="(\d+)"/);
            const commentId = idMatch ? idMatch[1] : `comment_${comments.length}`;
            
            const userPatterns = [
                /<a[^>]*class="[^"]*(?:username|author)[^"]*"[^>]*>([^<]+)<\/a>/,
                /<span[^>]*class="[^"]*(?:username|author)[^"]*"[^>]*>([^<]+)<\/span>/
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
                /<div[^>]*class="[^"]*(?:comment-text|text|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/,
                /<p[^>]*class="[^"]*(?:comment-text|text)[^"]*"[^>]*>([\s\S]*?)<\/p>/
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

source.searchChannels = function(query) {
    try {
        if (!query || query.trim().length === 0) {
            return new SpankBangChannelPager([], false, { query: query });
        }
        
        const searchQuery = encodeURIComponent(query.trim());
        const searchUrl = `${BASE_URL}/pornstars?q=${searchQuery}`;
        
        const html = makeRequest(searchUrl, API_HEADERS, 'channel search');
        const channels = parseChannelResults(html);
        
        const platformChannels = channels.map(c => new PlatformChannel({
            id: new PlatformID(PLATFORM, c.id, plugin.config.id),
            name: c.name,
            thumbnail: c.avatar,
            banner: "",
            subscribers: c.subscribers,
            description: "",
            url: c.url,
            links: {}
        }));
        
        return new SpankBangChannelPager(platformChannels, false, { query: query });
        
    } catch (error) {
        return new SpankBangChannelPager([], false, { query: query });
    }
};

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') return false;
    
    if (REGEX_PATTERNS.urls.channelInternal.test(url)) return true;
    if (REGEX_PATTERNS.urls.profileInternal.test(url)) return true;
    
    if (REGEX_PATTERNS.urls.relativeProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativeChannel.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstar.test(url)) return true;
    
    if (REGEX_PATTERNS.urls.channelProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.channelOfficial.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstar.test(url)) return true;
    
    return false;
};

source.getChannel = function(url) {
    try {
        const profileId = extractProfileId(url);
        let profileUrl;
        let internalUrl;
        
        if (profileId.startsWith('pornstar:')) {
            const name = profileId.replace('pornstar:', '');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${name}`;
            internalUrl = `spankbang://profile/${profileId}`;
        } else if (profileId.startsWith('channel:')) {
            const channelInfo = profileId.replace('channel:', '');
            const [shortId, channelName] = channelInfo.split(':');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            internalUrl = `spankbang://channel/${channelInfo}`;
        } else {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileId}`;
            internalUrl = `spankbang://profile/${profileId}`;
        }
        
        const html = makeRequest(profileUrl, API_HEADERS, 'channel');
        
        const namePatterns = [
            /<h1[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/h1>/i,
            /<h1[^>]*>([^<]+)<\/h1>/,
            /<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/
        ];
        
        let name = profileId;
        for (const pattern of namePatterns) {
            const nameMatch = html.match(pattern);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1].trim();
                break;
            }
        }
        
        const avatarPatterns = [
            /\!\[.*?\]\((https?:\/\/spankbang\.com\/avatar\/[^)]+)\)/i,
            /src="(https?:\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /<img[^>]*src="(\/avatar\/[^"]+)"/i,
            /class="[^"]*avatar[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*profile-pic[^"]*"[^>]*src="([^"]+)"/i,
            /class="[^"]*profile[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i
        ];
        
        let avatar = "";
        for (const pattern of avatarPatterns) {
            const avatarMatch = html.match(pattern);
            if (avatarMatch && avatarMatch[1]) {
                avatar = avatarMatch[1].startsWith('http') ? avatarMatch[1] : `${CONFIG.EXTERNAL_URL_BASE}${avatarMatch[1]}`;
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
            /Subscribers:\s*_([^_]+)_/i,
            /Subscribers:\s*<[^>]*>([^<]+)</i,
            /<em[^>]*>(\d+[KMB]?)<\/em>/i,
            />(\d+(?:[,.\d]*)?[KMB]?)\s*<\/em>/i,
            /(\d+(?:[,.\d]*)?[KMB]?)\s*(?:subscribers?|followers?)/i,
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
        
        const descPatterns = [
            /<div[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<p[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/p>/i
        ];
        
        let description = "";
        for (const pattern of descPatterns) {
            const descMatch = html.match(pattern);
            if (descMatch && descMatch[1]) {
                description = descMatch[1].replace(/<[^>]*>/g, '').trim();
                break;
            }
        }
        
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, profileId, plugin.config.id),
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
        const profileId = extractProfileId(url);
        const page = continuationToken ? parseInt(continuationToken) : 1;
        
        let profileUrl;
        if (profileId.startsWith('pornstar:')) {
            const name = profileId.replace('pornstar:', '');
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${name}/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${name}`;
            }
        } else if (profileId.startsWith('channel:')) {
            const channelInfo = profileId.replace('channel:', '');
            const [shortId, channelName] = channelInfo.split(':');
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            }
        } else {
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileId}/videos/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileId}/videos`;
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
        return new SpankBangChannelPager([], false, this.context);
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

log("SpankBang plugin loaded");
