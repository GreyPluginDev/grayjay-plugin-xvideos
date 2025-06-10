const BASE_URL = "https://www.xv-app1.com/app-api/4";
const PLATFORM = "XVIDEOS";

let localConfig = {};

/**
 * Configuration constants for better maintainability
 */
const CONFIG = {
    // Pagination settings
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50,

    // Video quality settings
    VIDEO_QUALITIES: {
        LOW: { name: "250p", width: 320, height: 240 },
        MEDIUM: { name: "360p", width: 640, height: 360 }
    },

    // URL schemes
    INTERNAL_URL_SCHEME: "xvideos://profile/",
    EXTERNAL_URL_BASE: "https://www.xvideos.com"
};

/**
 * Required headers for API authentication
 * Based on exact headers from working curl requests
 * Note: accept-encoding is excluded to avoid gzip issues
 */
const API_HEADERS = {
    ':authority': 'www.xv-app1.com',
    ':method': 'GET',
    ':path': '/app-api/4/home/0',
    ':scheme': 'https',
    // 'accept-encoding': 'gzip',
    'user-agent': '(Linux; Android 15; sdk_gphone64_x86_64 Build/AE3A.240806.005) XXXAndroidApp/1.2',
    'x-app-android-version': '15',
    'x-app-channel': 'BETA',
    'x-app-country': 'US',
    'x-app-language': 'en',
    'x-app-main-cat': 'straight',
    'x-app-mobile-id': 'df36aee9-13c2-4eec-b59e-7de3ef564317',
    'x-app-version': '1.2'
};

/**
 * Regular expressions organized by functionality
 * Centralized for better maintainability and reusability
 */
const REGEX_PATTERNS = {
    // URL Detection Patterns
    urls: {
        // Video URL patterns
        videoStandard: /^https?:\/\/(?:www\.)?xvideos\.com\/video.([a-zA-Z0-9]+)\/.*$/,
        videoAlternative: /^https?:\/\/(?:www\.)?xvideos\.com\/video\/([a-zA-Z0-9]+)\/.*$/,
        videoMobile: /^https?:\/\/(?:m\.)?xvideos\.com\/video.([a-zA-Z0-9]+)\/.*$/,
        videoNumeric: /^https?:\/\/(?:www\.)?xvideos\.com\/.*video.*([0-9]+).*$/,
        videoNumericWithSuffix: /^https?:\/\/(?:www\.)?xvideos\.com\/video.([0-9]+[a-z])\/.*$/,

        // Channel/Profile URL patterns
        channelStandard: /^https?:\/\/(?:www\.)?xvideos\.com\/profile\/[^\/\?]+/,
        channelMobile: /^https?:\/\/(?:m\.)?xvideos\.com\/profile\/[^\/\?]+/,
        channelInternal: /^xvideos:\/\/profile\/([0-9]+)$/,

        // Pornstar URL patterns
        pornstarStandard: /^https?:\/\/(?:www\.)?xvideos\.com\/pornstar\/[^\/\?]+/,
        pornstarMobile: /^https?:\/\/(?:m\.)?xvideos\.com\/pornstar\/[^\/\?]+/,

        // Playlist URL patterns
        playlistInternal: /^xvideos:\/\/playlist\/(.+)$/
    },

    // ID Extraction Patterns
    extraction: {
        // Video ID extraction
        videoIdStandard: /\/video.([a-zA-Z0-9]+)\//,
        videoIdAlternative: /\/video\/([a-zA-Z0-9]+)\//,
        videoIdNumeric: /video.*?([0-9]+)/,
        videoIdNumericWithSuffix: /\/video.([0-9]+[a-z])\//,

        // Profile ID extraction
        profileIdNumeric: /\/profile\/([0-9]+)/,
        profileIdUsername: /\/profile\/([^\/\?]+)/,
        profileIdGeneral: /profile.*?([0-9]+)/,

        // Pornstar name extraction
        pornstarName: /\/pornstar\/([^\/\?]+)/
    },

    // Content Parsing Patterns
    parsing: {
        // Duration parsing (e.g., "6min", "27min", "1h 30min")
        duration: /(\d+)h|(\d+)min|(\d+)s/g,

        // HTML tag removal
        htmlTags: /<[^>]*>/g,
        htmlBreaks: /<br\s*\/?>/gi
    }
};

/**
 * Utility functions for better code reusability and maintenance
 */

/**
 * Make an API request with standardized error handling and logging
 * @param {string} url - The API endpoint URL
 * @param {string} method - HTTP method (GET, POST)
 * @param {Object} headers - Request headers (defaults to API_HEADERS)
 * @param {string} body - Request body for POST requests
 * @param {string} context - Context for logging (e.g., "home content", "video details")
 * @returns {Object} Parsed JSON response
 */
function makeApiRequest(url, method = 'GET', headers = API_HEADERS, body = null, context = 'API request') {
    try {
        let response;
        if (method === 'POST') {
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

        // For comments API, the result field might not be present, so be more flexible
        if (context.includes('comment') || context.includes('replies')) {
            return data;
        }

        if (!data.result) {
            throw new ScriptException(`Invalid ${context} response format - missing result field`);
        }

        return data;

    } catch (error) {
        throw new ScriptException(`Failed to fetch ${context}: ${error.message}`);
    }
}

/**
 * Extract video ID from URL using multiple patterns
 * @param {string} url - Video URL to extract ID from
 * @returns {string} Extracted video ID
 */
function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    const patterns = [
        REGEX_PATTERNS.extraction.videoIdStandard,
        REGEX_PATTERNS.extraction.videoIdAlternative,
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
 * Extract profile ID from URL using multiple patterns
 * @param {string} url - Profile URL to extract ID from
 * @returns {string} Extracted profile ID
 */
function extractProfileId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for profile ID extraction");
    }

    // Check for internal URL scheme first (preferred)
    const internalMatch = url.match(REGEX_PATTERNS.urls.channelInternal);
    if (internalMatch && internalMatch[1]) {
        return internalMatch[1];
    }

    // Check for pornstar URLs - these need special handling
    const pornstarMatch = url.match(REGEX_PATTERNS.extraction.pornstarName);
    if (pornstarMatch && pornstarMatch[1]) {
        // For pornstar URLs, we need to search for the pornstar to get their ID
        // Return the name for now, and handle the ID lookup in getChannel
        return `pornstar:${pornstarMatch[1]}`;
    }

    // Try external URL patterns for regular profiles
    const patterns = [
        REGEX_PATTERNS.extraction.profileIdNumeric,
        REGEX_PATTERNS.extraction.profileIdUsername,
        REGEX_PATTERNS.extraction.profileIdGeneral
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            const profileId = match[1];
            return profileId;
        }
    }

    throw new ScriptException(`Could not extract profile ID from URL: ${url}`);
}

/**
 * Create video sources from video data
 * @param {Object} videoData - Video data from API
 * @returns {Array} Array of video sources
 */
function createVideoSources(videoData) {
    const videoSources = [];

    // Add MP4 sources if available
    if (videoData.url_mp4_250p) {
        videoSources.push(new VideoUrlSource({
            url: videoData.url_mp4_250p,
            name: CONFIG.VIDEO_QUALITIES.LOW.name,
            container: "mp4",
            width: CONFIG.VIDEO_QUALITIES.LOW.width,
            height: CONFIG.VIDEO_QUALITIES.LOW.height
        }));
    }

    if (videoData.url_mp4_360p) {
        videoSources.push(new VideoUrlSource({
            url: videoData.url_mp4_360p,
            name: CONFIG.VIDEO_QUALITIES.MEDIUM.name,
            container: "mp4",
            width: CONFIG.VIDEO_QUALITIES.MEDIUM.width,
            height: CONFIG.VIDEO_QUALITIES.MEDIUM.height
        }));
    }

    // Add HLS source if available and allowed
    if (videoData.url_hls && videoData.allow_hls) {
        videoSources.push(new HLSSource({
            url: videoData.url_hls,
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
    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, videoData.id_user?.toString() || "", plugin.config.id),
        videoData.profile_name_display || videoData.profile_name || "Unknown",
        `${CONFIG.INTERNAL_URL_SCHEME}${videoData.id_user}`,
        videoData.thumb_small || ""
    );
}

/**
 * Create video rating from XNXX rating data
 * @param {Object} videoData - Video data from API
 * @returns {RatingLikesDislikes} Rating object with likes and dislikes
 */
function createVideoRating(videoData) {
    // Extract like/dislike counts from XNXX API data
    const likeCount = parseInt(videoData.nb_good);
    const dislikeCount = parseInt(videoData.nb_bad);

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

    // Add basic stats (rating is now handled separately by Grayjay)
    description += `\n\nViews: ${videoData.views?.toLocaleString() || 'Unknown'}`;
    description += `\nDuration: ${videoData.duration || 'Unknown'}`;
    description += `\nComments: ${videoData.nb_comments || 0}`;

    // Add rating percentage for reference (actual like/dislike counts are in the rating object)
    if (videoData.vote) {
        description += `\nRating: ${videoData.vote}%`;
    }

    return description;
}

/**
 * Create video details from API data
 * @param {Object} data - API response data
 * @param {string} originalUrl - Original video URL
 * @returns {PlatformVideoDetails} Video details object
 */
function createVideoDetailsFromApiData(data, originalUrl) {
    const videoData = data.video;

    // Create video sources, thumbnails, and author using utility functions
    const videoSources = createVideoSources(videoData);
    const thumbnails = createThumbnails(videoData);
    const author = createPlatformAuthor(videoData);
    const description = buildVideoDescription(videoData);

    // Create rating from like/dislike data
    const rating = createVideoRating(videoData);

    // Create detailed video object
    const videoDetails = new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, videoData.id?.toString() || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: thumbnails,
        author: author,
        datetime: videoData.upload_time ? videoData.upload_time : 0,
        duration: parseDuration(videoData.duration),
        viewCount: videoData.views || 0,
        url: `${CONFIG.EXTERNAL_URL_BASE}/video.${videoData.id}/`,
        sharedUrl: videoData.url ? `${CONFIG.EXTERNAL_URL_BASE}${videoData.url}` : originalUrl,
        isLive: false,
        description: description,
        video: new VideoSourceDescriptor(videoSources),
        live: null,
        subtitles: [],
        rating: rating
    });

    // Add content recommendations if available
    if (data.relateds && Array.isArray(data.relateds) && data.relateds.length > 0) {
        videoDetails.getContentRecommendations = function() {
            return getContentRecommendations(data.relateds);
        };
    }

    // Add comment count if available
    if (videoData.comments_enabled && videoData.nb_comments > 0) {
        videoDetails.commentCount = videoData.nb_comments;
    }

    // Add comments function
    videoDetails.getComments = function(continuationToken) {
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
 * @returns {XNXXHomeContentPager} Pager with home content
 */
source.getHome = function(continuationToken) {
    try {

        let startIndex;
           
        // First page: return playlists (categories)
        if (!continuationToken) {
            startIndex =  0;
        }
        else {
            const tokenData = JSON.parse(continuationToken);
            startIndex = tokenData.videoStartIndex || 0;
        }

        // Subsequent pages: return videos
        const url = `${BASE_URL}/home?country=US&language=en&version=STRAIGHT`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'home content');

        if (!data.ids || !Array.isArray(data.ids)) {
            throw new ScriptException("Invalid home response format - missing or invalid ids array");
        }

        // Parse continuation token to get page info
        
        const endIndex = Math.min(startIndex + CONFIG.DEFAULT_PAGE_SIZE, data.ids.length);
        const pageIds = data.ids.slice(startIndex, endIndex);

        if (pageIds.length === 0) {
            return new XNXXHomeContentPager([], false, { continuationToken: null });
        }

        // Fetch video details in bulk
        const videos = fetchVideoDetailsBulk(pageIds);

        const hasMore = endIndex < data.ids.length;
        const nextToken = hasMore ? JSON.stringify({ videoStartIndex: endIndex }) : null;

        return new XNXXHomeContentPager(videos, hasMore, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get home content: " + error.message);
    }
};

/**
 * Get home playlists (categories) from the home-categories endpoint
 * @returns {XNXXHomeContentPager} Pager with playlist content
 */
function getHomePlaylists() {
    try {
        const url = `${BASE_URL}/home-categories?country=US&language=en&version=STRAIGHT`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'home categories');

        if (!data.categories || !Array.isArray(data.categories)) {
            throw new ScriptException("Invalid home categories response format - missing or invalid categories array");
        }

        const playlists = [];

        // Convert categories to playlists
        data.categories.forEach(category => {
            if (category.t && category.t.trim() && !category.no_rotate) { // Skip external links and invalid categories
                try {
                    const playlist = createPlatformPlaylist(category);
                    if (playlist && playlist.name && playlist.url) {
                        playlists.push(playlist);
                    }
                } catch (playlistError) {
                    // Skip invalid playlists but continue processing
                }
            }
        });

        // Ensure we have a valid array (even if empty)
        const validPlaylists = Array.isArray(playlists) ? playlists : [];

        // Create continuation token for videos on next page
        const nextToken = JSON.stringify({ videoStartIndex: 0 });

        return new  XNXXHomeContentPager(validPlaylists, true, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get home playlists: " + error.message);
    }
}

/**
 * Create a PlatformPlaylist from category data
 * @param {Object} category - Category data from API
 * @returns {PlatformPlaylist} Playlist object
 */
function createPlatformPlaylist(category) {
    try {
        // Decode HTML entities in category name
        const categoryName = category?.t || "Unknown Category";
        const decoded = categoryName.toLowerCase().replace(/&#(\d+);/g, (_, dec) => {
            return String.fromCharCode(dec);
        });

        // Extract search term from category URL or use decoded name
        let searchTerm = decoded;
        if (category.u) {
            // Extract search term from URL like "/search/big+dick?top&id=28895395"
            const urlMatch = category.u.match(/\/search\/([^?]+)/);
            if (urlMatch && urlMatch[1]) {
                searchTerm = decodeURIComponent(urlMatch[1].replace(/\+/g, ' '));
            }
        }

        // Create internal URL for the playlist using the search term
        const playlistUrl = `xvideos://playlist/${searchTerm}`;

        // Use category thumbnail or a default one
        const thumbnail = category.i || "";

        // Parse video count
        let videoCount = -1;
        if (category.n && typeof category.n === 'string') {
            const numStr = category.n.replace(/,/g, '');
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
                new PlatformID(PLATFORM, "xvideos", plugin.config.id),
                "XVideos",
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

        if (!data.videos) {
            throw new ScriptException("Invalid video details response format - missing videos object");
        }

        const videos = [];
        for (const videoId of videoIds) {
            const videoData = data.videos[videoId];
            if (videoData && videoData.type !== 'deleted') {
                videos.push(createPlatformVideo(videoData));
            }
        }

        return videos;

    } catch (error) {
        return [];
    }
}

function createPlatformVideo(videoData) {
    const thumbnails = createThumbnails(videoData);
    const author = createPlatformAuthor(videoData);
    const rating = createVideoRating(videoData);
    const duration = parseDuration(videoData.duration);

    return new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id?.toString() || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: thumbnails,
        author: author,
        datetime: videoData.upload_time ? videoData.upload_time: 0,
        duration,
        viewCount: videoData.views || 0,
        url: `${CONFIG.EXTERNAL_URL_BASE}/video.${videoData.id}/`,
        isLive: false,
        rating: rating
    });
}

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

function createPlatformComment(commentData, videoId) {
    try {
        if (!commentData || !commentData.id) {
            return null;
        }

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

        // Parse date - handle XNXX specific date formats
        // Grayjay expects dates in SECONDS since Unix epoch, not milliseconds
        let date = 0;
        const currentTimeSeconds = Math.round(Date.now() / 1000);

        // Try different date field names and formats
        const dateValue = commentData.date || commentData.timestamp || commentData.created_at || commentData.time;

        if (dateValue) {
            try {
                if (typeof dateValue === 'number') {
                    // Check if it's a Unix timestamp in seconds or milliseconds
                    if (dateValue > 1000000000 && dateValue < 10000000000) {
                        // Unix timestamp in seconds (between 2001 and 2286) - use as is
                        date = dateValue;
                    } else if (dateValue > 1000000000000) {
                        // Unix timestamp in milliseconds - convert to seconds
                        date = Math.round(dateValue / 1000);
                    } else {
                        // Might be a relative timestamp or invalid, use current time
                        date = currentTimeSeconds;
                    }
                } else if (typeof dateValue === 'string') {
                    // Try parsing as ISO string first
                    const parsedDate = new Date(dateValue);
                    if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > 0) {
                        // Convert milliseconds to seconds
                        date = Math.round(parsedDate.getTime() / 1000);
                    } else {
                        // Try parsing as Unix timestamp string
                        const timestamp = parseInt(dateValue);
                        if (!isNaN(timestamp) && timestamp > 1000000000 && timestamp < 10000000000) {
                            // Unix timestamp in seconds - use as is
                            date = timestamp;
                        } else if (!isNaN(timestamp) && timestamp > 1000000000000) {
                            // Unix timestamp in milliseconds - convert to seconds
                            date = Math.round(timestamp / 1000);
                        } else {
                            // Invalid or relative timestamp, use current time
                            date = currentTimeSeconds;
                        }
                    }
                }

                // Validate the final date - ensure it's reasonable (in seconds)
                if (date <= 0 || date > currentTimeSeconds + 86400) { // Not in future by more than 1 day
                    date = currentTimeSeconds;
                }

            } catch (e) {
                // Failed to parse date, use current time
                date = currentTimeSeconds;
            }
        } else {
            // No date field found, use current time
            date = currentTimeSeconds;
        }

        // Parse vote counts
        let likeCount = 0;
        let dislikeCount = 0;

        if (commentData.votes) {
            likeCount = parseInt(commentData.votes.nb) || 0;
            dislikeCount = parseInt(commentData.votes.nbb) || 0;
        }

        // Create proper context URL for the video
        const contextUrl = `${CONFIG.EXTERNAL_URL_BASE}/video.${videoId}/`;

        // Ensure all string fields have proper non-null values
        const safeAuthorName = authorName || "Anonymous";
        const safeAuthorUrl = authorUrl || "";
        const safeAuthorThumbnail = authorThumbnail || "";
        const safeMessage = message || "";
        const safeContextUrl = contextUrl || "";
        const safeCommentId = commentData.id ? commentData.id.toString() : "";
        const safeVideoId = videoId ? videoId.toString() : "";

        // Create comment object following standard Grayjay pattern
        const comment = new PlatformComment({
            contextUrl: safeContextUrl,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, safeCommentId, plugin.config.id),
                safeAuthorName,
                safeAuthorUrl,
                safeAuthorThumbnail
            ),
            message: safeMessage,
            rating: new RatingLikesDislikes(likeCount, dislikeCount),
            date: date,
            replyCount: commentData.replies ? (commentData.replies.nb_posts_total || 0) : 0,
            context: {
                id: safeCommentId,
                commentId: safeCommentId, // For compatibility with standard patterns
                videoId: safeVideoId, // Store video ID for getSubComments compatibility
                claimId: safeVideoId, // Alternative naming for broader compatibility
                country: commentData.country || "",
                countryName: commentData.country_name || "",
                timeDiff: commentData.time_diff || ""
            }
        });

        return comment;

    } catch (error) {
        return null;
    }
}

function getContentRecommendations(relatedIds) {
    try {
        if (!relatedIds || relatedIds.length === 0) {
            return new XNXXRecommendationsPager([], false, {});
        }

        // Take first 20 related IDs for recommendations
        const recommendationIds = relatedIds.slice(0, 20);

        // Fetch video details in bulk for recommendations
        const recommendedVideos = fetchVideoDetailsBulk(recommendationIds);

        return new XNXXRecommendationsPager(recommendedVideos, false, {});

    } catch (error) {
        return new XNXXRecommendationsPager([], false, {});
    }
}

/**
 * Get comments for a video with pagination support
 * @param {string} videoId - The video ID to get comments for
 * @param {string} continuationToken - Token for pagination
 * @returns {XNXXCommentPager} Pager with comments
 */
function getVideoComments(videoId, continuationToken) {
    try {
        if (!videoId) {
            throw new ScriptException("Video ID is required for comments");
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
                // Invalid token, start from page 0
            }
        }

        // Fetch comments using threads API - based on memory: XNXX comments API uses POST request to /threads/video-comments/get-posts/top/{VIDEO_ID}/{PAGE}/0
        const commentsUrl = `${BASE_URL}/threads/video-comments/get-posts/top/${videoId}/${page}/0?country=US&language=en&version=STRAIGHT`;
        // Prepare POST data exactly as in the working curl request
        const postData = `load_all=0&loaded_ids=${loadedIds}`;

        // Use exact headers from the working curl request
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

        if (!data.posts) {
            return new XNXXCommentPager([], false, {
                videoId: videoId ? videoId.toString() : "",
                continuationToken: null,
                totalComments: 0
            });
        }

        // Parse comments
        const comments = [];

        if (data.posts.posts && typeof data.posts.posts === 'object') {
            for (const [, commentData] of Object.entries(data.posts.posts)) {
                const comment = createPlatformComment(commentData, videoId);
                if (comment) {
                    comments.push(comment);
                }
            }
        }

        // Check if there are more comments
        const totalComments = data.posts.nb_posts_total || 0;
        const currentCount = comments.length + (page * CONFIG.COMMENTS_PAGE_SIZE);
        const hasMore = currentCount < totalComments;

        // Create next continuation token
        let nextToken = null;
        if (hasMore) {
            const newLoadedIds = data.posts.ids ? data.posts.ids.join(',') : loadedIds;
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

        // Parse continuation token for pagination
        let page = 0;
        let loadedIds = "";

        if (continuationToken) {
            try {
                const tokenData = JSON.parse(continuationToken);
                page = tokenData.page || 0;
                loadedIds = tokenData.loadedIds || "";
            } catch (e) {
                // Invalid token, start from page 0
                page = 0;
                loadedIds = "";
            }
        }

        // Use the exact URL pattern from working curl request for replies
        // This endpoint gets replies for a specific comment
        const repliesUrl = `${BASE_URL}/threads/video-comments/get-posts/top/${videoId}/${commentId}/0?country=US&language=en&version=STRAIGHT`;

        // Prepare POST data exactly as in the working curl request
        const postData = `load_all=0&loaded_ids=${loadedIds}`;

        // Use exact headers from the working curl request (excluding accept-encoding)
        const repliesHeaders = {
            ...API_HEADERS,
            'content-type': 'application/x-www-form-urlencoded'
        };

        let data;
        try {
            data = makeApiRequest(repliesUrl, 'POST', repliesHeaders, postData, 'comment replies');
        } catch (apiError) {
            // If we get a 404 or other error, return empty replies instead of throwing
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

        // Check if we have a valid response structure
        if (!data || !data.posts) {
            return new XNXXCommentPager([], false, {
                commentId: commentId ? commentId.toString() : "",
                videoId: videoId ? videoId.toString() : "",
                continuationToken: null,
                totalReplies: 0
            });
        }

        // Parse replies (same format as comments)
        const replies = [];

        if (data.posts.posts && typeof data.posts.posts === 'object') {
            for (const [, replyData] of Object.entries(data.posts.posts)) {
                const reply = createPlatformComment(replyData, videoId);
                if (reply) {
                    replies.push(reply);
                }
            }
        }

        // Check if there are more replies
        const totalReplies = data.posts.nb_posts_total || 0;
        const currentCount = replies.length + (page * CONFIG.COMMENTS_PAGE_SIZE);
        const hasMore = currentCount < totalReplies && replies.length > 0;

        // Create next continuation token
        let nextToken = null;
        if (hasMore) {
            const newLoadedIds = data.posts.ids ? data.posts.ids.join(',') : loadedIds;
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
                        url: `xvideos://profile/${star.F}`, // Use internal URL scheme
                        urlAlternatives: [`https://www.xvideos.com/${star.T}/${star.F.toLowerCase().replace(/\s+/g, '-')}`],
                        links: {
                            "xvideos Profile": `https://www.xvideos.com/${star.T}/${star.F.toLowerCase().replace(/\s+/g, '-')}`
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
                        urlAlternatives: [`https://www.xnxx.com/${creator.F.toLowerCase().replace(/\s+/g, '-')}`],
                        links: {
                            "xvideos Profile": `https://www.xnxx.com/${creator.F.toLowerCase().replace(/\s+/g, '-')}`
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
function getPornstarChannel(pornstarName, originalUrl) {
    try {
        // Use search-suggest API to find the pornstar's ID
        const cleanQuery = encodeURIComponent(pornstarName.replace(/-/g, ' '));
        const suggestUrl = `${BASE_URL}/search-suggest/${cleanQuery}?country=US&language=en&version=STRAIGHT`;
        const response = http.GET(suggestUrl, API_HEADERS, false);

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
            const profileData = makeApiRequest(profileUrl, 'GET', API_HEADERS, null, 'pornstar profile');

            if (profileData.profile) {
                // Use the detailed profile data
                return createChannelFromProfile(profileData.profile, originalUrl, true);
            }
        } catch (profileError) {
            // If detailed profile fails, create basic channel from search data
        }

        // Create basic channel from search data
        const internalUrl = `xvideos://profile/${matchedStar.id}`;
        const externalUrl = originalUrl || `https://www.xnxx.com/pornstar/${pornstarName}`;

        return new PlatformChannel({
            id: new PlatformID(PLATFORM, matchedStar.id.toString(), plugin.config.id),
            name: matchedStar.N,
            thumbnail: matchedStar.pic || "",
            banner: matchedStar.pic || "",
            subscribers: 0,
            description: `Pornstar: ${matchedStar.N}`,
            url: internalUrl,
            urlAlternatives: [externalUrl],
            links: {
                "XNXX Profile": externalUrl
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
    if (isPornstar) {
        // For pornstars, try to create a pornstar URL
        const pornstarName = (profile.disp_name || profile.name || "").toLowerCase().replace(/\s+/g, '-');
        externalUrl = `https://www.xvideos.com/pornstar/${pornstarName}`;
    } else {
        externalUrl = `https://www.xvideos.com/profile/${profile.name}`;
    }

    // Use originalUrl as fallback if available
    if (originalUrl && !externalUrl.includes(originalUrl.split('/').pop())) {
        externalUrl = originalUrl;
    }

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, profile.id_user?.toString() || "", plugin.config.id),
        name: profile.disp_name || profile.name || "Unknown Channel",
        thumbnail: profile.pictureUrl || "",
        banner: profile.pictureUrl || "", // Use same image for banner if no separate banner
        subscribers: profile.nbSubscribers || 0,
        description: description,
        url: internalUrl, // Use internal URL as primary
        urlAlternatives: [externalUrl], // External URL as alternative
        links: {
            "XVideos Profile": externalUrl
        }
    });
}

source.search = function (query, type, order, filters, continuationToken) {
    try {
        if (!query || query.trim().length === 0) {
            throw new ScriptException("Search query cannot be empty");
        }

        // Clean and encode the search query
        const cleanQuery = encodeURIComponent(query.trim());

        // Determine page number from continuation token (server-side pagination)
        const page = continuationToken ? (parseInt(continuationToken) || 0) : 0;

        // Fetch search results using search API with page parameter
        // Try page-based URL first, fallback to query parameter if needed
        let searchUrl = `${BASE_URL}/search/${cleanQuery}/${page}?country=US&language=en&version=STRAIGHT`;
        let data;

        try {
            data = makeApiRequest(searchUrl, 'GET', API_HEADERS, null, 'search results');
        } catch (pageError) {
            // Fallback to query parameter approach if page-based URL fails
            searchUrl = `${BASE_URL}/search/${cleanQuery}?page=${page}&country=US&language=en&version=STRAIGHT`;
            try {
                data = makeApiRequest(searchUrl, 'GET', API_HEADERS, null, 'search results with page param');
            } catch (paramError) {
                // Final fallback to original URL for page 0 only
                if (page === 0) {
                    searchUrl = `${BASE_URL}/search/${cleanQuery}?country=US&language=en&version=STRAIGHT`;
                    data = makeApiRequest(searchUrl, 'GET', API_HEADERS, null, 'search results fallback');
                } else {
                    throw paramError;
                }
            }
        }

        if (!data.ids || !Array.isArray(data.ids)) {
            throw new ScriptException("Invalid search response format - missing or invalid ids array");
        }

        // For server-side pagination, use all results from the current page
        const pageIds = data.ids;

        if (pageIds.length === 0) {
            return new XNXXSearchContentPager([], false, {
                query: query,
                type: type,
                order: order,
                filters: filters,
                continuationToken: null,
                totalResults: data.nb_results_total || 0,
                currentPage: page + 1
            });
        }

        // Fetch video details in bulk
        const videos = fetchVideoDetailsBulk(pageIds);

        // Check if there are more pages based on API response or result count
        // If we got fewer results than expected, assume this is the last page
        const hasMore = data.metadata?.hasMorePages !== false &&
                       pageIds.length >= CONFIG.DEFAULT_PAGE_SIZE &&
                       (data.nb_results_total ? ((page + 1) * CONFIG.DEFAULT_PAGE_SIZE) < data.nb_results_total : true);

        const nextToken = hasMore ? (page + 1).toString() : null;

        return new XNXXSearchContentPager(videos, hasMore, {
            query: query,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken,
            totalResults: data.nb_results_total || 0,
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

    // Additional context information for search results
    getTotalResults() {
        return this.context.totalResults || 0;
    }

    getCurrentPage() {
        return this.context.currentPage || 1;
    }

    getQuery() {
        return this.context.query || "";
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
source.searchPlaylists = function(query, type, order, filters, continuationToken) {
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
        // Fetch categories from home-categories endpoint
        const url = `${BASE_URL}/home-categories?country=US&language=en&version=STRAIGHT`;
        const data = makeApiRequest(url, 'GET', API_HEADERS, null, 'category search');

        if (!data.categories || !Array.isArray(data.categories)) {
            return [];
        }

        const matchingPlaylists = [];

        // Filter categories that match the search query
        data.categories.forEach(category => {
            if (category.t && category.t.trim() && !category.no_rotate) {
                const categoryName = category.t.toLowerCase();

                // Check if category matches the search query
                if (categoryMatchesQuery(categoryName, query)) {
                    try {
                        const playlist = createPlatformPlaylist(category);
                        if (playlist && playlist.name && playlist.url) {
                            matchingPlaylists.push(playlist);
                        }
                    } catch (playlistError) {
                        // Skip invalid playlists but continue processing
                    }
                }
            }
        });

        return matchingPlaylists;

    } catch (error) {
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
        // The thumbnail will be loaded when the playlist is actually opened
        const thumbnail = "";
        const thumbnails = new Thumbnails([
            new Thumbnail(thumbnail, 0)
        ]);

        // Estimate video count - we don't know the exact count without making an API call
        // Set to -1 to indicate unknown count
        const videoCount = -1;

        const playlistName = isRelated ?
            `${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)}` :
            searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);

        const playlistObj = {
            id: new PlatformID(PLATFORM, searchTerm, plugin.config.id),
            name: playlistName,
            thumbnails: thumbnails,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, "xnxx", plugin.config.id),
                "XNXX",
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
        return null;
    }
}

/**
 * Generate related search terms based on the original query
 * @param {string} originalQuery - The original search query
 * @returns {Array} Array of related search terms
 */
function generateRelatedSearchTerms(originalQuery) {
    const relatedTerms = [];
    const cleanQuery = originalQuery.toLowerCase().trim();

    try {
        // Add some common variations and related terms
        const variations = [
            `${cleanQuery} compilation`,
            `best ${cleanQuery}`,
            `hot ${cleanQuery}`
        ];

        // Add variations that make sense
        variations.forEach(variation => {
            if (variation !== cleanQuery && variation.length > 2) {
                relatedTerms.push(variation);
            }
        });

        // If the query has multiple words, try individual words
        const words = cleanQuery.split(/\s+/);
        if (words.length > 1) {
            words.forEach(word => {
                if (word.length > 2 && !relatedTerms.includes(word)) {
                    relatedTerms.push(word);
                }
            });
        }

    } catch (error) {
        // Ignore errors in related term generation
    }

    return relatedTerms;
}

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Check for internal URL scheme first (preferred)
    if (REGEX_PATTERNS.urls.channelInternal.test(url)) {
        return true;
    }

    // Check for various XVideos profile and pornstar URL patterns
    const patterns = [
        REGEX_PATTERNS.urls.channelStandard,
        REGEX_PATTERNS.urls.channelMobile,
        REGEX_PATTERNS.urls.pornstarStandard,
        REGEX_PATTERNS.urls.pornstarMobile
    ];

    return patterns.some(pattern => pattern.test(url));
};

source.getChannel = function(url) {
    try {
        const profileId = extractProfileId(url);

        // Handle pornstar URLs differently
        if (profileId.startsWith('pornstar:')) {
            const pornstarName = profileId.replace('pornstar:', '');
            return getPornstarChannel(pornstarName, url);
        }

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

            if (!data.profile) {
                throw new ScriptException("Invalid channel response format - missing profile object");
            }

            return createChannelFromProfile(data.profile, url, false);
        } catch (apiError) {
            // If the API call failed and we used a resolved ID, try with the original username
            if (actualProfileId !== profileId) {
                const fallbackUrl = `${BASE_URL}/profile-page/${profileId}?country=US&language=en&version=STRAIGHT`;

                try {
                    const fallbackData = makeApiRequest(fallbackUrl, 'GET', API_HEADERS, null, 'channel info fallback');
                    if (fallbackData.profile) {
                        return createChannelFromProfile(fallbackData.profile, url, false);
                    }
                } catch (fallbackError) {
                    // Ignore fallback error, throw original
                }
            }

            // Re-throw the original error
            throw apiError;
        }

    } catch (error) {
        throw new ScriptException("Failed to get channel info: " + error.message);
    }
};

source.getChannelCapabilities = function() {
    return new ResultCapabilities(
        [Type.Feed.Mixed],
        [Type.Order.Chronological],
        []
    );
};

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    try {
        const profileId = extractProfileId(url);

        // Determine if we need to resolve username to numeric ID
        let actualProfileId = profileId;

        // If profileId is not purely numeric, try to resolve it as a username
        if (!/^\d+$/.test(profileId)) {
            const resolvedId = resolveUsernameToId(profileId);
            if (resolvedId) {
                actualProfileId = resolvedId;
            }
        }

        // Determine sort order - default to 'new'
        let sortOrder = 'new';
        // Note: For now we only support 'new' order
        // Future: Add support for other orders like 'popular', 'views', etc.

        // Determine page number from continuation token
        const page = continuationToken ? (parseInt(continuationToken) || 0) : 0;

        // Fetch channel videos using profile-page API
        const channelUrl = `${BASE_URL}/profile-page/${actualProfileId}/videos/${sortOrder}/${page}?country=US&language=en&version=STRAIGHT`;

        let data;
        try {
            data = makeApiRequest(channelUrl, 'GET', API_HEADERS, null, 'channel contents');
        } catch (apiError) {
            // If the API call failed and we used a resolved ID, try with the original username
            if (actualProfileId !== profileId) {
                const fallbackUrl = `${BASE_URL}/profile-page/${profileId}/videos/${sortOrder}/${page}?country=US&language=en&version=STRAIGHT`;

                try {
                    data = makeApiRequest(fallbackUrl, 'GET', API_HEADERS, null, 'channel contents fallback');
                } catch (fallbackError) {
                    throw apiError; // Re-throw the original error
                }
            } else {
                throw apiError;
            }
        }

        if (!data.videos || !Array.isArray(data.videos)) {
            throw new ScriptException("Invalid channel contents response format - missing or invalid videos array");
        }



        // Fetch video details in bulk
        const videos = fetchVideoDetailsBulk(data.videos);

        // Check if there are more pages
        const hasMore = !data.metadata?.isLastPage && data.videos.length > 0;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new XNXXChannelContentPager(videos, hasMore, {
            url: url,
            profileId: actualProfileId, // Use resolved ID for consistency
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel contents: " + error.message);
    }
};

/**
 * Check if URL is a playlist URL
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is a playlist URL
 */
source.isPlaylistUrl = function(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Check for internal playlist URL scheme
    return REGEX_PATTERNS.urls.playlistInternal.test(url);
};

/**
 * Get playlist details and contents
 * @param {string} url - Playlist URL
 * @returns {PlatformPlaylistDetails} Playlist details with contents
 */
source.getPlaylist = function(url) {
    try {
        // Extract search term from playlist URL
        const match = url.match(REGEX_PATTERNS.urls.playlistInternal);
        if (!match || !match[1]) {
            throw new ScriptException("Invalid playlist URL format");
        }

        const searchTerm = match[1];

        // Use search API to get playlist contents
        // Format search term with + instead of %20 for spaces
        const formattedSearchTerm = searchTerm.replace(/\s+/g, '+');
        const searchUrl = `${BASE_URL}/search/${formattedSearchTerm}?country=US&language=en&version=STRAIGHT`;
        const data = makeApiRequest(searchUrl, 'GET', API_HEADERS, null, 'playlist search');

        if (!data.ids || !Array.isArray(data.ids)) {
            throw new ScriptException("Invalid playlist search response format - missing or invalid ids array");
        }

        // Fetch video details in bulk for the playlist
        const videos = fetchVideoDetailsBulk(data.ids);
        // Create playlist details object
        const playlistDetailsObj = {
            id: new PlatformID(PLATFORM, searchTerm, plugin.config.id),
            name: searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1), // Capitalize first letter
            thumbnails: videos.length > 0 ? videos[0].thumbnails : new Thumbnails([]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, "xvideos", localConfig.id),
                "XVideos",
                CONFIG.EXTERNAL_URL_BASE,
                ""
            ),
            datetime: 0,
            url: url,
            videoCount: data.nb_results_total || videos.length,
            thumbnail: videos.length > 0 ? videos[0].thumbnails.sources[0]?.url || "" : "",
            contents: source.search(formattedSearchTerm)
        };

        const playlistDetails = new PlatformPlaylistDetails(playlistDetailsObj);

        return playlistDetails;

    } catch (error) {
        throw new ScriptException("Failed to get playlist details: " + error.message);
    }
};

source.isContentDetailsUrl = function(url) {
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


source.getContentDetails = function(url) {
    try {
        const videoId = extractVideoId(url);

        // Try mobile API first
        const detailsUrl = `${BASE_URL}/video-page/${videoId}?country=US&language=en&version=STRAIGHT`;

        try {
            const data = makeApiRequest(detailsUrl, 'GET', API_HEADERS, null, 'video details');

            if (data.video) {
                // Check for live streams (not currently supported)
                if (data.video.is_live) {
                    throw new ScriptException("Live streams are not currently supported");
                }

                // API success - create video details normally
                return createVideoDetailsFromApiData(data, url);
            } else {
                throw new ScriptException("Video not found in API response");
            }
        } catch (apiError) {
            // Try website fallback to extract actual video ID
            return tryWebsiteFallback(url);
        }

    } catch (error) {
        throw new ScriptException("Failed to get video details: " + error.message);
    }
};
/**
 * Try website fallback to extract actual video ID when API fails
 * @param {string} url - Original video URL
 * @returns {PlatformVideoDetails} Video details object
 */
function tryWebsiteFallback(url) {
    try {
        // Fetch the website page to extract the actual video ID
        const websiteHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };

        const websiteResponse = http.GET(url, websiteHeaders, true);

        if (!websiteResponse.isOk) {
            throw new ScriptException(`Website returned ${websiteResponse.code}. Video may not exist or be accessible.`);
        }

        // Extract the actual video ID from HTML

        // Look for id_video in various formats
        const idVideoPatterns = [
            /"id_video"\s*:\s*(\d+)/i,
            /'id_video'\s*:\s*(\d+)/i,
            /id_video['":\s]*[=:]\s*['"]*(\d+)['"]*[,;\s]/i,
            /id_video[^0-9]*(\d+)/i
        ];

        let actualVideoId = null;
        for (const pattern of idVideoPatterns) {
            const match = websiteResponse.body.match(pattern);
            if (match && match[1]) {
                actualVideoId = match[1];

                break;
            }
        }

        if (!actualVideoId) {
            throw new ScriptException("Could not extract video ID from website. Video may not exist or be accessible.");
        }

        // Try the API again with the actual video ID
        const actualApiUrl = `${BASE_URL}/video-page/${actualVideoId}?country=US&language=en&version=STRAIGHT`;
        const actualData = makeApiRequest(actualApiUrl, 'GET', API_HEADERS, null, 'video details with extracted ID');

        if (!actualData.video) {
            throw new ScriptException("Video not available through API even with extracted ID");
        }

        // Create video details using the helper function
        return createVideoDetailsFromApiData(actualData, url);

    } catch (error) {
        throw new ScriptException(`Video not available: ${error.message}`);
    }
}

source.getComments = function (url, continuationToken) {
    try {
        const videoId = extractVideoId(url);

        // Use the shared getVideoComments function
        return getVideoComments(videoId, continuationToken);

    } catch (error) {
        throw new ScriptException("Failed to get comments: " + error.message);
    }
};

/**
 * Get sub-comments (replies) for a comment following PeerTube/Odysee pattern
 * This is the standard framework method for getting comment replies
 * @param {PlatformComment} comment - The comment to get replies for
 * @returns {XNXXCommentPager} Pager with comment replies
 */
source.getSubComments = function (comment) {
    try {
        // Validate input comment object
        if (!comment) {
            return new XNXXCommentPager([], false, {
                commentId: "",
                videoId: "",
                continuationToken: null,
                totalReplies: 0,
                error: "No comment provided"
            });
        }

        if (!comment.context) {
            return new XNXXCommentPager([], false, {
                commentId: "",
                videoId: "",
                continuationToken: null,
                totalReplies: 0,
                error: "Comment has no context"
            });
        }

        // Extract comment ID - try both possible field names for compatibility
        const commentId = comment.context.id || comment.context.commentId;

        if (!commentId) {
            return new XNXXCommentPager([], false, {
                commentId: "",
                videoId: "",
                continuationToken: null,
                totalReplies: 0,
                error: "No comment ID found"
            });
        }

        // Extract video ID from the comment's context
        // For XNXX, we need both comment ID and video ID for the API call
        const videoId = comment.context.videoId || comment.context.claimId;

        if (!videoId) {
            return new XNXXCommentPager([], false, {
                commentId: commentId.toString(),
                videoId: "",
                continuationToken: null,
                totalReplies: 0,
                error: "No video ID found in comment context"
            });
        }

        // Use the existing getCommentReplies function with no initial continuation token
        return getCommentReplies(commentId, videoId, null);

    } catch (error) {
        // Return empty pager instead of throwing to prevent UI crashes
        // Ensure all string values are safe for serialization
        const safeCommentId = (comment?.context?.id || comment?.context?.commentId || "").toString();
        const safeVideoId = (comment?.context?.videoId || comment?.context?.claimId || "").toString();
        const safeErrorMessage = error?.message ? error.message.toString() : "Unknown error";

        return new XNXXCommentPager([], false, {
            commentId: safeCommentId,
            videoId: safeVideoId,
            continuationToken: null,
            totalReplies: 0,
            error: safeErrorMessage
        });
    }
};

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

    // Additional context information for channel search results
    getTotalResults() {
        return this.context.totalResults || 0;
    }

    getQuery() {
        return this.context.query || "";
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

log("Xvideo Plugin loaded successfully");

