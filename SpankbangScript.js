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
