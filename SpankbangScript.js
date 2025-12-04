const BASE_URL = "https://spankbang.com";
const PLATFORM = "SpankBang";

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
        channelS: /^https?:\/\/(?:www\.)?spankbang\.com\/s\/([^\/\?]+)/,
        pornstar: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/([^\/\?]+)/,
        playlistInternal: /^spankbang:\/\/playlist\/(.+)$/,
        categoryInternal: /^spankbang:\/\/category\/(.+)$/,
        channelInternal: /^spankbang:\/\/profile\/(.+)$/,
        relativeProfile: /^\/profile\/([^\/\?]+)/,
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

function extractProfileId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for profile ID extraction");
    }

    const internalMatch = url.match(REGEX_PATTERNS.urls.channelInternal);
    if (internalMatch && internalMatch[1]) {
        return internalMatch[1];
    }

    const relativePornstarMatch = url.match(REGEX_PATTERNS.urls.relativePornstar);
    if (relativePornstarMatch && relativePornstarMatch[1]) {
        return `pornstar:${relativePornstarMatch[1]}`;
    }

    const pornstarMatch = url.match(REGEX_PATTERNS.extraction.pornstarName);
    if (pornstarMatch && pornstarMatch[1]) {
        return `pornstar:${pornstarMatch[1]}`;
    }

    const relativeProfileMatch = url.match(REGEX_PATTERNS.urls.relativeProfile);
    if (relativeProfileMatch && relativeProfileMatch[1]) {
        return relativeProfileMatch[1];
    }

    const relativeSMatch = url.match(REGEX_PATTERNS.urls.relativeS);
    if (relativeSMatch && relativeSMatch[1]) {
        return relativeSMatch[1];
    }

    const profileMatch = url.match(REGEX_PATTERNS.extraction.profileName);
    if (profileMatch && profileMatch[1]) {
        return profileMatch[1];
    }

    throw new ScriptException(`Could not extract profile ID from URL: ${url}`);
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

function extractUploaderFromHtml(html) {
    const uploader = {
        name: "Unknown",
        url: "",
        avatar: ""
    };

    const uploaderPatterns = [
        /<a[^>]*href="(\/profile\/[^"]+)"[^>]*class="[^"]*uploader[^"]*"[^>]*>([^<]+)</i,
        /<a[^>]*class="[^"]*uploader[^"]*"[^>]*href="(\/profile\/[^"]+)"[^>]*>([^<]+)</i,
        /class="n"\s*>\s*<a[^>]*href="(\/(?:profile|s|pornstar)\/[^"]+)"[^>]*>([^<]+)</i,
        /<div[^>]*class="[^"]*info[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(\/(?:profile|s|pornstar)\/[^"]+)"[^>]*>([^<]+)</i,
        /<a[^>]*href="(\/(?:profile|s|pornstar)\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</i
    ];

    for (const pattern of uploaderPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[2]) {
            const href = match[1];
            const name = match[2].trim();
            
            let profileId;
            if (href.includes('/pornstar/')) {
                const pornstarMatch = href.match(/\/pornstar\/([^\/\?]+)/);
                profileId = pornstarMatch ? `pornstar:${pornstarMatch[1]}` : name;
            } else {
                const profileMatch = href.match(/\/(?:profile|s)\/([^\/\?]+)/);
                profileId = profileMatch ? profileMatch[1] : name;
            }
            
            uploader.name = name;
            uploader.url = `spankbang://profile/${profileId}`;
            break;
        }
    }

    const avatarPatterns = [
        /<img[^>]*class="[^"]*(?:avatar|profile-pic|uploader-img)[^"]*"[^>]*src="([^"]+)"/i,
        /class="[^"]*(?:avatar|profile|uploader)[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
        /<div[^>]*class="[^"]*info[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+\.(?:jpg|jpeg|png|gif|webp))"/i
    ];

    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            uploader.avatar = match[1].startsWith('http') ? match[1] : `${CONFIG.EXTERNAL_URL_BASE}${match[1]}`;
            break;
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
        uploader: { name: "Unknown", url: "", avatar: "" },
        sources: {},
        rating: 0
    };

    const titleMatch = html.match(/<h1[^>]*title="([^"]+)"/);
    if (titleMatch) {
        videoData.title = titleMatch[1];
    } else {
        const altTitleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (altTitleMatch) {
            videoData.title = altTitleMatch[1].replace(/ - SpankBang$/, '').trim();
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

function parseSearchResults(html) {
    const videos = [];
    
    const videoBlockPatterns = [
        /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g,
        /<div[^>]*class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?<\/a>\s*<\/div>/g
    ];
    
    for (const pattern of videoBlockPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const block = match[0];
            
            const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
            if (!linkMatch) continue;
            
            const videoId = linkMatch[1];
            const videoSlug = linkMatch[2];
            
            const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
            const thumbnail = thumbMatch ? thumbMatch[1] : "";
            
            const titleMatch = block.match(/title="([^"]+)"/);
            const title = titleMatch ? titleMatch[1] : "Unknown";
            
            const durationMatch = block.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/);
            const durationStr = durationMatch ? durationMatch[1].trim() : "0:00";
            
            const viewsMatch = block.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/);
            const viewsStr = viewsMatch ? viewsMatch[1].trim() : "0";

            const uploaderMatch = block.match(/<a[^>]*href="(\/(?:profile|s|pornstar)\/[^"]+)"[^>]*(?:class="[^"]*u[^"]*")?[^>]*>([^<]+)</);
            let uploader = { name: "SpankBang", url: "", avatar: "" };
            
            if (uploaderMatch) {
                const href = uploaderMatch[1];
                const name = uploaderMatch[2].trim();
                
                let profileId;
                if (href.includes('/pornstar/')) {
                    const pornstarMatch = href.match(/\/pornstar\/([^\/\?]+)/);
                    profileId = pornstarMatch ? `pornstar:${pornstarMatch[1]}` : name;
                } else {
                    const profileMatch = href.match(/\/(?:profile|s)\/([^\/\?]+)/);
                    profileId = profileMatch ? profileMatch[1] : name;
                }
                
                uploader = {
                    name: name,
                    url: `spankbang://profile/${profileId}`,
                    avatar: ""
                };
            }
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: parseDuration(durationStr),
                views: parseViewCount(viewsStr),
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: uploader
            });
        }
        
        if (videos.length > 0) break;
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

source.enable = function(config) {
    localConfig = config;
};

source.disable = function() {};

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
        types: [Type.Feed.Mixed, Type.Feed.Videos],
        sorts: [Type.Order.Chronological, Type.Order.Views, Type.Order.Rating],
        filters: [
            {
                id: "duration",
                name: "Duration",
                isMultiSelect: false,
                filters: [
                    { id: "", name: "Any", value: "" },
                    { id: "1", name: "Short (< 10 min)", value: "1" },
                    { id: "2", name: "Medium (10-30 min)", value: "2" },
                    { id: "3", name: "Long (> 30 min)", value: "3" }
                ]
            },
            {
                id: "quality",
                name: "Quality",
                isMultiSelect: false,
                filters: [
                    { id: "", name: "Any", value: "" },
                    { id: "1", name: "HD (720p+)", value: "1" },
                    { id: "2", name: "Full HD (1080p+)", value: "2" },
                    { id: "3", name: "4K", value: "3" }
                ]
            },
            {
                id: "period",
                name: "Upload Date",
                isMultiSelect: false,
                filters: [
                    { id: "", name: "Any time", value: "" },
                    { id: "1", name: "Today", value: "1" },
                    { id: "2", name: "This week", value: "2" },
                    { id: "3", name: "This month", value: "3" },
                    { id: "4", name: "This year", value: "4" }
                ]
            }
        ]
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
    
    if (REGEX_PATTERNS.urls.relativeProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativeS.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstar.test(url)) return true;
    
    if (REGEX_PATTERNS.urls.channelProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.channelS.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstar.test(url)) return true;
    
    return false;
};

source.getChannel = function(url) {
    try {
        const profileId = extractProfileId(url);
        let profileUrl;
        
        if (profileId.startsWith('pornstar:')) {
            const name = profileId.replace('pornstar:', '');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${name}`;
        } else {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileId}`;
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
            /(\d+(?:[,.\d]*)?)\s*(?:subscribers?|followers?)/i,
            /class="[^"]*subscribers[^"]*"[^>]*>([^<]+)</i
        ];
        
        let subscribers = 0;
        for (const pattern of subscriberPatterns) {
            const subMatch = html.match(pattern);
            if (subMatch && subMatch[1]) {
                subscribers = parseViewCount(subMatch[1]);
                break;
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
            url: profileUrl,
            links: {}
        });
        
    } catch (error) {
        throw new ScriptException("Failed to get channel: " + error.message);
    }
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Mixed, Type.Feed.Videos],
        sorts: [Type.Order.Chronological, Type.Order.Views, Type.Order.Rating],
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
