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
playerManager.setSupportedMediaCommands(COMMAND.LOAD | COMMAND.SEEK | COMMAND.PLAY | COMMAND.PAUSE | COMMAND.STOP);

const castReceiverOptions = new cast.framework.CastReceiverOptions();
castReceiverOptions.useShakaForHls = true;

context.addEventListener(EVENT.READY, () => {
    castDebugLogger.debug(LOG_TAG, 'READY');

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

playerManager.addEventListener(EVENT.MEDIA_STATUS, (event) => {
    castDebugLogger.debug(LOG_TAG, 'MEDIA_STATUS');
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, (loadRequestData) => {
    castDebugLogger.debug(LOG_TAG, 'LOAD');

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!loadRequestData.media) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    if (!loadRequestData.media.entity) {
        return loadRequestData;
    }

    const { origin, searchParams } = new URL(loadRequestData.media.entity);
    const mediaURL = searchParams.get('mediaURL');

    if (mediaURL) {
		fetch(`${origin}/hlsv2/probe?mediaURL=${encodeURIComponent(mediaURL)}`)
			.then((res) => res.json())
			.then((probe) => {
				console.log(probe);
			})
			.catch((e) => {
				console.error(e);
			});
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