const MESSAGE = cast.framework.messages.MessageType;
const EVENT = cast.framework.events.EventType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;

const playbackConfig = new cast.framework.PlaybackConfig();
// playbackConfig.autoResumeDuration = 5;
// playbackConfig.enableUITextDisplayer = false;
// playbackConfig.shakaConfig = {
//     // https://shaka-player-demo.appspot.com/docs/api/shaka.extern.html#.StreamingConfiguration
//     streaming: {
//         preferNativeHls: true,
//         bufferingGoal: 5,
//         bufferBehind: 5,
//         // // https://shaka-player-demo.appspot.com/docs/api/shaka.extern.html#.RetryParameters
//         // retryParameters: {
//         //     maxAttempts: 3,
//         //     connectionTimeout: 20,
//         // },
//     },
// };

const options = new cast.framework.CastReceiverOptions();
options.useShakaForHls = true;
options.shakaVersion = '4.16.11';
options.playbackConfig = playbackConfig;

const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
castDebugLogger.loggerLevelByEvents = {
    'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
    'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG,
};

const context = cast.framework.CastReceiverContext.getInstance();
context.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

const playerManager = context.getPlayerManager();

let externalTextTracks = [];

context.addEventListener(EVENT.READY, () => {
    console.log('READY');

    if (!castDebugLogger.debugOverlayElement_) {
        castDebugLogger.setEnabled(true);
    }
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

        streamUrl.searchParams.append('maxAudioChannels', 2);
        streamUrl.searchParams.append('maxWidth', 720);
        streamUrl.searchParams.append('forceTranscoding', 1);

        request.media.contentId = streamUrl.toString();
    } catch(e) {
        console.error('Failed to set transcoding params');
    }

    return request;
});

playerManager.addEventListener(EVENT.PLAYER_LOAD_COMPLETE, () => {
    console.log('PLAYER_LOAD_COMPLETE');

    addExternalTextTracks(externalTextTracks);

    try {
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
    } catch (e) {
        console.log('Failed to get tracks info', e);
    }
});

playerManager.setMessageInterceptor(MESSAGE.EDIT_TRACKS_INFO, (request) => {
    console.log('EDIT_TRACKS_INFO', request);

    return request;
});

context.start(options);

const addExternalTextTracks = (externalTextTracks) => {
    try {
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
    } catch(e) {
        console.error('Failed to add external text tracks', e);
    }
};

const getSupportedCodecs = () => {
    try {
        const canPlay = (codecs) => {
            return Object.entries(codecs)
                .filter(([mediaType]) => context.canDisplayType(mediaType))
                .map(([, codecName]) => codecName);
        };

        const videoCodecs = {
            'video/mp4; codecs="avc1.42E01E"': 'h264',
            'video/mp4; codecs="hev1.1.6.L150.B0"': 'h265',
        };

        const audioCodecs = {
            'audio/mp4; codecs="mp4a.40.5"': 'aac',
            'audio/mp4; codecs="mp4a.69"': 'mp3',
        };
        
        return {
            videoCodecs: canPlay(videoCodecs),
            audioCodecs: canPlay(audioCodecs),
        };
    } catch(e) {
        console.error('Failed to get supported codecs', e);
    }
};