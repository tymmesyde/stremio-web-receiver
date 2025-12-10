const MESSAGE = cast.framework.messages.MessageType;
const EVENT = cast.framework.events.EventType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;

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

context.addEventListener(EVENT.READY, () => {
    console.log('READY');
});

playerManager.addEventListener(EVENT.MEDIA_STATUS, (event) => {
    console.log('MEDIA_STATUS', event);
});

let externalTextTracks = [];
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

    const streamUrl = new URL(request.media.contentId);

    const { videoCodecs, audioCodecs } = getSupportedCodecs();
    videoCodecs.forEach((codec) => streamUrl.searchParams.append('videoCodecs', codec));
    audioCodecs.forEach((codec) => streamUrl.searchParams.append('audioCodecs', codec));

    // streamUrl.searchParams.append('maxAudioChannels', 2);

    request.media.contentId = streamUrl.toString();

    return request;
});

playerManager.addEventListener(EVENT.PLAYER_LOAD_COMPLETE, () => {
    console.log('PLAYER_LOAD_COMPLETE');

    const audioTracksManager = playerManager.getAudioTracksManager();
    const audioTracks = audioTracksManager.getTracks();
    console.log('AUDIO_TRACKS', audioTracks);

    const textTracksManager = playerManager.getTextTracksManager();
    const textTracks = textTracksManager.getTracks();
    console.log('TEXT_TRACKS', textTracks);
    
    const tracks = externalTextTracks.map(({ mimeType, uri, language, label }) => {
        const track = textTracksManager.createTrack();
        track.trackContentType = mimeType;
        track.trackContentId = uri;
        track.language = language;
        track.name = label;
        return track;
    });

    textTracksManager.addTracks(tracks);
});

playerManager.setMessageInterceptor(MESSAGE.EDIT_TRACKS_INFO, (request) => {
    console.log('EDIT_TRACKS_INFO', request);

    return request;
});

context.start(castReceiverOptions);

const getSupportedCodecs = () => {
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
};