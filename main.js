const MESSAGE = cast.framework.messages.MessageType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;
const COMMAND = cast.framework.messages.Command;
const EVENT = cast.framework.events.EventType;
const CAPABILITIES = cast.framework.system.DeviceCapabilities;

const context = cast.framework.CastReceiverContext.getInstance();

const LOG_RECEIVER_TAG = 'StremioReceiver';

const playerManager = context.getPlayerManager();
// playerManager.setSupportedMediaCommands(COMMAND.LOAD | COMMAND.SEEK | COMMAND.PLAY | COMMAND.PAUSE | COMMAND.STOP | COMMAND.GET_STATUS);

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
    
    const deviceCapabilities = context.getDeviceCapabilities();
    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_HDR_SUPPORTED]) {
        console.log('HDR SUPPORTED');
    }

    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_DV_SUPPORTED]) {
        console.log('DV SUPPORTED');
    }
});

playerManager.addEventListener(EVENT.MEDIA_STATUS, (event) => {
    console.log('MEDIA_STATUS');
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, (loadRequestData) => {
    console.log('LOAD');

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!loadRequestData.media || !loadRequestData.media.contentId) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    const streamUrl = new URL(loadRequestData.media.contentId);

    const { videoCodecs, audioCodecs } = getSupportedCodecs();
    videoCodecs.forEach((codec) => streamUrl.searchParams.append('videoCodecs', codec));
    audioCodecs.forEach((codec) => streamUrl.searchParams.append('audioCodecs', codec));

    loadRequestData.media.contentId = streamUrl.toString();

    // fetch(`${origin}/hlsv2/probe?mediaURL=${encodeURIComponent(mediaURL)}`)
    //     .then((res) => res.json())
    //     .then((probe) => {
    //         console.log(probe);
    //     })
    //     .catch((e) => {
    //         console.error(e);
    //     });

    return loadRequestData;

    // return fetch(loadRequestData.media.contentUrl)
    //     .then((asset) => {
    //         if (!asset) {
    //             throw ERROR_REASON.INVALID_REQUEST;
    //         }

    //         loadRequestData.media.contentUrl = asset.url;
    //         loadRequestData.media.metadata = asset.metadata;
    //         loadRequestData.media.tracks = asset.tracks;
    //         return loadRequestData;
    //     }).catch((error) => {
    //         error.reason = reason;
    //         return error;
    //     });
});

context.start(castReceiverOptions);