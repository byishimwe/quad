import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  PiCheckBold,
  PiDownloadSimpleBold,
  PiSpinnerBold,
  PiCornersOutBold,
  PiCornersInBold,
  PiPauseBold,
  PiPlayBold,
  PiGearBold,
  PiSpeakerHighBold,
  PiSpeakerSlashBold,
  PiAirplayBold,
  PiArrowsClockwiseBold,
} from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ErrorMessage } from "@/components/ui/error-message";
import { useVideoStore } from "@/stores/videoStore";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  if (hrs > 0) return `${hrs}:${pad2(mins)}:${pad2(secs)}`;
  return `${mins}:${pad2(secs)}`;
}

const GLOBAL_VIDEO_PLAY_EVENT = "quad:video-play";

export function VideoPlayer({
  src,
  autoPlay,
  poster,
  preload = "metadata",
  containerClassName,
  videoClassName,
  loop,
}: {
  src: string;
  autoPlay?: boolean;
  poster?: string;
  preload?: "auto" | "metadata" | "none";
  containerClassName?: string;
  videoClassName?: string;
  loop?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const playerId = useId();
  const bufferingTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("quad_video_volume");
    return saved ? parseFloat(saved) : 1;
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [buffered, setBuffered] = useState<[number, number][]>([]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRemainingTime, setShowRemainingTime] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [seekOverlay, setSeekOverlay] = useState<"forward" | "backward" | null>(
    null,
  );
  
  const { autoPlay: globalAutoPlay, autoReplay, setAutoPlay, setAutoReplay } = useVideoStore();
  const effectiveAutoPlay = autoPlay ?? globalAutoPlay;
  const isLooping = loop ?? autoReplay;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearBufferingTimer = useCallback(() => {
    if (bufferingTimerRef.current) {
      window.clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!isPlaying || settingsOpen) return;
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2500);
  }, [clearHideTimer, isPlaying, settingsOpen]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        return;
      }
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    showControls();
  }, [showControls]);

  const changeVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const v = Math.max(0, Math.min(1, value));
      video.volume = v;
      setVolume(v);
      localStorage.setItem("quad_video_volume", v.toString());
      if (v > 0 && video.muted) {
        video.muted = false;
        setIsMuted(false);
      }
      showControls();
    },
    [showControls],
  );

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(duration) || duration <= 0) return;
      const nextTime = Math.max(0, Math.min(duration, time));
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const setSpeed = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = rate;
      setPlaybackRate(rate);
      showControls();
    },
    [showControls],
  );

  const togglePiP = useCallback(async () => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestPictureInPicture?: () => Promise<unknown>;
        })
      | null;
    if (!video) return;

    try {
      const doc = document as unknown as {
        pictureInPictureEnabled?: boolean;
        pictureInPictureElement?: Element | null;
        exitPictureInPicture?: () => Promise<void>;
      };

      if (!doc.pictureInPictureEnabled || !video.requestPictureInPicture) {
        return;
      }

      if (doc.pictureInPictureElement) {
        await doc.exitPictureInPicture?.();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      return;
    } finally {
      showControls();
    }
  }, [showControls]);

  const downloadVideo = useCallback(() => {
    try {
      const a = document.createElement("a");
      a.href = src;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      return;
    }
  }, [src]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      return;
    }
    showControls();
  }, [showControls]);

  const retryLoad = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    setHasError(false);
    setIsInitialLoading(true);
  }, []);

  // Intersection Observer for Auto-Pause/Resume
  useEffect(() => {
    if (!containerRef.current) return;


    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = videoRef.current;
          if (!video) return;

          const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;

          if (isVisible) {
            if (effectiveAutoPlay && video.paused) {
              const playPromise = video.play();
              if (playPromise !== undefined) {
                playPromise.catch((err: DOMException | Error) => {
                  console.log("Autoplay blocked, attempting mute...", err);
                  // Force play muted
                  video.muted = true;
                  setIsMuted(true);
                  const retryPromise = video.play();
                  if (retryPromise !== undefined) {
                    retryPromise.catch((err2) => {
                      console.error("Autoplay completely failed after mute:", err2);
                    });
                  }
                });
              }
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [effectiveAutoPlay]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          void togglePlay();
          break;
        case "f":
          e.preventDefault();
          void toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "arrowleft":
          e.preventDefault();
          seekTo(
            videoRef.current?.currentTime
              ? videoRef.current.currentTime - 5
              : 0,
          );
          showControls();
          break;
        case "arrowright":
          e.preventDefault();
          seekTo(
            videoRef.current?.currentTime
              ? videoRef.current.currentTime + 5
              : 0,
          );
          showControls();
          break;
        case "arrowup":
          e.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          changeVolume(volume - 0.1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    toggleFullscreen,
    toggleMute,
    seekTo,
    volume,
    changeVolume,
    showControls,
  ]);

  useEffect(() => {
    const onFsChange = () => {
      const el = containerRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };

    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Apply saved volume on initial load
    video.volume = volume;

    const handleLoaded = () => {
      setIsReady(true);
      setIsInitialLoading(false);
      setHasError(false);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setIsMuted(video.muted);
      setVolume(video.volume);
      setPlaybackRate(video.playbackRate || 1);
      setIsPlaying(!video.paused);
    };

    const handleLoadStart = () => {
      setIsInitialLoading(true);
      setHasError(false);
    };

    const handleWaiting = () => {
      setIsSlowNetwork(false);
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsSlowNetwork(false);
      setIsBuffering(false);
      setIsInitialLoading(false);
    };

    const handleStalled = () => {
      setIsSlowNetwork(false);
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsSlowNetwork(false);
      setIsInitialLoading(false);
      setIsBuffering(false);
    };

    const handleError = () => {
      setHasError(true);
      setIsInitialLoading(false);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }
      // Update buffered ranges
      const b = [];
      for (let i = 0; i < video.buffered.length; i++) {
        b.push([video.buffered.start(i), video.buffered.end(i)] as [
          number,
          number,
        ]);
      }
      setBuffered(b);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      scheduleHide();

      window.dispatchEvent(
        new CustomEvent(GLOBAL_VIDEO_PLAY_EVENT, {
          detail: { id: playerId },
        }),
      );
    };

    const handlePause = () => {
      setIsPlaying(false);
      setControlsVisible(true);
      clearHideTimer();
    };

    const handleEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
        setControlsVisible(true);
      }
    };

    const handleVolume = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    const handleDuration = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.addEventListener("durationchange", handleDuration);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("volumechange", handleVolume);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("durationchange", handleDuration);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("volumechange", handleVolume);
    };
  }, [clearHideTimer, isSeeking, scheduleHide, volume, isLooping, playerId]);

  useEffect(() => {
    clearBufferingTimer();

    if (hasError) return;

    if (isInitialLoading || isBuffering) {
      bufferingTimerRef.current = window.setTimeout(() => {
        setIsSlowNetwork(true);
      }, 2500);
    }

    return () => {
      clearBufferingTimer();
    };
  }, [clearBufferingTimer, hasError, isBuffering, isInitialLoading]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onGlobalPlay = (event: Event) => {
      const ev = event as CustomEvent<{ id?: string }>;
      if (!ev.detail?.id) return;
      if (ev.detail.id === playerId) return;
      if (!video.paused) {
        video.pause();
      }
    };

    window.addEventListener(GLOBAL_VIDEO_PLAY_EVENT, onGlobalPlay);
    return () => {
      window.removeEventListener(GLOBAL_VIDEO_PLAY_EVENT, onGlobalPlay);
    };
  }, [playerId]);

  useEffect(() => {
    if (!settingsOpen) return;

    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (settingsRef.current && settingsRef.current.contains(target)) return;
      setSettingsOpen(false);
    };

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      clearBufferingTimer();
    };
  }, [clearBufferingTimer, clearHideTimer]);

  const handleMouseMoveTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = (x / rect.width) * duration;
    setHoverX(x);
    setHoverTime(time);
  };

  const handlePointerDownTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = (x / rect.width) * duration;
    setIsSeeking(true);
    setSeekValue(time);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const moveX = Math.max(
        0,
        Math.min(rect.width, moveEvent.clientX - rect.left),
      );
      setSeekValue((moveX / rect.width) * duration);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      const upX = Math.max(
        0,
        Math.min(rect.width, upEvent.clientX - rect.left),
      );
      const finalTime = (upX / rect.width) * duration;
      setIsSeeking(false);
      seekTo(finalTime);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleTap = (e: React.MouseEvent) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    const now = Date.now();
    const lastTap = lastTapRef.current;
    lastTapRef.current = now;

    if (now - lastTap < 300) {
      // Double tap detected
      if (x < width * 0.3) {
        // Left side - back 10s
        seekTo(video.currentTime - 10);
        setSeekOverlay("backward");
        setTimeout(() => setSeekOverlay(null), 600);
      } else if (x > width * 0.7) {
        // Right side - forward 10s
        seekTo(video.currentTime + 10);
        setSeekOverlay("forward");
        setTimeout(() => setSeekOverlay(null), 600);
      } else {
        void togglePlay();
      }
    } else {
      // Single tap
      void togglePlay();
      showControls();
    }
  };

  const effectiveTime = isSeeking ? seekValue : currentTime;
  const progressPct = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Video Player"
      className={cn(
        "relative bg-zinc-100 dark:bg-black group overflow-hidden w-full h-full select-none",
        containerClassName,
      )}
      onMouseMove={showControls}
      onPointerDown={showControls}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => {
        if (isPlaying && !settingsOpen) {
          setControlsVisible(false);
        }
      }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload={preload}
        loop={isLooping}
        muted={isMuted}
        playsInline
        className={cn(
          "w-full h-full object-contain bg-zinc-100 dark:bg-black",
          videoClassName,
        )}
        onClick={handleTap}
      />

      {/* Double Tap Seek Feedback Overlay */}
      <AnimatePresence>
        {seekOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-20",
              seekOverlay === "backward" ? "left-1/4" : "right-1/4",
            )}>
            <div className="bg-black/60 dark:bg-white/20 backdrop-blur-md rounded-full p-4 text-white">
              <PiArrowsClockwiseBold
                className={cn(
                  "h-8 w-8",
                  seekOverlay === "backward" && "scale-x-[-1]",
                )}
              />
            </div>
            <span className="text-white font-bold text-lg drop-shadow-lg">
              {seekOverlay === "backward" ? "-10s" : "+10s"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State Overlay */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="text-center max-w-sm mx-4">
              <ErrorMessage
                title="Failed to load video"
                description="The video could not be loaded. Please try again."
                onRetry={retryLoad}
                retryLabel="Try Again"
                showGoHome={false}
                className="min-h-0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center States (Loading, Buffering) */}
      <AnimatePresence>
        {(isInitialLoading || isBuffering) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 dark:bg-background/40 backdrop-blur-[4px] z-10">
            <div className="flex flex-col items-center gap-4 text-white dark:text-foreground text-center px-6">
              <PiSpinnerBold className="h-10 w-10 animate-spin text-primary filter drop-shadow-lg" />
              <div className="flex flex-col gap-1">
                <div className="text-base font-semibold">
                  {isSlowNetwork ? "Poor connection…" : "Loading media…"}
                </div>
                {isSlowNetwork && (
                  <div className="text-sm opacity-70 max-w-xs">
                    Trying to fetch your video. Please check your network.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Play Button Overlay */}
      <AnimatePresence>
        {!isPlaying && isReady && !isInitialLoading && !hasError && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            type="button"
            aria-label="Play Video"
            onClick={(e) => {
              e.stopPropagation();
              void togglePlay();
              showControls();
            }}
            className="absolute inset-0 flex items-center justify-center group z-10">
            <span className="flex items-center justify-center h-16 w-16 rounded-full bg-primary text-white shadow-2xl shadow-primary/40 transition-transform duration-300 group-hover:scale-110">
              <PiPlayBold className="h-8 w-8 ml-0.5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Controls Container */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 transition-all duration-500 transform",
          controlsVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none",
        )}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pb-4 pt-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent dark:from-black/95 dark:via-black/50 dark:to-transparent">
          {/* Custom Progress Bar */}
          <div
            ref={progressBarRef}
            className="relative h-1.5 group/track cursor-pointer mb-4 flex items-center"
            onMouseMove={handleMouseMoveTrack}
            onMouseEnter={() => setHoverTime(0)}
            onMouseLeave={() => setHoverTime(null)}
            onPointerDown={handlePointerDownTrack}>
            {/* Background Track */}
            <div className="absolute inset-0 bg-white/30 dark:bg-white/20 rounded-full overflow-hidden transition-all group-hover/track:h-2">
              {/* Buffer Bar */}
              {buffered.map(([start, end], i) => (
                <div
                  key={i}
                  className="absolute h-full bg-white/40 dark:bg-white/30 rounded-full"
                  style={{
                    left: `${(start / duration) * 100}%`,
                    width: `${((end - start) / duration) * 100}%`,
                  }}
                />
              ))}
            </div>

            {/* Active Progress */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-primary rounded-full z-10 transition-all group-hover/track:h-2 shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              style={{ width: `${progressPct}%` }}>
              {/* Handle */}
              <div
                className={cn(
                  "absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white dark:border-white/80 rounded-full shadow-lg transition-transform scale-0 group-hover/track:scale-100",
                  isSeeking && "scale-125",
                )}
              />
            </motion.div>

            {/* Hover Tooltip */}
            <AnimatePresence>
              {hoverTime !== null && duration > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-3 -translate-x-1/2 pointer-events-none z-20"
                  style={{ left: hoverX }}>
                  <div className="bg-white/95 dark:bg-black/85 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-black dark:text-white border border-black/10 dark:border-white/10 shadow-xl tabular-nums">
                    {formatTime(hoverTime)}
                  </div>
                  <div className="w-1.5 h-1.5 bg-white/95 dark:bg-black/85 rotate-45 absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause with morph effect simulation */}
              <button
                type="button"
                onClick={() => {
                  void togglePlay();
                  showControls();
                }}
                className="h-10 w-10 rounded-xl bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 shadow-sm border border-white/20 dark:border-white/10 text-white">
                <AnimatePresence mode="wait">
                  {isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}>
                      <PiPauseBold className="h-5 w-5 drop-shadow-md" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}>
                      <PiPlayBold className="h-5 w-5 ml-0.5 drop-shadow-md" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              <div className="flex items-center group/volume">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="h-10 w-10 rounded-xl bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 border border-white/20 dark:border-white/10 text-white">
                  {isMuted || volume === 0 ? (
                    <PiSpeakerSlashBold className="h-5 w-5" />
                  ) : (
                    <PiSpeakerHighBold className="h-5 w-5" />
                  )}
                </button>

                {/* Expandable Volume Slider */}
                <div className="w-0 group-hover/volume:w-24 group-focus-within/volume:w-24 transition-all duration-300 overflow-hidden flex items-center ml-0">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    className="w-20 ml-2 h-1 appearance-none bg-white/30 dark:bg-white/20 rounded-full outline-none accent-white cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRemainingTime(!showRemainingTime)}
                className="text-xs font-bold tabular-nums text-white hover:text-white/80 transition-colors py-1 px-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/10">
                {formatTime(currentTime)}{" "}
                <span className="text-white/40 mx-0.5">/</span>{" "}
                {showRemainingTime
                  ? `-${formatTime(duration - currentTime)}`
                  : formatTime(duration)}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Picture-in-Picture Button (High Priority) */}
              <button
                type="button"
                aria-label="Picture in Picture"
                onClick={togglePiP}
                className="h-10 w-10 rounded-xl bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 border border-white/20 dark:border-white/10 text-white">
                <PiAirplayBold className="h-5 w-5" />
              </button>

              <div ref={settingsRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(!settingsOpen);
                    showControls();
                  }}
                  className={cn(
                    "h-10 w-10 rounded-xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 border shadow-sm",
                    settingsOpen
                      ? "bg-primary text-white border-primary shadow-primary/20"
                      : "bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 text-white border-white/20 dark:border-white/10",
                  )}>
                  <PiGearBold
                    className={cn(
                      "h-5 w-5 transition-transform duration-500",
                      settingsOpen && "rotate-90",
                    )}
                  />
                </button>

                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-full right-0 mb-3 w-60 rounded-2xl bg-white/95 dark:bg-black/85 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden z-40 p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          downloadVideo();
                          setSettingsOpen(false);
                        }}
                        className="w-full px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors text-black dark:text-white">
                        <PiDownloadSimpleBold className="h-5 w-5 opacity-70" />
                        <span className="font-semibold">Download Archive</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAutoPlay(!globalAutoPlay);
                        }}
                        className="w-full px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 rounded-xl flex items-center justify-between transition-colors text-black dark:text-white">
                        <div className="flex items-center gap-3">
                          <PiPlayBold
                            className={cn(
                              "h-5 w-5 transition-transform duration-500",
                              !globalAutoPlay && "opacity-70",
                            )}
                          />
                          <span className="font-semibold">Auto Play</span>
                        </div>
                        <div
                          className={cn(
                            "h-5 w-9 rounded-full transition-colors relative flex items-center px-1",
                            globalAutoPlay ? "bg-primary" : "bg-black/20 dark:bg-white/20",
                          )}>
                          <motion.div
                            animate={{ x: globalAutoPlay ? 16 : 0 }}
                            className="h-3 w-3 rounded-full bg-white shadow-sm"
                          />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAutoReplay(!autoReplay);
                        }}
                        className="w-full px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 rounded-xl flex items-center justify-between transition-colors text-black dark:text-white">
                        <div className="flex items-center gap-3">
                          <PiArrowsClockwiseBold
                            className={cn(
                              "h-5 w-5 transition-transform duration-500",
                              autoReplay && "rotate-180",
                              !autoReplay && "opacity-70",
                            )}
                          />
                          <span className="font-semibold">Auto Replay</span>
                        </div>
                        <div
                          className={cn(
                            "h-5 w-9 rounded-full transition-colors relative flex items-center px-1",
                            autoReplay ? "bg-primary" : "bg-black/20 dark:bg-white/20",
                          )}>
                          <motion.div
                            animate={{ x: autoReplay ? 16 : 0 }}
                            className="h-3 w-3 rounded-full bg-white shadow-sm"
                          />
                        </div>
                      </button>

                      <div className="my-1.5 h-px bg-black/5 dark:bg-white/5" />

                      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-black text-black/40 dark:text-white/40 mb-1">
                        Playback Speed
                      </div>
                      <div className="grid grid-cols-3 gap-1 px-1 mb-1">
                        {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setSpeed(rate)}
                            className={cn(
                              "py-2 text-xs rounded-lg transition-all flex flex-col items-center justify-center gap-1",
                              Math.abs(playbackRate - rate) < 0.001
                                ? "bg-primary text-white font-bold shadow-lg shadow-primary/10"
                                : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10",
                            )}>
                            <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                            {Math.abs(playbackRate - rate) < 0.001 && (
                              <PiCheckBold className="h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="h-10 w-10 rounded-xl bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 border border-white/20 dark:border-white/10 text-white">
                {isFullscreen ? (
                  <PiCornersInBold className="h-5 w-5" />
                ) : (
                  <PiCornersOutBold className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-video-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid hsl(var(--primary));
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
