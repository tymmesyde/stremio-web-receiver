const MESSAGE = cast.framework.messages.MessageType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorType;
const CAPABILITIES = cast.framework.system.DeviceCapabilities;

const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();
const castReceiverOptions = new cast.framework.CastReceiverOptions();
castReceiverOptions.useShakaForHls = true;

context.addEventListener(cast.framework.system.EventType.READY, () => {
    const deviceCapabilities = context.getDeviceCapabilities();
    console.log(deviceCapabilities);
    
    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_HDR_SUPPORTED]) {
        // Write your own event handling code, for example
        // using the deviceCapabilities[cast.framework.system.DeviceCapabilities.IS_HDR_SUPPORTED] value
    }

    if (deviceCapabilities && deviceCapabilities[CAPABILITIES.IS_DV_SUPPORTED]) {
        // Write your own event handling code, for example
        // using the deviceCapabilities[cast.framework.system.DeviceCapabilities.IS_DV_SUPPORTED] value
    }
});

playerManager.setMessageInterceptor(MESSAGE.LOAD, (request) => {
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