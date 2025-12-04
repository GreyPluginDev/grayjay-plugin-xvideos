const BASE_URL = "https://spankbang.com";
const PLATFORM = "SpankBang";

let localConfig = {};

const CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50,
    VIDEO_QUALITIES: {
        "240": { name: "240p", width: 320, height: 240 },
        "360": { name: "360p", width: 640, height: 360 },
        "480": { name: "480p", width: 854, height: 480 },
        "720": { name: "720p", width: 1280, height: 720 },
        "1080": { name: "1080p", width: 1920, height: 1080 },
        "4k": { name: "4K", width: 3840, height: 2160 }
    },
    INTERNAL_URL_SCHEME: "spankbang://profile/",
    EXTERNAL_URL_BASE: "https://spankbang.com"
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
        channelInternal: /^spankbang:\/\/profile\/(.+)$/
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

    const pornstarMatch = url.match(REGEX_PATTERNS.extraction.pornstarName);
    if (pornstarMatch && pornstarMatch[1]) {
        return `pornstar:${pornstarMatch[1]}`;
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

function parseVideoPage(html, url) {
    const videoData = {
        id: extractVideoId(url),
        url: url,
        title: "Unknown Title",
        duration: 0,
        views: 0,
        uploadDate: 0,
        thumbnail: "",
        uploader: { name: "Unknown", url: "" },
        sources: {}
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

    const uploaderMatch = html.match(/class="n"\s*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</);
    if (uploaderMatch) {
        videoData.uploader = {
            url: uploaderMatch[1].startsWith('http') ? uploaderMatch[1] : `${CONFIG.EXTERNAL_URL_BASE}${uploaderMatch[1]}`,
            name: uploaderMatch[2].trim()
        };
    }

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
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: videoData.sources[quality],
                name: quality,
                container: "mp4",
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
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: url,
                name: quality,
                container: "mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    if (videoData.sources.hls || videoData.sources.m3u8) {
        const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
        videoSources.push(new HLSSource({
            url: hlsUrl,
            name: "HLS",
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
    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, uploader.name || "", plugin.config.id),
        uploader.name || "Unknown",
        uploader.url || CONFIG.EXTERNAL_URL_BASE,
        ""
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
        description: videoData.title || "",
        video: new VideoSourceDescriptor(videoSources),
        live: null,
        subtitles: []
    });
}

function parseSearchResults(html) {
    const videos = [];
    
    const videoBlockRegex = /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    let match;
    
    while ((match = videoBlockRegex.exec(html)) !== null) {
        const block = match[0];
        
        const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
        if (!linkMatch) continue;
        
        const videoId = linkMatch[1];
        const videoSlug = linkMatch[2];
        
        const thumbMatch = block.match(/data-src="([^"]+)"/);
        const thumbnail = thumbMatch ? thumbMatch[1] : "";
        
        const titleMatch = block.match(/title="([^"]+)"/);
        const title = titleMatch ? titleMatch[1] : "Unknown";
        
        const durationMatch = block.match(/<span[^>]*class="[^"]*l[^"]*"[^>]*>([^<]+)<\/span>/);
        const durationStr = durationMatch ? durationMatch[1].trim() : "0:00";
        
        const viewsMatch = block.match(/<span[^>]*class="[^"]*v[^"]*"[^>]*>([^<]+)<\/span>/);
        const viewsStr = viewsMatch ? viewsMatch[1].trim() : "0";
        
        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: parseDuration(durationStr),
            views: parseInt(viewsStr.replace(/[,\.K]/g, '')) || 0,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: { name: "SpankBang", url: CONFIG.EXTERNAL_URL_BASE }
        });
    }
    
    return videos;
}

source.enable = function(config) {
    localConfig = config;
};

source.disable = function() {};

source.getHome = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        const url = page > 1 ? `${BASE_URL}/trending/videos/${page}/` : `${BASE_URL}/`;
        
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
    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Mixed, Type.Feed.Videos],
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
        const searchUrl = `${BASE_URL}/s/${searchQuery}/${page}/`;
        
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
    return new SpankBangChannelPager([], false, { query: query });
};

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') return false;
    
    return REGEX_PATTERNS.urls.channelProfile.test(url) ||
           REGEX_PATTERNS.urls.channelS.test(url) ||
           REGEX_PATTERNS.urls.pornstar.test(url) ||
           REGEX_PATTERNS.urls.channelInternal.test(url);
};

source.getChannel = function(url) {
    try {
        const profileId = extractProfileId(url);
        let profileUrl = url;
        
        if (profileId.startsWith('pornstar:')) {
            const name = profileId.replace('pornstar:', '');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${name}`;
        } else if (!url.startsWith('http')) {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileId}`;
        }
        
        const html = makeRequest(profileUrl, API_HEADERS, 'channel');
        
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const name = nameMatch ? nameMatch[1].trim() : profileId;
        
        const avatarMatch = html.match(/class="[^"]*avatar[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/);
        const avatar = avatarMatch ? avatarMatch[1] : "";
        
        const bannerMatch = html.match(/class="[^"]*cover[^"]*"[^>]*style="[^"]*url\(([^)]+)\)"/);
        const banner = bannerMatch ? bannerMatch[1] : "";
        
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, profileId, plugin.config.id),
            name: name,
            thumbnail: avatar,
            banner: banner,
            subscribers: 0,
            description: "",
            url: profileUrl,
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

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    try {
        const profileId = extractProfileId(url);
        const page = continuationToken ? parseInt(continuationToken) : 1;
        
        let profileUrl;
        if (profileId.startsWith('pornstar:')) {
            const name = profileId.replace('pornstar:', '');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${name}/${page}/`;
        } else {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileId}/videos/${page}/`;
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

log("SpankBang plugin loaded");