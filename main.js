const MESSAGE = cast.framework.messages.MessageType;
const EVENT = cast.framework.events.EventType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;

const VIDEO_CODECS = {
    'h264': 'video/mp4; codecs="avc1.42E01E"',
    'h265': 'video/mp4; codecs="hev1.1.6.L150.B0"',
};

const AUDIO_CODECS = {
    'aac': 'audio/mp4; codecs="mp4a.40.5"',
    'mp3': 'audio/mp4; codecs="mp4a.69"',
};

const RESOLUTIONS = [
    [3840, 2160],
    [2560, 1440],
    [1920, 1080],
    [1280, 720],
    [854, 480],
];

const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

const playbackConfig = new cast.framework.PlaybackConfig();
playbackConfig.manifestRequestHandler = (requestInfo) => {
    console.log('MANIFEST', requestInfo.url);
    return requestInfo;
};

playbackConfig.autoResumeDuration = 5;
playbackConfig.autoPauseDuration = 0;
playbackConfig.autoResumeNumberOfSegments = 1;

console.log('PLAYBACK_CONFIG', playbackConfig);
playerManager.setPlaybackConfig(playbackConfig);

const castReceiverOptions = new cast.framework.CastReceiverOptions();
castReceiverOptions.useShakaForHls = true;

let externalTextTracks = [];

context.addEventListener(EVENT.READY, () => {
    console.log('READY');
});

playerManager.addEventListener(EVENT.MEDIA_STATUS, (event) => {
    console.log('MEDIA_STATUS', event);
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, (request) => {
    console.log('LOAD', request);

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!request.media || !request.media.contentId) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    if (request.media.customData && request.media.customData.externalTextTracks) {
        externalTextTracks = request.media.customData.externalTextTracks;
    }

    try {
        const streamUrl = new URL(request.media.contentId);

        const { videoCodecs, audioCodecs } = getSupportedCodecs();
        videoCodecs.forEach((codec) => streamUrl.searchParams.append('videoCodecs', codec));
        audioCodecs.forEach((codec) => streamUrl.searchParams.append('audioCodecs', codec));
        console.log('SUPPORTED_VIDEO_CODECS', videoCodecs);
        console.log('SUPPORTED_AUDIO_CODECS', audioCodecs);

        const maxWidth = getSupportedMaxWidth();
        streamUrl.searchParams.append('maxWidth', maxWidth);
        console.log('SUPPORTED_MAX_WIDTH', maxWidth);

        streamUrl.searchParams.append('maxAudioChannels', 2);

        request.media.contentId = streamUrl.toString();
    } catch(e) {
        console.error('Failed to set transcoding params', e);
    }

    return request;
});

playerManager.addEventListener(EVENT.PLAYER_LOAD_COMPLETE, () => {
    console.log('PLAYER_LOAD_COMPLETE');

    addExternalTextTracks(externalTextTracks);

    const audioTracksManager = playerManager.getAudioTracksManager();
    const audioTracks = audioTracksManager.getTracks();
    console.log('AUDIO_TRACKS', audioTracks);

    const firstAudioTrack = audioTracks[0];
    firstAudioTrack && audioTracksManager.setActiveById(firstAudioTrack.trackId);

    const textTracksManager = playerManager.getTextTracksManager();
    const textTracks = textTracksManager.getTracks();
    console.log('TEXT_TRACKS', textTracks);

    const firstTextTrack = textTracks[0];
    firstTextTrack && textTracksManager.setActiveByIds([firstTextTrack.trackId]);
});

playerManager.setMessageInterceptor(MESSAGE.EDIT_TRACKS_INFO, (request) => {
    console.log('EDIT_TRACKS_INFO', request);

    return request;
});

context.start(castReceiverOptions);

const addExternalTextTracks = (externalTextTracks) => {
    const textTracksManager = playerManager.getTextTracksManager();

    const tracks = externalTextTracks.map(({ mimeType, uri, language, label }) => {
        const track = textTracksManager.createTrack();
        track.trackContentType = mimeType;
        track.trackContentId = uri;
        track.language = language;
        track.name = label;
        return track;
    });

    textTracksManager.addTracks(tracks);

    console.log('ADD_EXTERNAL_TEXT_TRACKS', tracks);
};

const getSupportedCodecs = () => {
    const canPlay = (codecs) => {
        return Object.entries(codecs)
            .filter(([, mediaType]) => context.canDisplayType(mediaType))
            .map(([codecName]) => codecName);
    };

    return {
        videoCodecs: canPlay(VIDEO_CODECS),
        audioCodecs: canPlay(AUDIO_CODECS),
    };
};

const getSupportedMaxWidth = (videoCodec) => {
    const mediaType = VIDEO_CODECS[videoCodec];
    const maxResolution = RESOLUTIONS
        .find(([width, height]) => context.canDisplayType(mediaType, null, width, height));
    console.log(maxResolution);

    if (maxResolution) return maxResolution[0];
    return RESOLUTIONS[RESOLUTIONS.length - 1][0];
};