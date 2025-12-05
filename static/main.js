const MESSAGE = cast.framework.messages.MessageType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorType;
const CAPABILITIES = cast.framework.system.DeviceCapabilities;

const context = cast.framework.CastReceiverContext.getInstance();

const LOG_TAG = 'StremioReceiver';
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
castDebugLogger.loggerLevelByEvents = {
    'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
    'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG,
};

const playerManager = context.getPlayerManager();
const castReceiverOptions = new cast.framework.CastReceiverOptions();
castReceiverOptions.useShakaForHls = true;

context.addEventListener(cast.framework.system.EventType.READY, () => {
    if (!castDebugLogger.debugOverlayElement_) {
        castDebugLogger.setEnabled(true);
    }
    
    const deviceCapabilities = context.getDeviceCapabilities();
    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_HDR_SUPPORTED]) {
        castDebugLogger.debug(LOG_TAG, 'HDR SUPPORTED');
    }

    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_DV_SUPPORTED]) {
        castDebugLogger.debug(LOG_TAG, 'DV SUPPORTED');
    }
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, (request) => {
    castDebugLogger.debug(LOG_TAG, request);

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!request.media) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    if (!request.media.entity) {
        return request;
    }

    return thirdparty
        .fetchAssetAndAuth(request.media.entity, request.credentials)
        .then((asset) => {
            if (!asset) {
                throw ERROR_REASON.INVALID_REQUEST;
            }

            request.media.contentUrl = asset.url;
            request.media.metadata = asset.metadata;
            request.media.tracks = asset.tracks;
            return request;
        }).catch(reason => {
            error.reason = reason;
            return error;
        });
});

context.start(castReceiverOptions);