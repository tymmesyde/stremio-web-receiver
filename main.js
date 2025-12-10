const MESSAGE = cast.framework.messages.MessageType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;
const COMMAND = cast.framework.messages.Command;
const EVENT = cast.framework.events.EventType;
const CAPABILITIES = cast.framework.system.DeviceCapabilities;

const context = cast.framework.CastReceiverContext.getInstance();

const LOG_RECEIVER_TAG = 'StremioReceiver';

const playerManager = context.getPlayerManager();

const castReceiverOptions = new cast.framework.CastReceiverOptions();
castReceiverOptions.useShakaForHls = true;

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
        videoCodecs: canPlay('video', videoCodecs),
        audioCodecs: canPlay('audio', audioCodecs),
    };
};

context.addEventListener(EVENT.READY, () => {
    console.log('READY');
});

playerManager.addEventListener(EVENT.MEDIA_STATUS, (event) => {
    console.log('MEDIA_STATUS');
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, (request) => {
    console.log('LOAD');
    console.log(request);

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!request.media || !request.media.contentId) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    const streamUrl = new URL(request.media.contentId);

    const { videoCodecs, audioCodecs } = getSupportedCodecs();
    videoCodecs.forEach((codec) => streamUrl.searchParams.append('videoCodecs', codec));
    audioCodecs.forEach((codec) => streamUrl.searchParams.append('audioCodecs', codec));

    streamUrl.searchParams.append('maxAudioChannels', 2);

    request.media.contentId = streamUrl.toString();

    return request;
});

playerManager.addEventListener(EVENT.PLAYER_LOAD_COMPLETE, () => {
    console.log('PLAYER_LOAD_COMPLETE');

    const audioTracksManager = playerManager.getAudioTracksManager();
    const audioTracks = audioTracksManager.getTracks();
    console.log('audioTracks', audioTracks);

    const textTracksManager = playerManager.getTextTracksManager();
    const textTracks = textTracksManager.getTracks();
    console.log('textTracks', textTracks);
});

playerManager.setMessageInterceptor(MESSAGE.EDIT_TRACKS_INFO, (request) => {
    console.log('EDIT_TRACKS_INFO');
    console.log(request);

    return request;
});

context.start(castReceiverOptions);