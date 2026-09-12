import { useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  IoIosClose,
  IoMdSkipBackward,
  IoMdSkipForward,
} from "react-icons/io";

import { IoShareSocial } from "react-icons/io5";

import {
  PiShuffleBold,
  PiSpeakerLowFill,
} from "react-icons/pi";

import {
  LuRepeat,
  LuRepeat1,
} from "react-icons/lu";

import {
  FaPlay,
  FaPause,
  FaHeart,
  FaRegHeart,
} from "react-icons/fa";

import {
  MdDownload,
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

import { CiMaximize1 } from "react-icons/ci";

import { Link } from "react-router-dom";

import MusicContext from "../context/MusicContext";
import ArtistItems from "./Items/ArtistItems";
import SongGrid from "./SongGrid";

import {
  getSongById,
  getSuggestionSong,
} from "../../fetch";

import he from "he";


const Player = () => {
  const {
    currentSong,
    song,
    playMusic,
    isPlaying,
    shuffle,
    nextSong,
    prevSong,
    toggleShuffle,
    repeatMode,
    toggleRepeatMode,
    downloadSong,
  } = useContext(MusicContext);


  // =========================================================
  // STATE
  // =========================================================

  const [volume, setVolume] = useState(() => {
    try {
      const savedVolume = localStorage.getItem("volume");

      if (savedVolume === null) {
        return 100;
      }

      const value = Number(savedVolume);

      if (!Number.isFinite(value)) {
        return 100;
      }

      return Math.min(100, Math.max(0, value));
    } catch (error) {
      console.error("Volume load error:", error);
      return 100;
    }
  });


  const [isMaximized, setIsMaximized] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);

  const [detail, setDetail] = useState(null);

  const [suggestions, setSuggestions] = useState([]);

  const [likedSongs, setLikedSongs] = useState(() => {
    try {
      const saved = localStorage.getItem("likedSongs");

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Liked songs load error:", error);
      return [];
    }
  });


  // =========================================================
  // REFS
  // =========================================================

  const progressRef = useRef(null);

  const scrollRef = useRef(null);


  // =========================================================
  // CURRENT SONG VALUES
  // =========================================================

  const songName = useMemo(() => {
    if (!currentSong?.name) {
      return "Unknown Title";
    }

    try {
      return he.decode(String(currentSong.name));
    } catch {
      return String(currentSong.name);
    }
  }, [currentSong?.name]);


  const artistNames = useMemo(() => {
    const artists = currentSong?.artists?.primary;

    if (!Array.isArray(artists) || artists.length === 0) {
      return "Unknown Artist";
    }

    return artists
      .map((artist) => artist?.name || "Unknown Artist")
      .join(", ");
  }, [currentSong?.artists]);


  const duration = useMemo(() => {
    const apiDuration = Number(currentSong?.duration);

    if (Number.isFinite(apiDuration) && apiDuration > 0) {
      return apiDuration;
    }

    const audioDuration = Number(currentSong?.audio?.duration);

    return Number.isFinite(audioDuration) && audioDuration > 0
      ? audioDuration
      : 0;
  }, [currentSong?.duration, currentSong?.audio?.duration]);


  const progress = useMemo(() => {
    if (duration <= 0) {
      return 0;
    }

    const value = (currentTime / duration) * 100;

    return Math.min(100, Math.max(0, value));
  }, [currentTime, duration]);


  const isLiked = useMemo(() => {
    if (!currentSong?.id) {
      return false;
    }

    return likedSongs.some(
      (item) => item?.id === currentSong.id
    );
  }, [likedSongs, currentSong?.id]);


  // =========================================================
  // THEME
  // =========================================================

  const theme =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : "light";


  // =========================================================
  // PLAY / PAUSE
  // =========================================================

  const handlePlayPause = () => {
    if (!currentSong) {
      return;
    }

    const audio = currentSong?.audio;

    const audioUrl =
      audio?.currentSrc ||
      audio?.src ||
      currentSong?.url ||
      currentSong?.downloadUrl ||
      "";

    if (!audioUrl) {
      console.error("Audio URL not found.");
      return;
    }

    playMusic(
      audioUrl,
      currentSong.name,
      currentSong.duration,
      currentSong.image,
      currentSong.id,
      song
    );
  };


  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (time) => {
    const value = Number(time);

    if (!Number.isFinite(value) || value < 0) {
      return "00:00";
    }

    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, "0");

    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${seconds}`;
  };


  // =========================================================
  // PLAYER VISIBILITY
  // =========================================================

  useEffect(() => {
    setCurrentTime(0);

    if (!currentSong) {
      setIsMaximized(false);
    }
  }, [currentSong?.id]);


  // =========================================================
  // AUDIO TIME UPDATE
  // =========================================================

  useEffect(() => {
    const audio = currentSong?.audio;

    if (!audio) {
      setCurrentTime(0);
      return undefined;
    }


    const updateTime = () => {
      const time = Number(audio.currentTime);

      const safeTime =
        Number.isFinite(time) && time >= 0
          ? time
          : 0;

      setCurrentTime(safeTime);


      if (progressRef.current && duration > 0) {
        const percentage =
          (safeTime / duration) * 100;

        const safePercentage = Math.min(
          100,
          Math.max(0, percentage)
        );

        progressRef.current.value =
          safePercentage;

        progressRef.current.style.setProperty(
          "--progress",
          `${safePercentage}%`
        );
      }
    };


    const updateDuration = () => {
      const audioDuration = Number(audio.duration);

      if (
        Number.isFinite(audioDuration) &&
        audioDuration > 0 &&
        (!Number.isFinite(Number(currentSong?.duration)) ||
          Number(currentSong?.duration) <= 0)
      ) {
        // The progress UI uses audio.duration when the API does not provide one.
        setCurrentTime((previous) =>
          Math.min(previous, audioDuration)
        );
      }

      updateTime();
    };

    const handleEnded = () => {
      if (!currentSong?.id || repeatMode === "one") {
        return;
      }

      nextSong();
    };

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", handleEnded);

    updateDuration();

    return () => {
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [
    currentSong?.audio,
    currentSong?.id,
    currentSong?.duration,
    duration,
    nextSong,
    repeatMode,
  ]);


  // =========================================================
  // VOLUME
  // =========================================================

  useEffect(() => {
    const audio = currentSong?.audio;

    if (!audio) {
      return;
    }

    audio.volume = volume / 100;
  }, [
    currentSong?.audio,
    volume,
  ]);


  // =========================================================
  // REPEAT MODE
  // =========================================================

  useEffect(() => {
    const audio = currentSong?.audio;

    if (!audio) {
      return;
    }

    audio.loop = repeatMode === "one";
  }, [
    currentSong?.audio,
    repeatMode,
  ]);


  // =========================================================
  // PROGRESS CHANGE
  // =========================================================

  const handleProgressChange = (event) => {
    const audio = currentSong?.audio;

    if (!audio || duration <= 0) {
      return;
    }

    const percentage =
      Number(event.target.value);

    if (!Number.isFinite(percentage)) {
      return;
    }

    const newTime =
      (percentage / 100) * duration;


    audio.currentTime = Math.min(
      duration,
      Math.max(0, newTime)
    );

    setCurrentTime(audio.currentTime);
  };


  // =========================================================
  // VOLUME CHANGE
  // =========================================================

  const handleVolumeChange = (event) => {
    const newVolume =
      Number(event.target.value);

    if (!Number.isFinite(newVolume)) {
      return;
    }

    const safeVolume = Math.min(
      100,
      Math.max(0, newVolume)
    );

    setVolume(safeVolume);

    try {
      localStorage.setItem(
        "volume",
        String(safeVolume)
      );
    } catch (error) {
      console.error("Failed to save volume:", error);
    }


    if (currentSong?.audio) {
      currentSong.audio.volume =
        safeVolume / 100;
    }
  };


  // =========================================================
  // MAXIMIZE
  // =========================================================

  const handleMaximized = () => {
    setIsMaximized(
      (previous) => !previous
    );
  };


  // =========================================================
  // LOAD SONG DETAILS
  // =========================================================

  useEffect(() => {
    let cancelled = false;


    const loadDetails = async () => {
      if (!currentSong?.id) {
        setDetail(null);
        return;
      }


      try {
        const result =
          await getSongById(currentSong.id);


        if (cancelled) {
          return;
        }


        const data =
          result?.data?.[0] || null;

        setDetail(data);
      } catch (error) {
        console.error(
          "Failed to load song details:",
          error
        );

        if (!cancelled) {
          setDetail(null);
        }
      }
    };


    loadDetails();


    return () => {
      cancelled = true;
    };
  }, [currentSong?.id]);


  // =========================================================
  // LOAD SUGGESTIONS
  // =========================================================

  useEffect(() => {
    let cancelled = false;


    const loadSuggestions = async () => {
      if (!currentSong?.id) {
        setSuggestions([]);
        return;
      }


      try {
        const result =
          await getSuggestionSong(
            currentSong.id
          );


        if (cancelled) {
          return;
        }


        const data =
          Array.isArray(result?.data)
            ? result.data
            : [];


        setSuggestions(data);
      } catch (error) {
        console.error(
          "Failed to load suggestions:",
          error
        );

        if (!cancelled) {
          setSuggestions([]);
        }
      }
    };


    loadSuggestions();


    return () => {
      cancelled = true;
    };
  }, [currentSong?.id]);


  // =========================================================
  // LIKE SONG
  // =========================================================

  const toggleLikeSong = () => {
    if (!currentSong?.id) {
      return;
    }


    const audio =
      currentSong?.audio;


    const songData = {
      id: currentSong.id,
      name: currentSong.name || "",
      audio:
        audio?.currentSrc ||
        audio?.src ||
        currentSong?.url ||
        "",
      duration:
        currentSong.duration || 0,
      image:
        currentSong.image || "",
      artists:
        currentSong.artists || {},
    };


    const alreadyLiked =
      likedSongs.some(
        (item) =>
          item?.id === currentSong.id
      );


    const updatedSongs =
      alreadyLiked
        ? likedSongs.filter(
            (item) =>
              item?.id !== currentSong.id
          )
        : [
            ...likedSongs,
            songData,
          ];


    setLikedSongs(updatedSongs);


    try {
      localStorage.setItem(
        "likedSongs",
        JSON.stringify(updatedSongs)
      );
    } catch (error) {
      console.error(
        "Failed to save liked songs:",
        error
      );
    }
  };


  // =========================================================
  // SCROLL LEFT
  // =========================================================

  const scrollLeft = () => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollBy({
      left: -500,
      behavior: "smooth",
    });
  };


  // =========================================================
  // SCROLL RIGHT
  // =========================================================

  const scrollRight = () => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollBy({
      left: 500,
      behavior: "smooth",
    });
  };


  // =========================================================
  // SHARE
  // =========================================================

  const handleShare = async () => {
    if (!currentSong) {
      return;
    }


    const albumId =
      detail?.album?.id ||
      currentSong?.album?.id;


    const shareUrl = albumId
      ? `${window.location.origin}/albums/${albumId}`
      : window.location.href;


    const shareData = {
      title: songName,
      text: `Listen to ${songName} on Musify`,
      url: shareUrl,
    };


    try {
      if (
        navigator.share &&
        typeof navigator.share === "function"
      ) {
        await navigator.share(
          shareData
        );

        return;
      }


      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          shareUrl
        );

        console.log(
          "Share URL copied to clipboard."
        );
      }
    } catch (error) {
      if (
        error?.name !==
        "AbortError"
      ) {
        console.error(
          "Share failed:",
          error
        );
      }
    }
  };


  // =========================================================
  // MEDIA SESSION
  // =========================================================

  useEffect(() => {
    if (
      !currentSong ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata ===
        "undefined"
    ) {
      return undefined;
    }


    try {
      navigator.mediaSession.metadata =
        new MediaMetadata({
          title: songName,

          artist:
            artistNames,

          album:
            detail?.album?.name ||
            "Musify",

          artwork:
            currentSong?.image
              ? [
                  {
                    src:
                      currentSong.image,

                    sizes:
                      "500x500",

                    type:
                      "image/jpeg",
                  },
                ]
              : [],
        });


      const playHandler = () => {
        handlePlayPause();
      };


      const pauseHandler = () => {
        handlePlayPause();
      };


      const previousHandler = () => {
        prevSong();
      };


      const nextHandler = () => {
        nextSong();
      };


      try {
        navigator.mediaSession.setActionHandler(
          "play",
          playHandler
        );
      } catch (error) {
        console.warn(
          "MediaSession play unsupported:",
          error
        );
      }


      try {
        navigator.mediaSession.setActionHandler(
          "pause",
          pauseHandler
        );
      } catch (error) {
        console.warn(
          "MediaSession pause unsupported:",
          error
        );
      }


      try {
        navigator.mediaSession.setActionHandler(
          "previoustrack",
          previousHandler
        );
      } catch (error) {
        console.warn(
          "MediaSession previous unsupported:",
          error
        );
      }


      try {
        navigator.mediaSession.setActionHandler(
          "nexttrack",
          nextHandler
        );
      } catch (error) {
        console.warn(
          "MediaSession next unsupported:",
          error
        );
      }


      return () => {
        try {
          navigator.mediaSession.setActionHandler(
            "play",
            null
          );
        } catch {}


        try {
          navigator.mediaSession.setActionHandler(
            "pause",
            null
          );
        } catch {}


        try {
          navigator.mediaSession.setActionHandler(
            "previoustrack",
            null
          );
        } catch {}


        try {
          navigator.mediaSession.setActionHandler(
            "nexttrack",
            null
          );
        } catch {}
      };
    } catch (error) {
      console.error(
        "MediaSession error:",
        error
      );
    }


    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSong?.id,
    currentSong?.image,
    songName,
    artistNames,
    detail?.album?.name,
    isPlaying,
  ]);


  // =========================================================
  // NO CURRENT SONG
  // =========================================================

  if (!currentSong) {
    return null;
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="
        fixed
        bottom-14
        lg:bottom-0
        left-0
        w-screen
        z-20
        flex
        justify-center
        items-center
      "
    >
      <div
        className={`
          flex
          flex-col
          w-screen
          bg-auto
          rounded-tl-xl
          rounded-tr-xl
          relative
          transition-all
          ease-in-out
          duration-500

          ${
            isMaximized
              ? "pt-4 backdrop-brightness-[0.4]"
              : "lg:h-[6rem] h-auto p-4 Player"
          }
        `}
      >
        {/* =====================================================
            MINI PLAYER
        ====================================================== */}

        {!isMaximized && (
          <>
            {/* PROGRESS */}

            <div
              className="
                flex
                items-center
                w-full
                mb-4
                gap-3
                h-0
              "
            >
              <span className="text-xs">
                {formatTime(
                  currentTime
                )}
              </span>


              <input
                ref={progressRef}
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={
                  handleProgressChange
                }
                className="
                  range
                  flex-1
                "
                style={{
                  background: `
                    linear-gradient(
                      to right,
                      ${
                        theme === "dark"
                          ? "#ddd"
                          : "#09090B"
                      }
                      ${progress}%,

                      ${
                        theme === "dark"
                          ? "#252525"
                          : "#dddddd"
                      }
                      ${progress}%
                    )
                  `,
                }}
              />


              <span className="text-xs">
                {formatTime(
                  duration
                )}
              </span>
            </div>


            {/* PLAYER CONTENT */}

            <div
              className="
                flex
                justify-between
                items-center
                mb-4
              "
            >
              {/* SONG */}

              <div
                className="
                  flex
                  w-full
                  lg:w-auto
                  cursor-pointer
                "
                onClick={
                  handleMaximized
                }
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <img
                    src={
                      currentSong?.image ||
                      "/Unknown.png"
                    }
                    alt={songName}
                    width="55"
                    height="55"
                    className="
                      rounded
                      object-cover
                    "
                  />


                  <div
                    className="
                      flex
                      flex-col
                      overflow-hidden
                      p-1
                      w-[14rem]
                      h-[2.9rem]
                    "
                  >
                    <span
                      className="
                        h-[1.5rem]
                        overflow-hidden
                        whitespace-nowrap
                      "
                    >
                      {songName}
                    </span>


                    <span
                      className="
                        text-xs
                        overflow-hidden
                        whitespace-nowrap
                      "
                    >
                      {artistNames}
                    </span>
                  </div>
                </div>
              </div>


              {/* CONTROLS */}

              <div
                className="
                  flex
                  items-center
                  justify-center
                "
              >
                <div
                  className="
                    flex
                    gap-5
                    items-center
                  "
                >
                  {/* REPEAT */}

                  {repeatMode === "none" ? (
                    <LuRepeat
                      className="
                        text-2xl
                        hidden
                        lg:block
                        cursor-pointer
                        hover:text-[#ff3448]
                      "
                      onClick={
                        toggleRepeatMode
                      }
                      title="Repeat"
                    />
                  ) : (
                    <LuRepeat1
                      className="
                        text-2xl
                        hidden
                        lg:block
                        cursor-pointer
                        text-[#ff3448]
                      "
                      onClick={
                        toggleRepeatMode
                      }
                      title="Repeat One"
                    />
                  )}


                  {/* PREVIOUS */}

                  <IoMdSkipBackward
                    className="
                      icon
                      hidden
                      lg:block
                      hover:scale-110
                      text-2xl
                      cursor-pointer
                    "
                    onClick={
                      prevSong
                    }
                  />


                  {/* PLAY PAUSE */}

                  <div
                    className="
                      rounded-full
                      p-2
                    "
                  >
                    {isPlaying ? (
                      <FaPause
                        className="
                          p-[0.1rem]
                          icon
                          hover:scale-110
                          text-xl
                          lg:text-2xl
                          cursor-pointer
                        "
                        onClick={
                          handlePlayPause
                        }
                      />
                    ) : (
                      <FaPlay
                        className="
                          icon
                          p-[0.1rem]
                          hover:scale-110
                          text-xl
                          lg:text-2xl
                          cursor-pointer
                        "
                        onClick={
                          handlePlayPause
                        }
                      />
                    )}
                  </div>


                  {/* NEXT */}

                  <IoMdSkipForward
                    className="
                      icon
                      hidden
                      lg:block
                      hover:scale-110
                      text-2xl
                      cursor-pointer
                    "
                    onClick={
                      nextSong
                    }
                  />


                  {/* SHUFFLE */}

                  <PiShuffleBold
                    className={`
                      hidden
                      lg:block
                      hover:text-[#fd3a4e]
                      text-2xl
                      cursor-pointer

                      ${
                        shuffle
                          ? "text-[#fd3a4e]"
                          : ""
                      }
                    `}
                    onClick={
                      toggleShuffle
                    }
                    title="Shuffle"
                  />
                </div>
              </div>


              {/* DESKTOP ACTIONS */}

              <div
                className="
                  lg:flex
                  hidden
                  items-center
                  gap-5
                  justify-end
                "
              >
                {/* LIKE */}

                <button
                  type="button"
                  onClick={
                    toggleLikeSong
                  }
                  title={
                    isLiked
                      ? "Unlike Song"
                      : "Like Song"
                  }
                >
                  {isLiked ? (
                    <FaHeart
                      className="
                        text-red-500
                      "
                    />
                  ) : (
                    <FaRegHeart
                      className="icon"
                    />
                  )}
                </button>


                {/* DOWNLOAD */}

                <MdDownload
                  className="
                    hover:text-[#fd3a4e]
                    icon
                    text-2xl
                    cursor-pointer
                  "
                  onClick={
                    downloadSong
                  }
                  title="Download Song"
                />


                {/* VOLUME */}

                <div
                  className="
                    items-center
                    gap-1
                    flex
                  "
                >
                  <PiSpeakerLowFill
                    className="text-xl"
                  />


                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={volume}
                    onChange={
                      handleVolumeChange
                    }
                    className="
                      volume
                      icon
                      rounded-lg
                      appearance-none
                      cursor-pointer
                      w-[80px]
                      h-1
                    "
                    style={{
                      background: `
                        linear-gradient(
                          to right,
                          ${
                            theme === "dark"
                              ? "#ddd"
                              : "#09090B"
                          }
                          ${volume}%,

                          ${
                            theme === "dark"
                              ? "#252525"
                              : "#dddddd"
                          }
                          ${volume}%
                        )
                      `,
                    }}
                    title="Volume"
                  />
                </div>


                {/* MAXIMIZE */}

                <CiMaximize1
                  title="Maximize"
                  className="
                    icon
                    p-1
                    text-2xl
                    rounded
                    cursor-pointer
                  "
                  onClick={
                    handleMaximized
                  }
                />
              </div>
            </div>
          </>
        )}


        {/* =====================================================
            MAXIMIZED PLAYER
        ====================================================== */}

        {isMaximized && (
          <div
            className="
              flex
              w-full
              flex-col
              p-2
              lg:h-[40rem]
              h-[45rem]
              gap-4
              scroll-hide
              overflow-y-scroll
              rounded-tl-2xl
              rounded-tr-2xl
              Player
            "
          >
            {/* CLOSE */}

            <div
              className="
                flex
                w-full
                justify-end
              "
            >
              <IoIosClose
                className="
                  icon
                  text-[3rem]
                  cursor-pointer
                "
                onClick={
                  handleMaximized
                }
                title="Close"
              />
            </div>


            {/* MAIN SONG */}

            <div
              className="
                flex
                lg:flex-row
                flex-col
              "
            >
              {/* IMAGE */}

              <div
                className="
                  flex
                  justify-center
                  items-center
                  lg:pl-[2.5rem]
                "
              >
                <img
                  src={
                    currentSong?.image ||
                    "/Unknown.png"
                  }
                  alt={songName}
                  className="
                    h-[22rem]
                    lg:h-[17rem]
                    w-auto
                    rounded-lg
                    object-cover
                    shadow-2xl
                    profile
                  "
                  onError={(event) => {
                    event.currentTarget.src = "/Unknown.png";
                  }}
                />
              </div>


              {/* SONG INFORMATION */}

              <div
                className="
                  flex
                  flex-col
                  justify-center
                  lg:w-[70%]
                  lg:pl-5
                  p-1
                  gap-4
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    gap-2
                    mt-5
                    lg:ml-1
                    ml-[1.5rem]
                  "
                >
                  {/* TITLE */}

                  <span
                    className="
                      text-2xl
                      font-semibold
                      break-words
                    "
                  >
                    {songName}
                  </span>


                  {/* ARTIST + ACTIONS */}

                  <div
                    className="
                      flex
                      w-[98%]
                      mb-1
                      text-base
                      font-medium
                      justify-between
                      items-center
                    "
                  >
                    <span
                      className="
                        truncate
                      "
                    >
                      {artistNames}
                    </span>


                    <span
                      className="
                        flex
                        gap-3
                        items-center
                        ml-3
                      "
                    >
                      {/* LIKE */}

                      <button
                        type="button"
                        onClick={
                          toggleLikeSong
                        }
                        title={
                          isLiked
                            ? "Unlike Song"
                            : "Like Song"
                        }
                      >
                        {isLiked ? (
                          <FaHeart
                            className="
                              text-red-500
                              text-2xl
                            "
                          />
                        ) : (
                          <FaRegHeart
                            className="
                              icon
                              text-2xl
                              hover:text-red-500
                            "
                          />
                        )}
                      </button>


                      {/* DOWNLOAD */}

                      <MdDownload
                        className="
                          text-[1.8rem]
                          cursor-pointer
                          icon
                          hover:text-[#fd3a4e]
                        "
                        onClick={
                          downloadSong
                        }
                        title="Download Song"
                      />
                    </span>
                  </div>
                </div>


                {/* PROGRESS */}

                <div
                  className="
                    flex
                    items-center
                    w-full
                    gap-3
                  "
                >
                  <span
                    className="
                      lg:hidden
                      block
                      text-xs
                    "
                  >
                    {formatTime(
                      currentTime
                    )}
                  </span>


                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={progress}
                    onChange={
                      handleProgressChange
                    }
                    className="
                      range
                      flex-1
                    "
                    style={{
                      background: `
                        linear-gradient(
                          to right,

                          ${
                            theme === "dark"
                              ? "#ddd"
                              : "#252525"
                          }
                          ${progress}%,

                          ${
                            theme === "dark"
                              ? "#252525"
                              : "#dddddd"
                          }
                          ${progress}%
                        )
                      `,
                    }}
                  />


                  <span
                    className="
                      lg:hidden
                      block
                      text-xs
                    "
                  >
                    {formatTime(
                      duration
                    )}
                  </span>
                </div>


                {/* CONTROLS */}

                <div
                  className="
                    flex
                    items-center
                    justify-center
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-5
                      p-8
                    "
                  >
                    {/* REPEAT */}

                    {repeatMode === "none" ? (
                      <LuRepeat
                        className="
                          text-2xl
                          cursor-pointer
                          hover:text-[#ff3448]
                        "
                        onClick={
                          toggleRepeatMode
                        }
                        title="Repeat"
                      />
                    ) : (
                      <LuRepeat1
                        className="
                          text-2xl
                          cursor-pointer
                          text-[#ff3448]
                        "
                        onClick={
                          toggleRepeatMode
                        }
                        title="Repeat One"
                      />
                    )}


                    {/* PREVIOUS */}

                    <IoMdSkipBackward
                      className="
                        icon
                        hover:scale-110
                        text-3xl
                        cursor-pointer
                      "
                      onClick={
                        prevSong
                      }
                      title="Previous"
                    />


                    {/* PLAY / PAUSE */}

                    {isPlaying ? (
                      <FaPause
                        className="
                          p-[0.1rem]
                          icon
                          hover:scale-110
                          text-3xl
                          cursor-pointer
                        "
                        onClick={
                          handlePlayPause
                        }
                        title="Pause"
                      />
                    ) : (
                      <FaPlay
                        className="
                          icon
                          p-[0.1rem]
                          hover:scale-110
                          text-3xl
                          cursor-pointer
                        "
                        onClick={
                          handlePlayPause
                        }
                        title="Play"
                      />
                    )}


                    {/* NEXT */}

                    <IoMdSkipForward
                      className="
                        icon
                        hover:scale-110
                        text-3xl
                        cursor-pointer
                      "
                      onClick={
                        nextSong
                      }
                      title="Next"
                    />


                    {/* SHUFFLE */}

                    <PiShuffleBold
                      className={`
                        text-3xl
                        cursor-pointer
                        hover:text-[#fd3a4e]

                        ${
                          shuffle
                            ? "text-[#fd3a4e]"
                            : ""
                        }
                      `}
                      onClick={
                        toggleShuffle
                      }
                      title="Shuffle"
                    />
                  </div>


                  {/* SHARE */}

                  <IoShareSocial
                    className="
                      icon
                      text-3xl
                      hidden
                      lg:block
                      cursor-pointer
                      hover:scale-105
                      mr-4
                    "
                    onClick={
                      handleShare
                    }
                    title="Share"
                  />
                </div>
              </div>
            </div>


            {/* =================================================
                SUGGESTIONS
            ================================================== */}

            {suggestions.length > 0 && (
              <div
                className="
                  flex
                  flex-col
                  justify-center
                  items-center
                  w-full
                "
              >
                <h2
                  className="
                    m-4
                    text-xl
                    lg:text-2xl
                    font-semibold
                    w-full
                    ml-[2.5rem]
                    lg:ml-[5.5rem]
                  "
                >
                  You Might Like
                </h2>


                <div
                  className="
                    flex
                    justify-center
                    items-center
                    gap-3
                    w-full
                  "
                >
                  {/* LEFT */}

                  <MdOutlineKeyboardArrowLeft
                    className="
                      text-3xl
                      hover:scale-125
                      cursor-pointer
                      h-[9rem]
                      hidden
                      lg:block
                      arrow-btn
                    "
                    onClick={
                      scrollLeft
                    }
                  />


                  {/* SONG LIST */}

                  <div
                    ref={scrollRef}
                    className="
                      grid
                      grid-rows-1
                      grid-flow-col
                      justify-start
                      overflow-x-scroll
                      scroll-hide
                      items-center
                      gap-3
                      lg:gap-[.35rem]
                      w-full
                      px-3
                      lg:px-0
                      scroll-smooth
                    "
                  >
                    {suggestions.map(
                      (
                        suggestion,
                        index
                      ) => (
                        <SongGrid
                          key={
                            suggestion?.id ||
                            index
                          }
                          {...suggestion}
                          song={
                            suggestions
                          }
                        />
                      )
                    )}
                  </div>


                  {/* RIGHT */}

                  <MdOutlineKeyboardArrowRight
                    className="
                      text-3xl
                      hover:scale-125
                      cursor-pointer
                      h-[9rem]
                      hidden
                      lg:block
                      arrow-btn
                    "
                    onClick={
                      scrollRight
                    }
                  />
                </div>
              </div>
            )}


            {/* =================================================
                ARTISTS
            ================================================== */}

            {currentSong?.artists?.primary
              ?.length > 0 && (
              <div
                className="
                  flex
                  flex-col
                  pt-3
                "
              >
                <h2
                  className="
                    text-xl
                    lg:text-2xl
                    font-semibold
                    w-full
                    ml-[2rem]
                    lg:ml-[3.5rem]
                    mb-3
                  "
                >
                  Artists
                </h2>


                <div
                  className="
                    grid
                    grid-flow-col
                    lg:w-max
                    w-full
                    scroll-smooth
                    gap-[1rem]
                    lg:gap-[1.5rem]
                    lg:pl-[2rem]
                    pl-[1rem]
                    overflow-x-scroll
                    scroll-hide
                  "
                >
                  {currentSong.artists.primary.map(
                    (
                      artist,
                      index
                    ) => (
                      <ArtistItems
                        key={
                          artist?.id ||
                          index
                        }
                        {...artist}
                      />
                    )
                  )}
                </div>
              </div>
            )}


            {/* =================================================
                ALBUM
            ================================================== */}

            {detail?.album?.id && (
              <div
                className="
                  flex
                  flex-col
                  lg:flex-row
                  gap-[2rem]
                "
              >
                <div
                  className="
                    flex
                    flex-col
                  "
                >
                  <h2
                    className="
                      text-xl
                      lg:text-2xl
                      font-semibold
                      w-full
                      ml-[2rem]
                      lg:ml-[3.5rem]
                    "
                  >
                    From Album...
                  </h2>


                  <Link
                    to={`/albums/${detail.album.id}`}
                    className="
                      card
                      w-[12.5rem]
                      h-fit
                      overflow-hidden
                      border-[0.1px]
                      p-1
                      rounded-lg
                      lg:mx-[2rem]
                      mt-[1rem]
                    "
                  >
                    <div className="p-1">
                      <img
                        src={
                          detail?.album
                            ?.image?.[0]
                            ?.url ||
                          currentSong?.image ||
                          "/Unknown.png"
                        }
                        alt={
                          detail?.album
                            ?.name ||
                          songName
                        }
                        className="
                          rounded-lg
                          w-full
                        "
                      />
                    </div>


                    <div
                      className="
                        w-full
                        flex
                        flex-col
                        justify-center
                        pl-2
                        pb-2
                      "
                    >
                      <span
                        className="
                          font-semibold
                          text-[1.1rem]
                          overflow-hidden
                        "
                      >
                        {detail?.album?.name
                          ? he.decode(
                              detail.album.name
                            )
                          : "Unknown Album"}
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export default Player;
