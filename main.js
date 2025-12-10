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
    const canPlay = (type, codecs) => {
        return Object.entries(codecs)
            .filter(([codec]) => context.canDisplayType(`${type}/mp4`, codec))
            .map(([, name]) => name);
    };

    const videoCodecs = {
        'avc1.42E01E': 'h264',
        'hev1.1.6.L150.B0': 'h265',
        'vp8': 'vp8',
        'vp9': 'vp9',
    };

    const audioCodecs = {
        'mp4a.40.2': 'aac',
        'mp3': 'mp3',
        'ac-3': 'ac3',
        'ec-3': 'eac3',
        'vorbis': 'vorbis',
        'opus': 'opus',
        'flac': 'flac',
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