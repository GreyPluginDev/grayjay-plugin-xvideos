const BASE_URL = "https://spankbang.com";
const PLATFORM = "SPANKBANG";
let localConfig = {};

/**
 * Configuration constants for better maintainability
 */
const CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50, // adjust if needed
    VIDEO_QUALITIES: {
        LOW: { name: "240p", width: 320, height: 240 },
        MEDIUM: { name: "360p", width: 640, height: 360 }
    },
    INTERNAL_URL_SCHEME: "spankbang://profile/",  // optional, can be used if you implement app deep linking
    EXTERNAL_URL_BASE: "https://spankbang.com"
};

/**
 * Required headers for API authentication
 * Based on exact headers from working curl requests
 * Note: accept-encoding is excluded to avoid gzip issues
 */
const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 15; Pixel 7 Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
};

/**
 * Regular expressions organized by functionality
 * Centralized for better maintainability and reusability
 */
const REGEX_PATTERNS = {
    urls: {
        // Video URL patterns
        videoStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/.*$/,
        videoMobile: /^https?:\/\/(?:m\.)?spankbang\.com\/([a-zA-Z0-9]+)\/.*$/,

        // Channel/Profile URL patterns
        channelStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/users\/[^\/\?]+/,
        channelMobile: /^https?:\/\/(?:m\.)?spankbang\.com\/users\/[^\/\?]+/,

        // Pornstar URL patterns
        pornstarStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/[^\/\?]+/,
        pornstarMobile: /^https?:\/\/(?:m\.)?spankbang\.com\/pornstar\/[^\/\?]+/,

        // Playlist URL patterns
        playlistStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/[a-zA-Z0-9]+\/playlist\/[^\/\?]+/,
        playlistMobile: /^https?:\/\/(?:m\.)?spankbang\.com\/[a-zA-Z0-9]+\/playlist\/[^\/\?]+/,

        // Internal schemes for GrayJay
        playlistInternal: /^spankbang:\/\/playlist\/(.+)$/,
        categoryInternal: /^spankbang:\/\/category\/(.+)$/
    }

// ID Extraction Patterns for SpankBang
extraction: {
    // Video ID extraction
    videoIdStandard: /\/([a-zA-Z0-9]+)\//,           // e.g., /9m3ae/video
    videoIdPlaylist: /\/playlist\/([^\/\?]+)/,       // e.g., /playlist/3danim

    // Profile / Channel ID extraction
    profileIdUsername: /\/users\/([^\/\?]+)/,        // e.g., /users/username

    // Pornstar name extraction
    pornstarName: /\/pornstar\/([^\/\?]+)/
},

// Content Parsing Patterns
parsing: {
    // Duration parsing (e.g., "6:27" or "1:30:15" format SpankBang uses)
    duration: /(\d+):(\d+)(?::(\d+))?/g,

    // HTML tag removal
    htmlTags: /<[^>]*>/g,
    htmlBreaks: /<br\s*\/?>/gi
}

/**
 * Utility functions for SpankBang plugin
 * Handles API requests with standardized error handling
 */

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Make an API request with error handling and optional logging
 * @param {string} url - The API endpoint URL
 * @param {string} method - HTTP method (GET, POST)
 * @param {Object} headers - Request headers (defaults to API_HEADERS)
 * @param {string} body - Optional POST request body
 * @param {string} context - Context for error logging
 * @returns {Object} Parsed JSON response
 */
function makeApiRequest(url, method = 'GET', headers = API_HEADERS, body = null, context = 'API request') {
    try {
        let response;

        if (method.toUpperCase() === 'POST') {
            response = http.POST(url, body, headers, false);
        } else {
            response = http.GET(url, headers, false);
        }

        if (!response.isOk) {
            throw new ScriptException(`${context} failed with status ${response.code}`);
        }

        let data;
        try {
            data = JSON.parse(response.body);
        } catch (parseError) {
            throw new ScriptException(`${context} returned invalid JSON: ${parseError.message}`);
        }

        // Some endpoints (like comments) may not include a "result" field
        if (context.toLowerCase().includes('comment') || context.toLowerCase().includes('replies')) {
            return data;
        }

        if (!data.result) {
            throw new ScriptException(`Invalid ${context} response format - missing "result" field`);
        }

        return data;

    } catch (error) {
        throw new ScriptException(`Failed to fetch ${context}: ${error.message}`);
    }
}

/**
 * Extract video ID from SpankBang URL using multiple patterns
 * @param {string} url - Video URL to extract ID from
 * @returns {string} Extracted video ID
 */
function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    const patterns = [
        REGEX_PATTERNS.extraction.videoIdStandard,       // /\/([a-z0-9]+)\/video/
        REGEX_PATTERNS.extraction.videoIdAlternative,    // /\/video\/([a-z0-9]+)/
        REGEX_PATTERNS.extraction.videoIdNumericWithSuffix,
        REGEX_PATTERNS.extraction.videoIdNumeric
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    throw new ScriptException(`Could not extract video ID from URL: ${url}`);
}

/**
 * Extract profile or pornstar ID from SpankBang URL
 * @param {string} url - Profile URL to extract ID from
 * @returns {string} Extracted profile ID
 */
function extractProfileId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for profile ID extraction");
    }

    // Profile URLs (users)
    const profileMatch = url.match(REGEX_PATTERNS.extraction.profileIdUsername);
    if (profileMatch && profileMatch[1]) {
        return profileMatch[1];
    }

    // Pornstar URLs (special handling)
    const pornstarMatch = url.match(REGEX_PATTERNS.extraction.pornstarName);
    if (pornstarMatch && pornstarMatch[1]) {
        // Return the name; you can implement lookup later if needed
        return `pornstar:${pornstarMatch[1]}`;
    }

    // Playlist URLs
    const playlistMatch = url.match(REGEX_PATTERNS.extraction.playlistId);
    if (playlistMatch && playlistMatch[1]) {
        return playlistMatch[1];
    }

    throw new ScriptException(`Could not extract profile or pornstar ID from URL: ${url}`);
}
   // Try external URL patterns for regular profiles (SpankBang)
const patterns = [
    /\/pornstar\/([^\/\?]+)/,   // pornstar profiles
    /\/([a-zA-Z0-9_\-]+)\/?$/   // regular profiles or channels
];

for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
        const profileId = match[1];
        return profileId;
    }
}

throw new ScriptException(`Could not extract profile ID from URL: ${url}`);

/**
 * Create video sources from SpankBang video data
 * @param {Object} videoData - Video data from API
 * @returns {Array} Array of video sources
 */
function createVideoSources(videoData) {
    const videoSources = [];

    // Add MP4 sources if available
    if (videoData.sources?.mp4_240) {
        videoSources.push(new VideoUrlSource({
            url: videoData.sources.mp4_240,
            name: CONFIG.VIDEO_QUALITIES.LOW.name,
            container: "mp4",
            width: CONFIG.VIDEO_QUALITIES.LOW.width,
            height: CONFIG.VIDEO_QUALITIES.LOW.height
        }));
    }

    if (videoData.sources?.mp4_360) {
        videoSources.push(new VideoUrlSource({
            url: videoData.sources.mp4_360,
            name: CONFIG.VIDEO_QUALITIES.MEDIUM.name,
            container: "mp4",
            width: CONFIG.VIDEO_QUALITIES.MEDIUM.width,
            height: CONFIG.VIDEO_QUALITIES.MEDIUM.height
        }));
    }

    // Add HLS source if available
    if (videoData.sources?.hls) {
        videoSources.push(new HLSSource({
            url: videoData.sources.hls,
            name: "HLS",
            priority: true
        }));
    }

    if (videoSources.length === 0) {
        throw new ScriptException("No video sources available for this video");
    }

    return videoSources;
}

/**
 * Create thumbnails from video data
 * @param {Object} videoData - Video data from API
 * @returns {Thumbnails} Thumbnails object
 */
function createThumbnails(videoData) {
    return new Thumbnails([
        new Thumbnail(videoData.thumb_small || "", 0),
        new Thumbnail(videoData.thumb_medium || "", 1),
        new Thumbnail(videoData.thumb_big || "", 2)
    ]);
}

/**
 * Create platform author from video data
 * @param {Object} videoData - Video data from API
 * @returns {PlatformAuthorLink} Author object
 */
function createPlatformAuthor(videoData) {
    // Build external URL based on profile type
    let authorUrl;
    if (videoData.profile_name) {
        // Use channel format for regular profiles
        authorUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${videoData.profile_name}`;
    } else {
        // Fallback to internal URL if no profile name available
        authorUrl = `${CONFIG.INTERNAL_URL_SCHEME}${videoData.id_user}`;
    }

    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, videoData.id_user?.toString() || "", plugin.config.id),
        videoData.profile_name_display || videoData.profile_name || "Unknown",
        authorUrl,
        videoData.thumb_small || ""
    );
}

/**
 * Create video rating from SpankBang rating data
 * @param {Object} videoData - Video data from API
 * @returns {RatingLikesDislikes} Rating object with likes and dislikes
 */
function createVideoRating(videoData) {
    const likeCount = parseInt(videoData.likes || 0);
    const dislikeCount = parseInt(videoData.dislikes || 0);

    return new RatingLikesDislikes(
        isNaN(likeCount) ? 0 : likeCount,
        isNaN(dislikeCount) ? 0 : dislikeCount
    );
}

/**
 * Build video description with metadata
 * @param {Object} videoData - Video data from API
 * @returns {string} Formatted description
 */
function buildVideoDescription(videoData) {
    let description = videoData.title || "";

    if (videoData.tags && videoData.tags.length > 0) {
        description += "\n\nTags: " + videoData.tags.join(", ");
    }

    if (videoData.pornstars && videoData.pornstars.length > 0) {
        description += "\n\nStars: " + videoData.pornstars.join(", ");
    }

    // Add basic stats
    description += `\n\nViews: ${videoData.views?.toLocaleString() || 'Unknown'}`;
    description += `\nDuration: ${videoData.duration || 'Unknown'}`;
    description += `\nComments: ${videoData.nb_comments || 0}`;

    return description;
}

    // Add rating percentage for reference (actual like/dislike counts are in the rating object)
if (videoData.vote) {
    description += `\nRating: ${videoData.vote}%`;
}

return description;

/**
 * Create video details from API data
 * @param {Object} data - API response data
 * @param {string} originalUrl - Original video URL
 * @returns {PlatformVideoDetails} Video details object
 */
function createVideoDetailsFromApiData(data, originalUrl) {
    // SpankBang API response structure: { video: {...}, relateds: [...] }
    const videoData = data.video || data.data?.video;

    // Create video sources, thumbnails, author, description, and rating
    const videoSources = createVideoSources(videoData);
    const thumbnails = createThumbnails(videoData);
    const author = createPlatformAuthor(videoData);
    const description = buildVideoDescription(videoData);
    const rating = createVideoRating(videoData);

    // Correct upload time if necessary (optional)
    const ONE_YEAR_SECONDS = 31536000;
    const correctedDateTime = videoData.upload_time ? (videoData.upload_time - ONE_YEAR_SECONDS) : 0;

    const videoDetails = new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, videoData.id?.toString() || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: thumbnails,
        author: author,
        datetime: correctedDateTime,
        duration: parseDuration(videoData.duration),
        viewCount: videoData.views || 0,
        url: `${CONFIG.EXTERNAL_URL_BASE}/video/${videoData.id}/`,
        sharedUrl: videoData.url ? `${CONFIG.EXTERNAL_URL_BASE}${videoData.url}` : originalUrl,
        isLive: false,
        description: description,
        video: new VideoSourceDescriptor(videoSources),
        live: null,
        subtitles: [],
        rating: rating
    });

    // Add content recommendations if available
    const relateds = data.relateds || data.data?.relateds;
    if (relateds && Array.isArray(relateds) && relateds.length > 0) {
        videoDetails.getContentRecommendations = function () {
            return getContentRecommendations(relateds);
        };
    }

    // Add comment count if available
    if (videoData.comments_enabled && videoData.nb_comments > 0) {
        videoDetails.commentCount = videoData.nb_comments;
    }

    // Add comments function
    videoDetails.getComments = function (continuationToken) {
        return getVideoComments(videoData.id, continuationToken);
    };

    return videoDetails;
}

/**
 * Plugin initialization function
 * @param {Object} config - Plugin configuration
 */
source.enable = function (config) {
    localConfig = config;
};

/**
 * Get home page content with pagination support
 * Returns playlists (categories) on first page, then videos on subsequent pages
 * @param {string} continuationToken - Token for pagination
 * @returns {SpankBangHomeContentPager} Pager with home content
 */
source.getHome = function (continuationToken) {
    try {
        let startIndex = 0;

        if (continuationToken) {
            const tokenData = JSON.parse(continuationToken);
            startIndex = tokenData.videoStartIndex || 0;
        }

        // SpankBang API home endpoint
        const url = `${BASE_URL}/home?country=US&language=en`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'home content');

        // SpankBang response: { videos: [id, id, ...] } or legacy { ids: [...] }
        const ids = data.videos || data.ids;
        if (!ids || !Array.isArray(ids)) {
            throw new ScriptException("Invalid home response format - missing or invalid ids array");
        }

        const endIndex = Math.min(startIndex + CONFIG.DEFAULT_PAGE_SIZE, ids.length);
        const pageIds = ids.slice(startIndex, endIndex);

        if (pageIds.length === 0) {
            return new SpankBangHomeContentPager([], false, { continuationToken: null });
        }

        const videos = fetchVideoDetailsBulk(pageIds);

        const hasMore = endIndex < ids.length;
        const nextToken = hasMore ? JSON.stringify({ videoStartIndex: endIndex }) : null;

        // Append categories on the last page if available
        if (!hasMore) {
            try {
                const playlistsPager = getHomePlaylists();
                const categoryPlaylists = playlistsPager.results || [];
                if (categoryPlaylists && categoryPlaylists.length > 0) {
                    const combinedResults = videos.concat(categoryPlaylists);
                    return new SpankBangHomeContentPager(combinedResults, false, { continuationToken: null });
                }
            } catch (categoryError) {
                log("Failed to append categories on last page: " + categoryError.message);
            }
        }

        return new SpankBangHomeContentPager(videos, hasMore, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get home content: " + error.message);
    }
};

/**
 * Get home playlists (categories) from SpankBang categories endpoint
 * @returns {SpankBangHomeContentPager} Pager with playlist content
 */
function getHomePlaylists() {
    try {
        const url = `${BASE_URL}/categories`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'home categories');

        const categories = data.categories || data.data?.categories;
        if (!categories || !Array.isArray(categories)) {
            throw new ScriptException("Invalid categories response format - missing or invalid categories array");
        }

        const playlists = categories.map(category => {
            try {
                return new PlatformPlaylist({
                    id: new PlatformID(PLATFORM, category.id?.toString() || category.name, plugin.config.id),
                    name: category.name,
                    thumbnail: category.thumb_medium || category.thumb_small || "",
                    videoCount: category.nb_videos || 0,
                    url: `spankbang://category/${category.id || category.name}`,
                    author: new PlatformAuthorLink(
                        new PlatformID(PLATFORM, "spankbang", plugin.config.id),
                        "SpankBang",
                        CONFIG.EXTERNAL_URL_BASE,
                        ""
                    )
                });
            } catch (err) {
                log(`Error creating playlist from category: ${err.message}`);
                return null;
            }
        }).filter(p => p !== null);

        return new SpankBangHomeContentPager(playlists, false, { continuationToken: null });

    } catch (error) {
        throw new ScriptException("Failed to get home playlists: " + error.message);
    }
}

/**
 * Create a PlatformPlaylist from category data
 * @param {Object} category - Category data from SpankBang API
 * @returns {PlatformPlaylist} Playlist object
 */
function createPlatformPlaylist(category) {
    try {
        // Decode HTML entities in category name
        const categoryName = category?.name || "Unknown Category";
        const decoded = categoryName.toLowerCase().replace(/&#(\d+);/g, (_, dec) => {
            return String.fromCharCode(dec);
        });

        // Extract search term from category URL or use decoded name
        let searchTerm = decoded;
        if (category.url) {
            // Extract search term from URL like "/search/big+dick?top&id=28895395"
            const urlMatch = category.url.match(/\/search\/([^?]+)/);
            if (urlMatch && urlMatch[1]) {
                searchTerm = decodeURIComponent(urlMatch[1].replace(/\+/g, ' '));
            }
        }

        // Create internal URL for the playlist using the search term
        const playlistUrl = `spankbang://category/${searchTerm}`;

        // Use category thumbnail or a default one
        const thumbnail = category.thumbnail || "";

        // Parse video count
        let videoCount = -1;
        if (category.video_count && typeof category.video_count === 'string') {
            const numStr = category.video_count.replace(/,/g, '');
            const num = parseInt(numStr);
            if (!isNaN(num)) {
                videoCount = num;
            }
        }

        const playlistObj = {
            id: new PlatformID(PLATFORM, searchTerm, plugin.config.id),
            name: categoryName,
            thumbnails: new Thumbnails([
                new Thumbnail(thumbnail, 0)
            ]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, "spankbang", plugin.config.id),
                "SpankBang",
                CONFIG.EXTERNAL_URL_BASE,
                ""
            ),
            datetime: 0,
            url: playlistUrl,
            videoCount: videoCount,
            thumbnail: thumbnail
        };

        return new PlatformPlaylist(playlistObj);

    } catch (error) {
        log("Error creating playlist from category: " + error.message);
        return null;
    }
}

/**
 * Fetch video details in bulk for multiple video IDs
 * @param {string[]} videoIds - Array of video IDs to fetch
 * @returns {PlatformVideo[]} Array of platform video objects
 */
function fetchVideoDetailsBulk(videoIds) {
    if (!videoIds || videoIds.length === 0) {
        return [];
    }

    try {
        const idsParam = videoIds.join(',');
        const url = `${BASE_URL}/videos-info?ids=${idsParam}`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'bulk video details');

        // SpankBang response: { result: true, code: 0, data: { videos: {...} } }
        const videosData = data.data?.videos || data.videos;

        if (!videosData) {
            throw new ScriptException("Invalid video details response format - missing videos object");
        }

        const videos = [];
        for (const videoId of videoIds) {
            const videoData = videosData[videoId];
            if (videoData && videoData.type !== 'deleted') {
                videos.push(createPlatformVideo(videoData));
            }
        }

        return videos;

    } catch (error) {
        log("Error in fetchVideoDetailsBulk: " + error.message);
        return [];
    }
}

/**
 * Create a PlatformVideo object from video data
 * @param {Object} videoData - Video data from SpankBang API
 * @returns {PlatformVideo} Platform video object
 */
function createPlatformVideo(videoData) {
    const thumbnails = createThumbnails(videoData);
    const author = createPlatformAuthor(videoData);
    const rating = createVideoRating(videoData);
    const duration = parseDuration(videoData.duration);

    // Subtract 1 year (31536000 seconds) to correct the date
    const ONE_YEAR_SECONDS = 31536000;
    const correctedDateTime = videoData.upload_time ? (videoData.upload_time - ONE_YEAR_SECONDS) : 0;

    return new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id?.toString() || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: thumbnails,
        author: author,
        datetime: correctedDateTime,
        duration,
        viewCount: videoData.views || 0,
        url: `${CONFIG.EXTERNAL_URL_BASE}/video.${videoData.id}/`,
        isLive: false,
        rating: rating
    });
}

/**
 * Parse video duration (e.g., "6min", "27min", "1h 30min")
 * @param {string} durationStr - Duration string
 * @returns {number} Total duration in seconds
 */
function parseDuration(durationStr) {
    if (!durationStr) return 0;

    // Parse duration like "6min", "27min", "1h 30min"
    const parts = durationStr.toLowerCase().replace(/\s+/g, '').match(REGEX_PATTERNS.parsing.duration);
    let totalSeconds = 0;
    
    if (parts) {
        for (const part of parts) {
            const numericValue = parseInt(part);
            if (!isNaN(numericValue)) {
                if (part.includes('h')) {
                    totalSeconds += numericValue * 3600;
                } else if (part.includes('min')) {
                    totalSeconds += numericValue * 60;
                } else if (part.includes('s')) {
                    totalSeconds += numericValue;
                }
            }
        }
    }
    
    return totalSeconds;
}

/**
 * Create a PlatformComment object from comment data
 * @param {Object} commentData - Comment data from SpankBang API
 * @param {string} videoId - Video ID this comment belongs to
 * @param {number} childrenCounts - Number of replies (children comments)
 * @returns {PlatformComment} Platform comment object
 */
function createPlatformComment(commentData, videoId, childrenCounts) {
    try {
        if (!commentData || !commentData.id) {
            return null;
        }

        const comment = new PlatformComment({
            id: commentData.id.toString(),
            author: commentData.author || "Unknown",
            datetime: commentData.timestamp || 0,
            text: commentData.text || "No comment text",
            videoId: videoId,
            replyCount: childrenCounts || 0,
            score: commentData.score || 0,
            replies: [],
        });

        return comment;

    } catch (error) {
        log("Error creating comment from comment data: " + error.message);
        return null;
    }
}
        /**
 * Create a PlatformComment from comment data
 * @param {Object} commentData - Comment data from the API
 * @param {string} videoId - The ID of the video this comment belongs to
 * @param {Object} childrenCounts - Mapping of comment IDs to reply counts
 * @returns {PlatformComment} Comment object
 */
function createPlatformComment(commentData, videoId, childrenCounts) {
    try {
        // Default childrenCounts to empty object if not provided
        childrenCounts = childrenCounts || {};

        // Parse comment message - try multiple possible fields
        let message = "";
        if (commentData.message) {
            if (typeof commentData.message === 'string') {
                message = commentData.message;
            } else if (commentData.message.m) {
                message = commentData.message.m;
            } else if (commentData.message.message) {
                message = commentData.message.message;
            }
        } else if (commentData.text) {
            message = commentData.text;
        } else if (commentData.content) {
            message = commentData.content;
        }

        // Create author info
        let authorName = "Anonymous";
        let authorThumbnail = "";
        let authorUrl = "";

        if (commentData.name) {
            authorName = commentData.name;
        } else if (commentData.author) {
            authorName = commentData.author;
        } else if (commentData.username) {
            authorName = commentData.username;
        }

        if (commentData.pic) {
            authorThumbnail = commentData.pic;
        } else if (commentData.avatar) {
            authorThumbnail = commentData.avatar;
        } else if (commentData.thumbnail) {
            authorThumbnail = commentData.thumbnail;
        }

        if (commentData.url) {
            authorUrl = commentData.url;
        } else if (commentData.profile_url) {
            authorUrl = commentData.profile_url;
        }

        // Parse date - handle specific date formats
        let date = 0;
        const currentTimeSeconds = Math.round(Date.now() / 1000);

        const dateValue = commentData.date || commentData.timestamp || commentData.created_at || commentData.time;

        if (dateValue) {
            try {
                if (typeof dateValue === 'number') {
                    // Check if it's a Unix timestamp in seconds or milliseconds
                    if (dateValue > 1000000000 && dateValue < 10000000000) {
                        // Unix timestamp in seconds
                        date = dateValue;
                    } else if (dateValue > 1000000000000) {
                        // Unix timestamp in milliseconds - convert to seconds
                        date = Math.round(dateValue / 1000);
                    } else {
                        // Invalid or relative timestamp, use current time
                        date = currentTimeSeconds;
                    }
                } else if (typeof dateValue === 'string') {
                    // Try parsing as ISO string first
                    const parsedDate = new Date(dateValue);
                    if (!isNaN(parsedDate.getTime())) {
                        // Convert milliseconds to seconds
                        date = Math.round(parsedDate.getTime() / 1000);
                    } else {
                        // Try parsing as Unix timestamp string
                        const timestamp = parseInt(dateValue);
                        if (!isNaN(timestamp)) {
                            date = timestamp > 1000000000 ? timestamp : Math.round(timestamp / 1000);
                        } else {
                            date = currentTimeSeconds;
                        }
                    }
                }
            } catch (e) {
                date = currentTimeSeconds; // Use current time on error
            }
        } else {
            date = currentTimeSeconds;
        }

        // Parse vote counts
        let likeCount = 0;
        let dislikeCount = 0;

        if (commentData.votes) {
            likeCount = parseInt(commentData.votes.nb) || 0;
            dislikeCount = parseInt(commentData.votes.nbb) || 0;
        }

        // Parse reply count from the children mapping
        let replyCount = 0;
        if (childrenCounts && commentData.id && childrenCounts[commentData.id]) {
            replyCount = parseInt(childrenCounts[commentData.id]) || 0;
        }

        // Create comment context URL
        const contextUrl = `${CONFIG.EXTERNAL_URL_BASE}/video.${videoId}/`;

        // Create comment object
        const comment = new PlatformComment({
            contextUrl: contextUrl,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, commentData.id?.toString() || "", plugin.config.id),
                authorName,
                authorUrl,
                authorThumbnail
            ),
            message: message,
            rating: new RatingLikesDislikes(likeCount, dislikeCount),
            date: date,
            replyCount: replyCount,
            context: {
                id: commentData.id?.toString() || "",
                commentId: commentData.id?.toString() || "",
                videoId: videoId.toString() || "",
                claimId: videoId.toString() || "",
                country: commentData.country || "",
                countryName: commentData.country_name || "",
                timeDiff: commentData.time_diff || ""
            }
        });

        return comment;

    } catch (error) {
        return null; // Return null if any errors occur while creating the comment
    }
}

/**
 * Get recommendations for videos based on related video IDs
 * @param {string[]} relatedIds - Array of related video IDs
 * @returns {XNXXRecommendationsPager} Pager with recommended video details
 */
function getContentRecommendations(relatedIds) {
    try {
        if (!relatedIds || relatedIds.length === 0) {
            return new XNXXRecommendationsPager([], false, {});
        }

        // Fetch up to 20 recommended videos based on related IDs
        const recommendationIds = relatedIds.slice(0, 20);

        // Fetch video details for recommendations
        const recommendedVideos = fetchVideoDetailsBulk(recommendationIds);

        return new XNXXRecommendationsPager(recommendedVideos, false, {});

    } catch (error) {
        return new XNXXRecommendationsPager([], false, {});
    }
}

/**
 * Get comments for a video with pagination support
 * @param {string} videoId - Video ID
 * @param {string} continuationToken - Token for pagination
 * @returns {XNXXCommentPager} Pager with video comments
 */
function getVideoComments(videoId, continuationToken) {
    try {
        if (!videoId) {
            throw new ScriptException("Video ID is required for fetching comments");
        }

        // Parse continuation token for pagination
        let page = 0;
        let loadedIds = "";

        if (continuationToken) {
            try {
                const tokenData = JSON.parse(continuationToken);
                page = tokenData.page || 0;
                loadedIds = tokenData.loadedIds || "";
            } catch (e) {
                // If token is invalid, start from the first page
            }
        }

        // API request to fetch comments for the video
        const url = `${BASE_URL}/comments/${videoId}?page=${page}&loadedIds=${loadedIds}`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'comments');

        const commentsData = data.data?.comments || data.comments;

        if (!commentsData) {
            throw new ScriptException("Invalid comments response format - missing comments data");
        }

        const comments = commentsData.map(commentData => createPlatformComment(commentData, videoId, data.data?.childrenCounts));

        const hasMore = data.data?.has_more || false;
        const nextToken = hasMore ? JSON.stringify({ page: page + 1, loadedIds: data.data?.loadedIds }) : null;

        return new XNXXCommentPager(comments, hasMore, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get video comments: " + error.message);
    }
}
        /**
 * Fetch comments for a video with pagination support
 * @param {string} videoId - Video ID to get comments for
 * @param {string} continuationToken - Continuation token for pagination
 * @returns {XNXXCommentPager} Pager with comments data
 */
function getVideoComments(videoId, continuationToken) {
    try {
        if (!videoId) {
            throw new ScriptException("Video ID is required for fetching comments");
        }

        // Parse continuation token if available
        let page = 0;
        let loadedIds = "";
        if (continuationToken) {
            try {
                const tokenData = JSON.parse(continuationToken);
                page = tokenData.page || 0;
                loadedIds = tokenData.loadedIds || "";
            } catch (e) {
                // Invalid token, start from page 0
            }
        }

        // Fetch comments using threads API - POST request to fetch comments
        const commentsUrl = `${BASE_URL}/threads/video-comments/get-posts/top/${videoId}/${page}/0?country=US&language=en&version=STRAIGHT`;
        const postData = `load_all=0&loaded_ids=${loadedIds}`;

        const commentsHeaders = {
            ...API_HEADERS,
            'content-type': 'application/x-www-form-urlencoded'
        };

        let data;
        try {
            data = makeApiRequest(commentsUrl, 'POST', commentsHeaders, postData, 'video comments');
        } catch (apiError) {
            // Return empty comments instead of throwing error
            return new XNXXCommentPager([], false, {
                videoId: videoId ? videoId.toString() : "",
                continuationToken: null,
                totalComments: 0
            });
        }

        const postsData = data.data?.posts || data.posts;

        if (!postsData) {
            return new XNXXCommentPager([], false, {
                videoId: videoId ? videoId.toString() : "",
                continuationToken: null,
                totalComments: 0
            });
        }

        // Parse comments
        const comments = [];
        const childrenCounts = postsData.children || {};

        if (postsData.posts && typeof postsData.posts === 'object') {
            for (const [, commentData] of Object.entries(postsData.posts)) {
                const comment = createPlatformComment(commentData, videoId, childrenCounts);
                if (comment) {
                    comments.push(comment);
                }
            }
        }

        // Check if there are more comments
        const totalComments = postsData.nb_posts_total || 0;
        const currentCount = comments.length + (page * CONFIG.COMMENTS_PAGE_SIZE);
        const hasMore = currentCount < totalComments;

        // Create continuation token if there are more comments
        let nextToken = null;
        if (hasMore) {
            const newLoadedIds = postsData.ids ? postsData.ids.join(',') : loadedIds;
            nextToken = JSON.stringify({
                page: page + 1,
                loadedIds: newLoadedIds
            });
        }

        return new XNXXCommentPager(comments, hasMore, {
            videoId: videoId ? videoId.toString() : "",
            continuationToken: nextToken || null,
            totalComments: totalComments || 0
        });

    } catch (error) {
        throw new ScriptException("Failed to get video comments: " + error.message);
    }
}

/**
 * Get replies for a specific comment with pagination support
 * @param {string} commentId - The comment ID to get replies for
 * @param {string} videoId - The video ID containing the comment
 * @param {string} continuationToken - Token for pagination
 * @returns {XNXXCommentPager} Pager with comment replies
 */
function getCommentReplies(commentId, videoId, continuationToken) {
    try {
        if (!commentId) {
            throw new ScriptException("Comment ID is required for replies");
        }

        if (!videoId) {
            throw new ScriptException("Video ID is required for replies");
        }

        // Parse continuation token if available
        let page = 0;
        let loadedIds = "";
        if (continuationToken) {
            try {
                const tokenData = JSON.parse(continuationToken);
                page = tokenData.page || 0;
                loadedIds = tokenData.loadedIds || "";
            } catch (e) {
                // Invalid token, start from page 0
            }
        }

        // Fetch replies for a specific comment
        const repliesUrl = `${BASE_URL}/threads/video-comments/get-posts/top/${videoId}/${commentId}/0?country=US&language=en&version=STRAIGHT`;
        const postData = `load_all=0&loaded_ids=${loadedIds}`;

        const repliesHeaders = {
            ...API_HEADERS,
            'content-type': 'application/x-www-form-urlencoded'
        };

        let data;
        try {
            data = makeApiRequest(repliesUrl, 'POST', repliesHeaders, postData, 'comment replies');
        } catch (apiError) {
            // Return empty replies if error occurs
            if (apiError.message.includes('404') || apiError.message.includes('failed with status')) {
                return new XNXXCommentPager([], false, {
                    commentId: commentId ? commentId.toString() : "",
                    videoId: videoId ? videoId.toString() : "",
                    continuationToken: null,
                    totalReplies: 0
                });
            }
            throw apiError;
        }

        const postsData = data.data?.posts || data.posts;

        if (!postsData) {
            return new XNXXCommentPager([], false, {
                commentId: commentId ? commentId.toString() : "",
                videoId: videoId ? videoId.toString() : "",
                continuationToken: null,
                totalReplies: 0
            });
        }

        // Parse replies
        const replies = [];
        const childrenCounts = postsData.children || {};

        if (postsData.posts && typeof postsData.posts === 'object') {
            for (const [, replyData] of Object.entries(postsData.posts)) {
                const reply = createPlatformComment(replyData, videoId, childrenCounts);
                if (reply) {
                    replies.push(reply);
                }
            }
        }

        // Check if there are more replies
        const totalReplies = postsData.nb_posts_total || 0;
        const currentCount = replies.length + (page * CONFIG.COMMENTS_PAGE_SIZE);
        const hasMore = currentCount < totalReplies && replies.length > 0;

        // Create next continuation token
        let nextToken = null;
        if (hasMore) {
            const newLoadedIds = postsData.ids ? postsData.ids.join(',') : loadedIds;
            nextToken = JSON.stringify({
                page: page + 1,
                loadedIds: newLoadedIds
            });
        }

        return new XNXXCommentPager(replies, hasMore, {
            commentId: commentId ? commentId.toString() : "",
            videoId: videoId ? videoId.toString() : "",
            continuationToken: nextToken || null,
            totalReplies: totalReplies || 0
        });

    } catch (error) {
        throw new ScriptException("Failed to get comment replies: " + error.message);
    }
}

// Pager classes - using proper Grayjay base classes
class XNXXHomeContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        // Ensure results is always an array
        const validResults = Array.isArray(results) ? results : [];
        super(validResults, hasMore, context);
    }

    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

source.searchSuggestions = function(query) {
    if (!query || query.length < 2) {
        return [];
    }

    try {
        // Clean and encode the search query
        const cleanQuery = encodeURIComponent(query.trim());

        // Fetch search suggestions using search-suggest API
        const suggestUrl = `https://www.xvideos.com/search-suggest/${cleanQuery}?country=US&language=en&version=STRAIGHT`;
        const response = http.GET(suggestUrl, {}, false);

        if (!response.isOk) {
            return [];
        }

        let data;
        try {
            data = JSON.parse(response.body);
        } catch (parseError) {
            return [];
        }

        if (!data.result || !data.data) {
            return [];
        }

        const suggestions = [];

        // Add keyword suggestions
        if (data.data.keywords && Array.isArray(data.data.keywords)) {
            data.data.keywords.forEach(keyword => {
                if (keyword.N && suggestions.length < 8) {
                    suggestions.push(keyword.N);
                }
            });
        }

        // Add pornstar suggestions if we have room
        if (data.data.pornstar && Array.isArray(data.data.pornstar) && suggestions.length < 8) {
            data.data.pornstar.forEach(star => {
                if (star.N && suggestions.length < 8) {
                    suggestions.push(star.N);
                }
            });
        }

        return suggestions;

    } catch (error) {
        return [];
    }
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Mixed, Type.Feed.Videos],
        sorts: [Type.Order.Chronological], // API returns results in relevance order
        filters: [] // No additional filters supported by the API
    };
};

/**
 * Search for channels (pornstars and models) using the search-suggest API
 * @param {string} query - Search query for channels
 * @returns {XNXXChannelSearchPager} Pager with channel results
 */
source.searchChannels = function(query) {
    try {
        if (!query || query.trim().length === 0) {
            return new XNXXChannelSearchPager([], false, { query: query });
        }

        // Clean and encode the search query
        const cleanQuery = encodeURIComponent(query.trim());

        // Use search-suggest API to find pornstars and models
        const suggestUrl = `https://www.xvideos.com/search-suggest/${cleanQuery}?country=US&language=en&version=STRAIGHT`;
        const response = http.GET(suggestUrl, {}, false);
        
        if (!response.isOk) {
            return new XNXXChannelSearchPager([], false, { query: query });
        }

        let data;
        try {
            data = JSON.parse(response.body);
        } catch (parseError) {
            return new XNXXChannelSearchPager([], false, { query: query, error: parseError.message });
        }
        if (!data.result || !data.data) {
            return new XNXXChannelSearchPager([], false, { query: query });
        }
        const channels = [];

        // Process pornstar suggestions as channels
        if (data.data.pornstar && Array.isArray(data.data.pornstar)) {
            data.data.pornstar.forEach(star => {
                
                if (star.N && star.F) {
                    // Create a channel object for each pornstar
                    const channel = new PlatformChannel({
                        id: new PlatformID(PLATFORM, star.F.toString(), plugin.config.id),
                        name: star.N,
                        thumbnail: star.P || "", // Use picture if available
                        banner: "",
                        subscribers: 0, // Not available in search results
                        description: `${star.T}: ${star.N}`,
                        url: `xvideos://profile/${star.UID}`, // Use internal URL scheme
                        urlAlternatives: [`${CONFIG.EXTERNAL_URL_BASE}/${star.T}/${star.F.toLowerCase().replace(/\s+/g, '-')}`],
                        links: {
                            "XVideos Profile": `${CONFIG.EXTERNAL_URL_BASE}/${star.T}/${star.F.toLowerCase().replace(/\s+/g, '-')}`
                        }
                    });
                    channels.push(channel);
                }
            });
        }

        // Process model suggestions as channels (if available in the API response)
        if (data.data.channel && Array.isArray(data.data.channel)) {
            
            data.data.channel.forEach(creator => {
                
                if (creator.N) {
                    const channel = new PlatformChannel({
                        id: new PlatformID(PLATFORM, creator.F, plugin.config.id),
                        name: creator.N,
                        thumbnail: creator.P || "",
                        banner: creator.pic || "",
                        subscribers: 0,
                        description: `Model: ${creator.N}`,
                        url: `xvideos://profile/${creator.F}`,
                        urlAlternatives: [`${CONFIG.EXTERNAL_URL_BASE}/profile/${creator.F.toLowerCase().replace(/\s+/g, '-')}`],
                        links: {
                            "XVideos Profile": `${CONFIG.EXTERNAL_URL_BASE}/profile/${creator.F.toLowerCase().replace(/\s+/g, '-')}`
                        }
                    });
                    channels.push(channel);
                }
            });
        }

        return new XNXXChannelSearchPager(channels, false, {
            query: query,
            totalResults: channels.length
        });

    } catch (error) {
        return new XNXXChannelSearchPager([], false, {
            query: query,
            error: error.message
        });
    }
};

/**
 * Resolve username to numeric user ID by fetching the profile page and extracting id_user
 * @param {string} username - Username to resolve
 * @returns {string|null} Numeric user ID or null if not found
 */
function resolveUsernameToId(username) {
    try {
        // Try multiple username variations
        const usernameVariations = [
            username, // Original username
        ];


        for (const usernameVariation of usernameVariations) {
            const profileUrl = `https://www.xvideos.com/channel/${usernameVariation}`;

            const response = http.GET(profileUrl, {}, false);

            if (!response.isOk) {
                continue; // Try next variation
            }

            // Look for id_user in the page content
            const match = response.body.match(/"id_user"\s*:\s*(\d+)/);
            
            if (match && match[1]) {
                return match[1];
            }
        }

        return null; // No ID found in any variation

    } catch (error) {
        return null;
    }
}

/**
 * Get pornstar channel information by searching for the pornstar name
 * @param {string} pornstarName - Name of the pornstar
 * @param {string} originalUrl - Original URL for reference
 * @returns {PlatformChannel} Channel object for the pornstar
 */
async function getPornstarChannel(pornstarName, originalUrl) {
    try {
        // Use search-suggest API to find the pornstar's ID
        const cleanQuery = encodeURIComponent(pornstarName.replace(/-/g, ' '));
        const suggestUrl = `${BASE_URL}/search-suggest/${cleanQuery}?country=US&language=en&version=STRAIGHT`;
        const response = await http.GET(suggestUrl, API_HEADERS, false);

        if (!response.isOk) {
            throw new ScriptException("Failed to search for pornstar information");
        }

        let data;
        try {
            data = JSON.parse(response.body);
        } catch (parseError) {
            throw new ScriptException(`Failed to parse pornstar search response: ${parseError.message}`);
        }

        if (!data.result || !data.data || !data.data.pornstar) {
            throw new ScriptException("Pornstar not found in search results");
        }

        // Find the matching pornstar
        let matchedStar = null;
        const searchName = pornstarName.toLowerCase().replace(/-/g, ' ');

        for (const star of data.data.pornstar) {
            if (star.N && star.N.toLowerCase() === searchName) {
                matchedStar = star;
                break;
            }
        }

        if (!matchedStar && data.data.pornstar.length > 0) {
            // If exact match not found, try the first result
            matchedStar = data.data.pornstar[0];
        }

        if (!matchedStar || !matchedStar.id) {
            throw new ScriptException("Could not find pornstar ID");
        }

        // Now try to get detailed profile information using the ID
        try {
            const profileUrl = `${BASE_URL}/profile-page/${matchedStar.id}?country=US&language=en&version=STRAIGHT`;
            const profileDataResponse = await makeApiRequest(profileUrl, 'GET', API_HEADERS, null, 'pornstar profile');

            // API v6 response structure: { result: true, code: 0, data: { ...profile fields... }, metadata: {...} }
            // Legacy: { result: true, profile: {...} }
            const profileInfo = profileDataResponse.data || profileDataResponse.profile;

            if (profileInfo) {
                // Normalize the profile data to handle both API v6 (camelCase) and legacy (snake_case) field names
                const normalizedProfile = {
                    id_user: profileInfo.idUser || profileInfo.id_user || matchedStar.id,
                    name: profileInfo.name || matchedStar.N,
                    disp_name: profileInfo.displayName || profileInfo.disp_name || matchedStar.N,
                    isModel: profileInfo.isModel,
                    isChannel: profileInfo.isChannel,
                    aboutMe: profileInfo.aboutMe,
                    pictureUrl: profileInfo.pictureUrl || matchedStar.P,
                    nb_views: profileInfo.nbViews || profileInfo.nb_views || 0,
                    nbSubscribers: profileInfo.nbSubscribers || 0,
                    nb_videos: profileDataResponse.metadata?.nbVideos || profileInfo.nb_videos
                };

                // Use the detailed profile data
                return createChannelFromProfile(normalizedProfile, originalUrl, true);
            }
        } catch (profileError) {
            // If detailed profile fails, create basic channel from search data
        }

        // Create basic channel from search data
        const internalUrl = `xvideos://profile/${matchedStar.id}`;
        // Use F field (slug/filename) from API for correct pornstar URL if available
        const pornstarSlug = matchedStar.F || pornstarName;

        // Build proper external URL, avoiding internal URLs
        let externalUrl;
        if (originalUrl && !originalUrl.startsWith('xvideos://')) {
            externalUrl = originalUrl;
        } else {
            externalUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${pornstarSlug}`;
        }

        return new PlatformChannel({
            id: new PlatformID(PLATFORM, matchedStar.id.toString(), plugin.config.id),
            name: matchedStar.N,
            thumbnail: matchedStar.pic || "",
            banner: matchedStar.pic || "",
            subscribers: 0,
            description: `Pornstar: ${matchedStar.N}`,
            url: externalUrl, // Use external URL as primary
            urlAlternatives: [internalUrl], // Internal URL as alternative
            links: {
                "XVideos Profile": externalUrl
            }
        });

    } catch (error) {
        throw new ScriptException(`Failed to get pornstar channel: ${error.message}`);
    }
}

/**
 * Create a PlatformChannel object from profile data
 * @param {Object} profile - Profile data from API
 * @param {string} originalUrl - Original URL for reference
 * @param {boolean} isPornstar - Whether this is a pornstar profile
 * @returns {PlatformChannel} Channel object
 */
function createChannelFromProfile(profile, originalUrl, isPornstar = false) {
    // Calculate total video count from all categories
    let totalVideos = 0;
    if (profile.nb_videos) {
        if (profile.nb_videos.free && profile.nb_videos.free.straight) {
            totalVideos += profile.nb_videos.free.straight;
        }
        if (profile.nb_videos.premium && profile.nb_videos.premium.straight) {
            totalVideos += profile.nb_videos.premium.straight;
        }
    }

    // Clean up description (remove HTML tags)
    let description = profile.aboutMe || "";
    if (description) {
        description = description.replace(REGEX_PATTERNS.parsing.htmlBreaks, '\n').replace(REGEX_PATTERNS.parsing.htmlTags, '');
    }

    // Add channel type prefix
    if (isPornstar) {
        description = `Pornstar: ${profile.disp_name || profile.name}\n\n${description}`;
    } else if (profile.isModel) {
        description = `Model: ${profile.disp_name || profile.name}\n\n${description}`;
    } else if (profile.isChannel) {
        description = `Channel: ${profile.disp_name || profile.name}\n\n${description}`;
    }

    // Add channel statistics to description
    if (totalVideos > 0 || profile.nb_views > 0) {
        description += `\n\n📊 Channel Stats:`;
        if (totalVideos > 0) {
            description += `\n• Total Videos: ${totalVideos.toLocaleString()}`;
            if (profile.nb_videos.free && profile.nb_videos.free.straight) {
                description += ` (${profile.nb_videos.free.straight} free`;
                if (profile.nb_videos.premium && profile.nb_videos.premium.straight) {
                    description += `, ${profile.nb_videos.premium.straight} premium`;
                }
                description += `)`;
            }
        }
        if (profile.nb_views > 0) {
            description += `\n• Total Views: ${profile.nb_views.toLocaleString()}`;
        }
        if (profile.nbSubscribers > 0) {
            description += `\n• Subscribers: ${profile.nbSubscribers.toLocaleString()}`;
        }
    }

    // Add channel type information
    if (profile.isModel || profile.isChannel) {
        description += `\n\n🏷️ Channel Type: `;
        if (profile.isModel) description += `Model `;
        if (profile.isChannel) description += `Channel`;
    }

    // Create URLs
    const internalUrl = `xvideos://profile/${profile.id_user}`;
    let externalUrl;

    // Build proper external URL based on channel type
    if (originalUrl && !originalUrl.startsWith('xvideos://')) {
        // Use provided external URL if valid
        externalUrl = originalUrl;
    } else {
        // Construct external URL based on channel type
        // Check API profile flags first (isModel, isChannel), then fall back to isPornstar parameter
        if (profile.isModel) {
            // Models use /models/{name} format
            const modelName = profile.name || "";
            externalUrl = `${CONFIG.EXTERNAL_URL_BASE}/models/${modelName}`;
        } else if (profile.isChannel) {
            // Channels use /channels/{name} format
            const channelName = profile.name || "";
            externalUrl = `${CONFIG.EXTERNAL_URL_BASE}/channels/${channelName}`;
        } else if (isPornstar) {
            // Pornstars use /pornstar/{slug} format - use 'name' field which contains the slug
            const pornstarSlug = profile.name || (profile.disp_name || "").toLowerCase().replace(/\s+/g, '-');
            externalUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${pornstarSlug}`;
        } else {
            // Fallback: default to channels format
            const profileName = profile.name || "";
            externalUrl = `${CONFIG.EXTERNAL_URL_BASE}/channels/${profileName}`;
        }
    }

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, profile.id_user?.toString() || "", plugin.config.id),
        name: profile.disp_name || profile.name || "Unknown Channel",
        thumbnail: profile.pictureUrl || "",
        banner: profile.picture

        // Fetch video details in bulk
const videos = fetchVideoDetailsBulk(pageIds);

// Check if there are more pages based on API response or result count
// If we got fewer results than expected, assume this is the last page
const hasMore = metadata?.hasMorePages !== false &&
               pageIds.length >= CONFIG.DEFAULT_PAGE_SIZE &&
               (totalResults ? ((page + 1) * CONFIG.DEFAULT_PAGE_SIZE) < totalResults : true);

const nextToken = hasMore ? (page + 1).toString() : null;

return new XNXXSearchContentPager(videos, hasMore, {
    query: query,
    type: type,
    order: order,
    filters: filters,
    continuationToken: nextToken,
    totalResults: totalResults,
    currentPage: page + 1
});

} catch (error) {
    throw new ScriptException("Failed to search: " + error.message);
}
};

class XNXXSearchContentPager extends ContentPager {
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

/**
 * Search for playlists based on query terms
 * Uses both home categories and search-based playlists for comprehensive results
 * @param {string} query - Search query
 * @param {string} type - Search type (optional)
 * @param {string} order - Sort order (optional)
 * @param {Object} filters - Search filters (optional)
 * @param {string} continuationToken - Pagination token (optional)
 * @returns {XNXXPlaylistSearchPager} Pager with playlist results
 */
source.searchPlaylists = function (query, type, order, filters, continuationToken) {
    try {
        if (!query || query.trim().length === 0) {
            return new XNXXPlaylistSearchPager([], false, {
                query: query,
                type: type,
                order: order,
                filters: filters,
                continuationToken: null,
                totalResults: 0
            });
        }

        // Clean the search query for matching
        const cleanQuery = query.trim().toLowerCase();

        // Determine page number from continuation token
        const page = continuationToken ? (parseInt(continuationToken) || 0) : 0;

        // Get playlists from multiple sources
        const allPlaylists = [];

        // 1. Get matching categories from home-categories endpoint
        const categoryPlaylists = searchCategoryPlaylists(cleanQuery);
        allPlaylists.push(...categoryPlaylists);

        // 2. Get search-based playlists (only on first page to avoid duplicates)
        if (page === 0) {
            const searchPlaylists = createSearchBasedPlaylists(query);
            allPlaylists.push(...searchPlaylists);
        }

        // Remove duplicates based on playlist name/URL
        const uniquePlaylists = removeDuplicatePlaylists(allPlaylists);

        // Implement pagination on the combined results
        const startIndex = page * CONFIG.DEFAULT_PAGE_SIZE;
        const endIndex = Math.min(startIndex + CONFIG.DEFAULT_PAGE_SIZE, uniquePlaylists.length);
        const pageResults = uniquePlaylists.slice(startIndex, endIndex);

        // Check if there are more pages
        const hasMore = endIndex < uniquePlaylists.length;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new XNXXPlaylistSearchPager(pageResults, hasMore, {
            query: query,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken,
            totalResults: uniquePlaylists.length,
            currentPage: page + 1
        });

    } catch (error) {
        return new XNXXPlaylistSearchPager([], false, {
            query: query,
            type: type,
            order: order,
            filters: filters,
            continuationToken: null,
            totalResults: 0,
            error: error.message
        });
    }
};

/**
 * Search for playlists in the home categories that match the query
 * @param {string} query - Search query (lowercase)
 * @returns {Array} Array of matching PlatformPlaylist objects
 */
function searchCategoryPlaylists(query) {
    try {
        // Fetch categories from categories endpoint
        const url = `${BASE_URL}/categories`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'category search');

        // API v6 response structure
        const categories = data.data?.categories || data.categories;

        if (!categories || !Array.isArray(categories)) {
            return [];
        }

        const matchingPlaylists = [];

        // Filter categories that match the search query (XVideos format)
        categories.forEach(category => {
            if (category.name && category.name.trim()) {
                const categoryName = category.name.toLowerCase();

                // Check if category matches the search query
                if (categoryMatchesQuery(categoryName, query)) {
                    try {
                        const playlist = new PlatformPlaylist({
                            id: new PlatformID(PLATFORM, category.id?.toString() || category.name, plugin.config.id),
                            name: category.name,
                            thumbnail: category.thumb_medium || category.thumb_small || "",
                            videoCount: category.nb_videos || 0,
                            url: `xvideos://category/${category.id || category.name}`,
                            author: new PlatformAuthorLink(
                                new PlatformID(PLATFORM, "xvideos", plugin.config.id),
                                "XVideos",
                                CONFIG.EXTERNAL_URL_BASE,
                                ""
                            )
                        });

                        if (playlist && playlist.name && playlist.url) {
                            matchingPlaylists.push(playlist);
                        }
                    } catch (playlistError) {
                        // Skip invalid playlists but continue processing
                        log(`Error creating category playlist: ${playlistError.message}`);
                    }
                }
            }
        });

        return matchingPlaylists;

    } catch (error) {
        log(`Error searching category playlists: ${error.message}`);
        return [];
    }
}

/**
 * Check if a category name matches the search query
 * @param {string} categoryName - Category name (lowercase)
 * @param {string} query - Search query (lowercase)
 * @returns {boolean} True if category matches query
 */
function categoryMatchesQuery(categoryName, query) {
    // Direct match
    if (categoryName.includes(query)) {
        return true;
    }

    // Split query into words and check if all words are found
    const queryWords = query.split(/\s+/).filter(word => word.length > 1);
    if (queryWords.length > 1) {
        return queryWords.every(word => categoryName.includes(word));
    }

    // Check for partial matches with common variations
    const variations = [
        query + 's', // plural
        query.slice(0, -1), // remove last character
        query + 'ing', // gerund
        query.replace(/y$/, 'ies'), // y to ies
    ];

    return variations.some(variation => categoryName.includes(variation));
}

/**
 * Create search-based playlists for the query
 * @param {string} originalQuery - The original search query
 * @returns {Array} Array of PlatformPlaylist objects
 */
function createSearchBasedPlaylists(originalQuery) {
    try {
        // Create a main playlist for the exact search query
        const mainPlaylist = createSearchQueryPlaylist(originalQuery, false);
        const playlists = mainPlaylist ? [mainPlaylist] : [];

        // Create additional playlists based on related terms
        const relatedTerms = generateRelatedSearchTerms(originalQuery);

        // Limit the number of additional playlists
        const maxAdditionalPlaylists = Math.min(relatedTerms.length, 3);

        for (let i = 0; i < maxAdditionalPlaylists; i++) {
            const term = relatedTerms[i];
            const relatedPlaylist = createSearchQueryPlaylist(term, true);
            if (relatedPlaylist) {
                playlists.push(relatedPlaylist);
            }
        }

        return playlists;

    } catch (error) {
        log(`Error creating search-based playlists: ${error.message}`);
        return [];
    }
}

/**
 * Remove duplicate playlists based on name and URL
 * @param {Array} playlists - Array of PlatformPlaylist objects
 * @returns {Array} Array of unique PlatformPlaylist objects
 */
function removeDuplicatePlaylists(playlists) {
    const seen = new Set();
    const uniquePlaylists = [];

    playlists.forEach(playlist => {
        if (playlist && playlist.name && playlist.url) {
            // Create a unique key based on name and URL
            const key = `${playlist.name.toLowerCase()}|${playlist.url}`;

            if (!seen.has(key)) {
                seen.add(key);
                uniquePlaylists.push(playlist);
            }
        }
    });

    return uniquePlaylists;
}

/**
 * Create a single playlist based on a search query (without requiring search data)
 * @param {string} searchTerm - The search term for the playlist
 * @param {boolean} isRelated - Whether this is a related term playlist
 * @returns {PlatformPlaylist|null} Playlist object or null if creation fails
 */
function createSearchQueryPlaylist(searchTerm, isRelated = false) {
    try {
        // Create internal URL for the playlist using the search term
        const playlistUrl = `xvideos://playlist/${searchTerm}`;

        // For search-based playlists, we don't fetch thumbnails immediately for performance
        // The thumbnail will be loaded when the

        // Determine if we need to resolve username to numeric ID
let actualProfileId = profileId;

// If profileId is not purely numeric, try to resolve it as a username
const resolvedId = resolveUsernameToId(profileId);
if (resolvedId) {
    actualProfileId = resolvedId;
}

// Fetch profile information using profile-page API
const profileUrl = `${BASE_URL}/profile-page/${actualProfileId}?country=US&language=en&version=STRAIGHT`;

try {
    const data = makeApiRequest(profileUrl, 'GET', API_HEADERS, null, 'channel info');
    const profileData = data.data || data.profile;

    if (!profileData) {
        throw new ScriptException("Invalid channel response format - missing profile object");
    }

    // Normalize the profile data to handle both API v6 (camelCase) and legacy (snake_case) field names
    const normalizedProfile = {
        id_user: profileData.idUser || profileData.id_user,
        name: profileData.name,
        disp_name: profileData.displayName || profileData.disp_name,
        isModel: profileData.isModel,
        isChannel: profileData.isChannel,
        aboutMe: profileData.aboutMe,
        pictureUrl: profileData.pictureUrl,
        nb_views: profileData.nbViews || profileData.nb_views || 0,
        nbSubscribers: profileData.nbSubscribers || 0,
        nb_videos: data.metadata?.nbVideos || profileData.nb_videos
    };

    return createChannelFromProfile(normalizedProfile, url, false);

} catch (apiError) {
    if (actualProfileId !== profileId) {
        const fallbackUrl = `${BASE_URL}/profile-page/${profileId}?country=US&language=en&version=STRAIGHT`;
        try {
            const fallbackData = makeApiRequest(fallbackUrl, 'GET', API_HEADERS, null, 'channel info fallback');
            const fallbackProfileData = fallbackData.data || fallbackData.profile;
            if (fallbackProfileData) {
                const normalizedFallbackProfile = {
                    id_user: fallbackProfileData.idUser || fallbackProfileData.id_user,
                    name: fallbackProfileData.name,
                    disp_name: fallbackProfileData.displayName || fallbackProfileData.disp_name,
                    isModel: fallbackProfileData.isModel,
                    isChannel: fallbackProfileData.isChannel,
                    aboutMe: fallbackProfileData.aboutMe,
                    pictureUrl: fallbackProfileData.pictureUrl,
                    nb_views: fallbackProfileData.nbViews || fallbackProfileData.nb_views || 0,
                    nbSubscribers: fallbackProfileData.nbSubscribers || 0,
                    nb_videos: fallbackData.metadata?.nbVideos || fallbackProfileData.nb_videos
                };
                return createChannelFromProfile(normalizedFallbackProfile, url, false);
            }
        } catch (fallbackError) {
            // Ignore fallback error, throw original
        }
    }
    // Re-throw the original error
    throw apiError;
}

source.getChannelCapabilities = function () {
    return new ResultCapabilities(
        [Type.Feed.Mixed],
        [Type.Order.Chronological],
        []
    );
};

source.getChannelContents = function (url, type, order, filters, continuationToken) {
    try {
        const profileId = extractProfileId(url);
        let actualProfileId = profileId;

        if (!/^\d+$/.test(profileId) && !profileId.startsWith('pornstar:')) {
            try {
                const searchUrl = `${BASE_URL}/search/${encodeURIComponent(profileId)}/0?country=US&language=en&version=STRAIGHT`;
                const searchData = makeApiRequest(searchUrl, 'GET', API_HEADERS, null, 'profile search');
                const videoIds = searchData.data?.ids || searchData.ids;

                if (videoIds && videoIds.length > 0) {
                    const videoInfoUrl = `${BASE_URL}/videos-info?ids=${videoIds[0]}`;
                    const videoInfo = makeApiRequest(videoInfoUrl, 'GET', API_HEADERS, null, 'video info for profile');
                    const firstVideo = videoInfo.data?.videos?.[videoIds[0]];
                    if (firstVideo && firstVideo.id_user) {
                        actualProfileId = firstVideo.id_user.toString();
                    }
                }
            } catch (lookupError) {
                log(`Failed to lookup profile ID for username ${profileId}: ${lookupError.message}`);
            }
        }

        let sortOrder = 'new';
        const page = continuationToken ? (parseInt(continuationToken) || 0) : 0;

        const channelUrl = `${BASE_URL}/profile-page/${actualProfileId}/videos/${sortOrder}/${page}?country=US&language=en&version=STRAIGHT`;
        const data = makeApiRequest(channelUrl, 'GET', API_HEADERS, null, 'channel contents');
        const videoIds = data.data?.ids || data.ids || data.videos;

        if (!videoIds || !Array.isArray(videoIds)) {
            throw new ScriptException("Invalid channel contents response format - missing or invalid ids/videos array");
        }

        const videoResults = fetchVideoDetailsBulk(videoIds);
        const hasMore = !data.metadata?.isLastPage && videoIds.length > 0;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new XNXXChannelContentPager(videoResults, hasMore, {
            url: url,
            profileId: actualProfileId,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel contents: " + error.message);
    }
};

source.isPlaylistUrl = function (url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    return REGEX_PATTERNS.urls.playlistInternal.test(url) || REGEX_PATTERNS.urls.categoryInternal.test(url);
};

source.getPlaylist = function (url) {
    try {
        let searchTerm;
        const categoryMatch = url.match(REGEX_PATTERNS.urls.categoryInternal);
        const playlistMatch = url.match(REGEX_PATTERNS.urls.playlistInternal);

        if (categoryMatch && categoryMatch[1]) {
            searchTerm = categoryMatch[1];
        } else if (playlistMatch && playlistMatch[1]) {
            searchTerm = playlistMatch[1];
        } else {
            throw new ScriptException("Invalid playlist URL format");
        }

        const formattedSearchTerm = searchTerm.replace(/\s+/g, '+');
        const searchUrl = `${BASE_URL}/search/${formattedSearchTerm}?country=US&language=en&version=STRAIGHT`;
        const data = makeApiRequest(searchUrl, 'GET', API_HEADERS, null, 'playlist search');
        const ids = data.data?.ids || data.ids;

        if (!ids || !Array.isArray(ids)) {
            throw new ScriptException("Invalid playlist search response format - missing or invalid ids array");
        }

        const videos = fetchVideoDetailsBulk(ids);
        const totalCount = data.data?.nb_results_total || data.nb_results_total || videos.length;

        const playlistDetailsObj = {
            id: new PlatformID(PLATFORM, searchTerm, plugin.config.id),
            name: searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1),
            thumbnails: videos.length > 0 ? videos[0].thumbnails : new Thumbnails([]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, "xvideos", localConfig.id),
                "XVideos",
                CONFIG.EXTERNAL_URL_BASE,
                ""
            ),
            datetime: 0,
            url: url,
            videoCount: totalCount,
            thumbnail: videos.length > 0 ? videos[0].thumbnails.sources[0]?.url || "" : "",
            contents: source.search(formattedSearchTerm)
        };

        const playlistDetails = new PlatformPlaylistDetails(playlistDetailsObj);
        return playlistDetails;

    } catch (error) {
        throw new ScriptException("Failed to get playlist details: " + error.message);
    }
};

source.isContentDetailsUrl = function (url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const patterns = [
        REGEX_PATTERNS.urls.videoStandard,
        REGEX_PATTERNS.urls.videoAlternative,
        REGEX_PATTERNS.urls.videoMobile,
        REGEX_PATTERNS.urls.videoNumeric,
        REGEX_PATTERNS.urls.videoNumericWithSuffix
    ];

    return patterns.some(pattern => pattern.test(url));
};

source.getContentDetails = function (url) {
    try {
        const videoId = extractVideoId(url);
        const detailsUrl = `${BASE_URL}/video-page/${videoId}?country=US&language=en&version=STRAIGHT`;

        try {
            const data = makeApiRequest(detailsUrl, 'GET', API_HEADERS, null, 'video details');
            const videoData = data.data?.video || data.video;

            if (videoData) {
                if (videoData.is_live) {
                    throw new ScriptException("Live streams are not currently supported");
                }
                return createVideoDetailsFromApiData(data, url);
            } else {
                throw new ScriptException("Video not found in API response");
            }

        } catch (apiError) {
            return tryWebsiteFallback(url);
        }

    } catch (error) {
        throw new ScriptException("Failed to get video details: " + error.message);
    }
};

function tryWebsiteFallback(url) {
    try {
        const websiteHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64;

class XNXXChannelContentPager extends ContentPager {
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

class XNXXChannelSearchPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        // Channel search doesn't support pagination since it uses search-suggest API
        // which returns all results at once
        return new XNXXChannelSearchPager([], false, this.context);
    }

}

class XNXXCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        try {
            // Check if this is for replies or comments
            if (this.context.commentId) {
                // This is a replies pager - need both commentId and videoId
                if (!this.context.videoId) {
                    throw new ScriptException("Invalid replies pager context - missing videoId");
                }
                return getCommentReplies(this.context.commentId, this.context.videoId, this.context.continuationToken);
            } else if (this.context.videoId) {
                // This is a comments pager
                return getVideoComments(this.context.videoId, this.context.continuationToken);
            } else {
                throw new ScriptException("Invalid pager context - missing videoId or commentId");
            }
        } catch (error) {
            // Return empty pager instead of throwing to prevent UI crashes
            // Ensure all context values are safe for serialization
            const safeContext = {
                videoId: this.context.videoId ? this.context.videoId.toString() : "",
                commentId: this.context.commentId ? this.context.commentId.toString() : "",
                continuationToken: null,
                error: error?.message ? error.message.toString() : "Unknown error"
            };

            return new XNXXCommentPager([], false, safeContext);
        }
    }
}

class XNXXRecommendationsPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        // Recommendations are typically static, no pagination needed
        return new XNXXRecommendationsPager([], false, {});
    }
}

class XNXXPlaylistSearchPager extends PlaylistPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.searchPlaylists(
            this.context.query,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

log("loaded");

