const MESSAGE = cast.framework.messages.MessageType;
const EVENT = cast.framework.events.EventType;
const ERROR = cast.framework.messages.ErrorType;
const ERROR_REASON = cast.framework.messages.ErrorReason;

const playbackConfig = new cast.framework.PlaybackConfig();
playbackConfig.autoResumeDuration = 5;
playbackConfig.autoPauseDuration = 0;
playbackConfig.autoResumeNumberOfSegments = 1;
// playbackConfig.enableUITextDisplayer = false;
playbackConfig.shakaConfig = {
    // https://shaka-player-demo.appspot.com/docs/api/shaka.extern.html#.StreamingConfiguration
    streaming: {
        lowLatencyMode: false,
        bufferBehind: 30,
        bufferingGoal: 50,
        retryParameters: {
            maxAttempts: 20,
            timeout: 30000,
            stallTimeout: 10000,
            connectionTimeout: 120000,
            baseDelay: 1000,
            backoffFactor: 1.0,
            fuzzFactor: 0,
        },
    },
    manifest: {
        retryParameters: {
            maxAttempts: 10,
            timeout: 30000,
            baseDelay: 1000,
            backoffFactor: 2.0,
            fuzzFactor: 0.5,
        },
        defaultPresentationDelay: 3,
        availabilityWindowOverride: 0,
    },
};

const options = new cast.framework.CastReceiverOptions();
options.useShakaForHls = true;
// options.shakaVersion = '4.16.11';
options.playbackConfig = playbackConfig;

console.log('OPTIONS', options);

const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
castDebugLogger.loggerLevelByEvents = {
    'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
    'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG,
};

const context = cast.framework.CastReceiverContext.getInstance();
context.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

const playerManager = context.getPlayerManager();

const videoCodecElement = document.getElementById('video-codec');
const audioCodecElement = document.getElementById('audio-codec');
const videoTranscoding = document.getElementById('video-transcoding');
const audioTranscoding = document.getElementById('audio-transcoding');

let streamUrl = null;
let externalTextTracks = [];
let streamInfoInterval = null;

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

    videoCodecElement.innerText = 'Loading';
    audioCodecElement.innerText = 'Loading';
    videoTranscoding.innerText = 'Loading';
    audioTranscoding.innerText = 'Loading';

    const error = new cast.framework.messages.ErrorData(ERROR.LOAD_FAILED);
    if (!request.media || !request.media.contentId) {
        error.reason = ERROR_REASON.INVALID_PARAM;
        return error;
    }

    if (request.media.customData && request.media.customData.externalTextTracks) {
        externalTextTracks = request.media.customData.externalTextTracks;
    }

    try {
        streamUrl = new URL(request.media.contentId);

        const { videoCodecs, audioCodecs } = getSupportedCodecs();
        videoCodecs.forEach((codec) => streamUrl.searchParams.append('videoCodecs', codec));
        audioCodecs.forEach((codec) => streamUrl.searchParams.append('audioCodecs', codec));
        console.log('SUPPORTED_VIDEO_CODECS', videoCodecs);
        console.log('SUPPORTED_AUDIO_CODECS', audioCodecs);

        streamUrl.searchParams.append('maxAudioChannels', 2);
        // streamUrl.searchParams.append('maxWidth', 720);
        // streamUrl.searchParams.append('forceTranscoding', 1);

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

        const textTracksManager = playerManager.getTextTracksManager();
        const textTracks = textTracksManager.getTracks();
        console.log('TEXT_TRACKS', textTracks);
    } catch (e) {
        console.log('Failed to get tracks info', e);
    }

    streamInfoInterval && clearInterval(streamInfoInterval);
    streamInfoInterval = setInterval(() => updateStreamInfo(), 5000);
});

playerManager.setMessageInterceptor(MESSAGE.EDIT_TRACKS_INFO, (request) => {
    console.log('EDIT_TRACKS_INFO', request);

    return request;
});

playerManager.addEventListener(EVENT.REQUEST_STOP, (event) => {
    console.log('REQUEST_STOP', event);

    videoCodecElement.innerText = 'Loading';
    audioCodecElement.innerText = 'Loading';
    videoTranscoding.innerText = 'Loading';
    audioTranscoding.innerText = 'Loading';

    streamInfoInterval && clearInterval(streamInfoInterval);
    streamInfoInterval = null;
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
            'audio/mp4; codecs="mp4a.69"': 'mp3',
            'audio/mp4; codecs="mp4a.40.5"': 'aac',
            'audio/mp4; codecs="ac-3"': 'ac3',
            'audio/mp4; codecs="ec-3"': 'aec3',
        };
        
        return {
            videoCodecs: canPlay(videoCodecs),
            audioCodecs: canPlay(audioCodecs),
        };
    } catch(e) {
        console.error('Failed to get supported codecs', e);
    }
};

const updateStreamInfo = () => {
    try {
        if (!streamUrl) return;

        const { origin } = streamUrl;
        const transcodeData = `${origin}/transcode-data`;

        fetch(transcodeData)
            .then((response) => response.json())
            .then((body) => {
                const {
                    originalVideoCodec,
                    originalAudioCodec,
                    isVideoTranscoding,
                    isAudioTranscoding,
                } = body;

                videoCodecElement.innerText = originalVideoCodec ?? 'Loading';
                audioCodecElement.innerText = originalAudioCodec ?? 'Loading';
                videoTranscoding.innerText = isVideoTranscoding ?? 'Loading';
                audioTranscoding.innerText = isAudioTranscoding ?? 'Loading';

                console.log('TRANSCODING_INFO', body);
            })
            .catch((e) => {
                console.error('Failed to get transcode data', e);
            });
    } catch(e) {
        console.error('Failed to update stream info', e);
    }
};