const MESSAGE = cast.framework.messages.MessageType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;
const COMMAND = cast.framework.messages.Command;
const EVENT = cast.framework.events.EventType;
const CAPABILITIES = cast.framework.system.DeviceCapabilities;

const context = cast.framework.CastReceiverContext.getInstance();

const LOG_TAG = 'StremioReceiver';
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
castDebugLogger.loggerLevelByEvents = {
    'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
    'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG,
};

const playerManager = context.getPlayerManager();
const playbackConfig = (Object.assign(new cast.framework.PlaybackConfig(), playerManager.getPlaybackConfig()));
playbackConfig.autoResumeNumberOfSegments = 1;
playerManager.setPlaybackConfig(playbackConfig);
playerManager.setSupportedMediaCommands(COMMAND.SEEK | COMMAND.PAUSE);

const castReceiverOptions = new cast.framework.CastReceiverOptions();
castReceiverOptions.useShakaForHls = true;

context.addEventListener(EVENT.READY, () => {
    castDebugLogger.debug(LOG_TAG, 'READY');

    if (!castDebugLogger.debugOverlayElement_) {
        castDebugLogger.setEnabled(true);
    }
    
    const deviceCapabilities = context.getDeviceCapabilities();
    console.log(deviceCapabilities);
    
    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_HDR_SUPPORTED]) {
        castDebugLogger.debug(LOG_TAG, 'HDR SUPPORTED');
    }

    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_DV_SUPPORTED]) {
        castDebugLogger.debug(LOG_TAG, 'DV SUPPORTED');
    }
});

playerManager.addEventListener(EVENT.MEDIA_STATUS, (event) => {
    castDebugLogger.debug(LOG_TAG, 'MEDIA_STATUS');
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, loadRequestData => {
    castDebugLogger.debug(LOG_TAG, 'LOAD');

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!loadRequestData.media) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    if (!loadRequestData.media.entity) {
        return loadRequestData;
    }

    return fetch(loadRequestData.media.entity)
        .then(asset => {
            if (!asset) {
                throw ERROR_REASON.INVALID_REQUEST;
            }

            loadRequestData.media.contentUrl = asset.url;
            loadRequestData.media.metadata = asset.metadata;
            loadRequestData.media.tracks = asset.tracks;
            return loadRequestData;
        }).catch(reason => {
            error.reason = reason;
            return error;
        });
    });

context.start(castReceiverOptions);