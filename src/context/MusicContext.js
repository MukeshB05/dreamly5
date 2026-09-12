// src/context/MusicContext.jsx

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const MusicContext = createContext(null);

const LRCLIB_BASE_URL = "https://lrclib.net/api";

/* =========================================================
   HELPERS
========================================================= */

const getFirstValue = (...values) => {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return "";
};

const cleanText = (value = "") => {
  return String(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const getArtist = (track = {}) => {
  if (typeof track.artist === "string") {
    return track.artist;
  }

  if (typeof track.artists === "string") {
    return track.artists;
  }

  if (Array.isArray(track.artists)) {
    return track.artists
      .map((artist) => {
        if (typeof artist === "string") {
          return artist;
        }

        return artist?.name || "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (
    Array.isArray(
      track.artists?.primary
    )
  ) {
    return track.artists.primary
      .map((artist) => artist?.name || "")
      .filter(Boolean)
      .join(", ");
  }

  if (
    Array.isArray(
      track.artists?.all
    )
  ) {
    return track.artists.all
      .map((artist) => artist?.name || "")
      .filter(Boolean)
      .join(", ");
  }

  return getFirstValue(
    track.primaryArtists,
    track.primary_artists,
    track.singers,
    track.subtitle,
    "Unknown Artist"
  );
};

const getImage = (track = {}) => {
  const image = getFirstValue(
    track.image,
    track.coverImage,
    track.cover_image,
    track.thumbnail,
    track.thumbnailUrl,
    track.imageUrl,
    track.image_url,
    track.album?.image,
    track.album?.cover,
    track.album?.coverImage
  );

  if (Array.isArray(image)) {
    const last =
      image[image.length - 1];

    if (typeof last === "string") {
      return last;
    }

    return (
      last?.url ||
      last?.link ||
      ""
    );
  }

  if (
    typeof image === "object" &&
    image !== null
  ) {
    return (
      image.url ||
      image.link ||
      image.src ||
      ""
    );
  }

  return image || "";
};

const getAudioUrl = (track = {}) => {
  const value = getFirstValue(
    track.audio,
    track.audioUrl,
    track.audio_url,
    track.downloadUrl,
    track.download_url,
    track.url,
    track.mediaUrl,
    track.media_url,
    track.streamUrl,
    track.stream_url
  );

  if (Array.isArray(value)) {
    const last =
      value[value.length - 1];

    if (typeof last === "string") {
      return last;
    }

    return (
      last?.url ||
      last?.link ||
      last?.downloadUrl ||
      ""
    );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return (
      value.url ||
      value.link ||
      value.downloadUrl ||
      ""
    );
  }

  return value || "";
};

const getDuration = (track = {}) => {
  const value = Number(
    getFirstValue(
      track.duration,
      track.durationSeconds,
      track.duration_seconds,
      track.durationMs
    )
  );

  if (!Number.isFinite(value)) {
    return 0;
  }

  /*
   * If API returns milliseconds,
   * convert to seconds.
   */
  if (value > 10000) {
    return value / 1000;
  }

  return value;
};

const getSongId = (track = {}) => {
  return getFirstValue(
    track.id,
    track.songId,
    track.song_id,
    track.trackId,
    track.track_id,
    track.perma_url,
    track.url,
    `${track.name || track.title || "song"}-${getArtist(
      track
    )}`
  );
};

/* =========================================================
   NORMALIZE SONG
========================================================= */

const normalizeSong = (track) => {
  if (!track) {
    return null;
  }

  const name = getFirstValue(
    track.name,
    track.title,
    track.song,
    track.trackName,
    track.track_name,
    "Unknown Song"
  );

  const artist = getArtist(track);

  const image = getImage(track);

  const audio = getAudioUrl(track);

  const duration =
    getDuration(track);

  const id = getSongId(track);

  return {
    ...track,

    id,

    name,
    title: name,

    artist,

    image,
    coverImage: image,

    audio,
    audioUrl: audio,

    duration,

    durationSeconds: duration,

    album:
      track.album || {
        name:
          track.albumName ||
          "",
        image,
      },
  };
};

/* =========================================================
   QUEUE
========================================================= */

const normalizeQueue = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeSong)
      .filter(Boolean);
  }

  if (Array.isArray(value.songs)) {
    return value.songs
      .map(normalizeSong)
      .filter(Boolean);
  }

  if (Array.isArray(value.data)) {
    return value.data
      .map(normalizeSong)
      .filter(Boolean);
  }

  if (Array.isArray(value.results)) {
    return value.results
      .map(normalizeSong)
      .filter(Boolean);
  }

  if (Array.isArray(value.tracks)) {
    return value.tracks
      .map(normalizeSong)
      .filter(Boolean);
  }

  return [];
};

/* =========================================================
   LRC PARSER
========================================================= */

export const parseLrc = (
  lrcText
) => {
  if (
    !lrcText ||
    typeof lrcText !== "string"
  ) {
    return [];
  }

  const result = [];

  const lines =
    lrcText.split(/\r?\n/);

  /*
   * Supports:
   * [00:12.34]
   * [00:12.3]
   * [00:12.345]
   * [00:12:34]
   */

  const timeRegex =
    /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  lines.forEach((line) => {
    const matches = [
      ...line.matchAll(timeRegex),
    ];

    if (!matches.length) {
      return;
    }

    const text = line
      .replace(timeRegex, "")
      .trim();

    if (!text) {
      return;
    }

    matches.forEach((match) => {
      const minutes =
        Number(match[1]) || 0;

      const seconds =
        Number(match[2]) || 0;

      let milliseconds = 0;

      if (match[3]) {
        const fraction =
          String(match[3]);

        if (fraction.length === 1) {
          milliseconds =
            Number(fraction) * 100;
        } else if (
          fraction.length === 2
        ) {
          milliseconds =
            Number(fraction) * 10;
        } else {
          milliseconds =
            Number(
              fraction.slice(0, 3)
            );
        }
      }

      const time =
        minutes * 60 +
        seconds +
        milliseconds / 1000;

      result.push({
        time,
        text,
      });
    });
  });

  return result.sort(
    (a, b) =>
      a.time - b.time
  );
};

/* =========================================================
   LRCLIB
========================================================= */

export const fetchSyncedLyrics =
  async (
    trackName,
    artistName,
    duration
  ) => {
    const cleanTrack =
      cleanText(trackName);

    const cleanArtist =
      cleanText(
        String(
          artistName || ""
        ).split(",")[0]
      );

    if (!cleanTrack) {
      return {
        synced: false,
        lines: [],
        plain: "",
      };
    }

    try {
      /*
       * -----------------------------------------
       * DIRECT SEARCH
       * -----------------------------------------
       */

      let url =
        `${LRCLIB_BASE_URL}/get` +
        `?track_name=${encodeURIComponent(
          cleanTrack
        )}` +
        `&artist_name=${encodeURIComponent(
          cleanArtist
        )}`;

      if (
        duration &&
        Number(duration) > 0
      ) {
        url +=
          `&duration=${Math.round(
            Number(duration)
          )}`;
      }

      let response =
        await fetch(url);

      if (response.ok) {
        const data =
          await response.json();

        if (data?.syncedLyrics) {
          const lines =
            parseLrc(
              data.syncedLyrics
            );

          return {
            synced: true,
            lines,
            plain:
              data.plainLyrics ||
              lines
                .map(
                  (line) =>
                    line.text
                )
                .join("\n"),
            source: "lrclib",
          };
        }

        if (data?.plainLyrics) {
          const plain =
            data.plainLyrics;

          return {
            synced: false,

            lines: plain
              .split(/\r?\n/)
              .filter(Boolean)
              .map((text) => ({
                time: 0,
                text,
              })),

            plain,

            source: "lrclib",
          };
        }
      }

      /*
       * -----------------------------------------
       * LRCLIB SEARCH FALLBACK
       * -----------------------------------------
       */

      const searchUrl =
        `${LRCLIB_BASE_URL}/search` +
        `?q=${encodeURIComponent(
          `${cleanTrack} ${cleanArtist}`
        )}`;

      response =
        await fetch(searchUrl);

      if (response.ok) {
        const results =
          await response.json();

        if (
          Array.isArray(results) &&
          results.length
        ) {
          /*
           * Prefer synced lyrics.
           */

          const syncedResult =
            results.find(
              (item) =>
                item?.syncedLyrics
            );

          if (
            syncedResult?.syncedLyrics
          ) {
            const lines =
              parseLrc(
                syncedResult.syncedLyrics
              );

            return {
              synced: true,
              lines,
              plain:
                syncedResult.plainLyrics ||
                lines
                  .map(
                    (line) =>
                      line.text
                  )
                  .join("\n"),
              source: "lrclib",
            };
          }

          /*
           * Otherwise use plain lyrics.
           */

          const plainResult =
            results.find(
              (item) =>
                item?.plainLyrics
            );

          if (
            plainResult?.plainLyrics
          ) {
            const plain =
              plainResult.plainLyrics;

            return {
              synced: false,

              lines: plain
                .split(/\r?\n/)
                .filter(Boolean)
                .map(
                  (text) => ({
                    time: 0,
                    text,
                  })
                ),

              plain,

              source: "lrclib",
            };
          }
        }
      }

      return {
        synced: false,
        lines: [],
        plain:
          "No lyrics available for this song.",
        source: "lrclib",
      };
    } catch (error) {
      console.error(
        "LRCLIB error:",
        error
      );

      return {
        synced: false,
        lines: [],
        plain:
          "Could not load lyrics.",
        source: "lrclib",
      };
    }
  };

/* =========================================================
   PROVIDER
========================================================= */

export const MusicProvider = ({
  children,
}) => {
  const audioRef =
    useRef(null);

  const lyricsRequestRef =
    useRef(0);

  /*
   * -----------------------------------------
   * PLAYER STATE
   * -----------------------------------------
   */

  const [currentSong, setCurrentSong] =
    useState(null);

  const [song, setSong] =
    useState([]);

  const [currentIndex, setCurrentIndex] =
    useState(-1);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [shuffle, setShuffle] =
    useState(false);

  const [repeatMode, setRepeatMode] =
    useState("off");

  /*
   * -----------------------------------------
   * PROGRESS
   * -----------------------------------------
   */

  const [currentTime, setCurrentTime] =
    useState(0);

  const [duration, setDuration] =
    useState(0);

  /*
   * -----------------------------------------
   * VOLUME
   * -----------------------------------------
   */

  const [volume, setVolume] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "dreamly-volume"
          );

        if (saved !== null) {
          const value =
            Number(saved);

          if (
            Number.isFinite(
              value
            )
          ) {
            return Math.max(
              0,
              Math.min(
                1,
                value
              )
            );
          }
        }
      } catch {
        // Ignore
      }

      return 1;
    });

  /*
   * -----------------------------------------
   * COVER
   * -----------------------------------------
   */

  const [coverImage, setCoverImage] =
    useState("");

  /*
   * -----------------------------------------
   * LYRICS
   * -----------------------------------------
   */

  const [lyrics, setLyrics] =
    useState([]);

  const [lyricsText, setLyricsText] =
    useState("");

  const [lyricsSynced, setLyricsSynced] =
    useState(false);

  const [lyricsLoading, setLyricsLoading] =
    useState(false);

  const [lyricsError, setLyricsError] =
    useState("");

  const [activeLyricIndex, setActiveLyricIndex] =
    useState(-1);

  /*
   * -----------------------------------------
   * LIKES
   * -----------------------------------------
   */

  const [likedSongs, setLikedSongs] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "dreamly-liked-songs"
          );

        if (saved) {
          const parsed =
            JSON.parse(saved);

          return Array.isArray(
            parsed
          )
            ? parsed
            : [];
        }
      } catch {
        // Ignore
      }

      return [];
    });

  /* =========================================================
     CREATE AUDIO
  ========================================================= */

  useEffect(() => {
    const audio =
      new Audio();

    audio.preload =
      "metadata";

    audio.volume =
      volume;

    audioRef.current =
      audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current =
        null;
    };
  }, []);

  /* =========================================================
     AUDIO EVENTS
  ========================================================= */

  const nextSongRef =
    useRef(null);

  const playSongRef =
    useRef(null);

  const repeatModeRef =
    useRef(repeatMode);

  useEffect(() => {
    repeatModeRef.current =
      repeatMode;
  }, [repeatMode]);

  /* =========================================================
     LOAD SONG
  ========================================================= */

  const loadSong = useCallback(
    async (
      selectedSong,
      autoPlay = true
    ) => {
      const normalized =
        normalizeSong(
          selectedSong
        );

      if (!normalized) {
        return;
      }

      const audio =
        audioRef.current;

      if (!audio) {
        return;
      }

      setCurrentSong(
        normalized
      );

      setCoverImage(
        normalized.image || ""
      );

      setCurrentTime(0);

      setDuration(
        Number(
          normalized.duration
        ) || 0
      );

      audio.pause();

      audio.currentTime = 0;

      audio.src =
        normalized.audio || "";

      audio.load();

      if (!normalized.audio) {
        setIsPlaying(false);

        console.warn(
          "Song has no audio URL:",
          normalized
        );

        return;
      }

      if (autoPlay) {
        try {
          await audio.play();

          setIsPlaying(true);
        } catch (error) {
          console.warn(
            "Audio play failed:",
            error
          );

          setIsPlaying(false);
        }
      }
    },
    []
  );

  /* =========================================================
     PLAY MUSIC
     
     Compatible with:
     
     playMusic(
       audioUrl,
       name,
       duration,
       image,
       id,
       song
     )
  ========================================================= */

  const playMusic =
    useCallback(
      async (
        audioUrl,
        name,
        songDuration,
        image,
        id,
        queue
      ) => {
        let selectedSong;

        /*
         * Complete object:
         *
         * playMusic(songObject)
         */

        if (
          typeof audioUrl ===
            "object" &&
          audioUrl !== null
        ) {
          selectedSong =
            normalizeSong(
              audioUrl
            );

          if (
            Array.isArray(name)
          ) {
            queue = name;
          }
        } else {
          /*
           * Existing Player format:
           *
           * playMusic(
           *   audioUrl,
           *   name,
           *   duration,
           *   image,
           *   id,
           *   song
           * )
           */

          selectedSong =
            normalizeSong({
              audio: audioUrl,
              name,
              duration:
                songDuration,
              image,
              id,
            });
        }

        if (!selectedSong) {
          return;
        }

        /*
         * Update queue if provided.
         */

        const newQueue =
          normalizeQueue(queue);

        if (newQueue.length) {
          setSong(newQueue);

          const foundIndex =
            newQueue.findIndex(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  selectedSong.id
                )
            );

          setCurrentIndex(
            foundIndex >= 0
              ? foundIndex
              : 0
          );
        } else {
          /*
           * If there is no queue,
           * create one containing
           * the current song.
           */

          setSong(
            (previous) => {
              const exists =
                previous.some(
                  (item) =>
                    String(
                      item.id
                    ) ===
                    String(
                      selectedSong.id
                    )
                );

              if (exists) {
                return previous;
              }

              return [
                ...previous,
                selectedSong,
              ];
            }
          );

          setCurrentIndex(
            (previous) => {
              if (
                previous >= 0
              ) {
                return previous;
              }

              return 0;
            }
          );
        }

        /*
         * If same song is already loaded,
         * toggle play/pause.
         */

        if (
          currentSong &&
          String(
            currentSong.id
          ) ===
            String(
              selectedSong.id
            ) &&
          audioRef.current?.src
        ) {
          if (
            isPlaying
          ) {
            audioRef.current.pause();
          } else {
            try {
              await audioRef.current.play();

              setIsPlaying(
                true
              );
            } catch (error) {
              console.error(
                "Play error:",
                error
              );
            }
          }

          return;
        }

        await loadSong(
          selectedSong,
          true
        );
      },
      [
        currentSong,
        isPlaying,
        loadSong,
      ]
    );

  playSongRef.current =
    playMusic;

  /* =========================================================
     PAUSE
  ========================================================= */

  const pauseMusic =
    useCallback(() => {
      const audio =
        audioRef.current;

      if (!audio) {
        return;
      }

      audio.pause();

      setIsPlaying(false);
    }, []);

  /* =========================================================
     RESUME
  ========================================================= */

  const resumeMusic =
    useCallback(
      async () => {
        const audio =
          audioRef.current;

        if (!audio) {
          return;
        }

        if (!audio.src) {
          return;
        }

        try {
          await audio.play();

          setIsPlaying(true);
        } catch (error) {
          console.error(
            "Resume error:",
            error
          );

          setIsPlaying(false);
        }
      },
      []
    );

  /* =========================================================
     NEXT SONG
  ========================================================= */

  const nextSong =
    useCallback(
      async () => {
        if (!song.length) {
          return;
        }

        let nextIndex;

        /*
         * Shuffle
         */

        if (shuffle) {
          if (
            song.length === 1
          ) {
            nextIndex =
              currentIndex;
          } else {
            do {
              nextIndex =
                Math.floor(
                  Math.random() *
                    song.length
                );
            } while (
              nextIndex ===
              currentIndex
            );
          }
        } else {
          nextIndex =
            currentIndex + 1;

          if (
            nextIndex >=
            song.length
          ) {
            if (
              repeatMode ===
              "all"
            ) {
              nextIndex = 0;
            } else {
              setIsPlaying(
                false
              );

              return;
            }
          }
        }

        const next =
          song[nextIndex];

        if (!next) {
          return;
        }

        setCurrentIndex(
          nextIndex
        );

        await loadSong(
          next,
          true
        );
      },
      [
        song,
        shuffle,
        currentIndex,
        repeatMode,
        loadSong,
      ]
    );

  nextSongRef.current =
    nextSong;

  /* =========================================================
     PREVIOUS SONG
  ========================================================= */

  const prevSong =
    useCallback(
      async () => {
        if (!song.length) {
          return;
        }

        const audio =
          audioRef.current;

        /*
         * If current song has played
         * more than 3 seconds,
         * restart it.
         */

        if (
          audio &&
          audio.currentTime >
            3
        ) {
          audio.currentTime = 0;

          setCurrentTime(0);

          return;
        }

        let previousIndex =
          currentIndex - 1;

        if (
          previousIndex < 0
        ) {
          if (
            repeatMode ===
            "all"
          ) {
            previousIndex =
              song.length - 1;
          } else {
            previousIndex = 0;
          }
        }

        const previous =
          song[previousIndex];

        if (!previous) {
          return;
        }

        setCurrentIndex(
          previousIndex
        );

        await loadSong(
          previous,
          true
        );
      },
      [
        song,
        currentIndex,
        repeatMode,
        loadSong,
      ]
    );

  /* =========================================================
     AUDIO EVENT LISTENERS
  ========================================================= */

  useEffect(() => {
    const audio =
      audioRef.current;

    if (!audio) {
      return;
    }

    const handleLoadedMetadata =
      () => {
        if (
          Number.isFinite(
            audio.duration
          ) &&
          audio.duration > 0
        ) {
          setDuration(
            audio.duration
          );
        }
      };

    const handleDurationChange =
      () => {
        if (
          Number.isFinite(
            audio.duration
          ) &&
          audio.duration > 0
        ) {
          setDuration(
            audio.duration
          );
        }
      };

    const handleTimeUpdate =
      () => {
        setCurrentTime(
          audio.currentTime || 0
        );
      };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);

      if (
        repeatModeRef.current ===
        "one"
      ) {
        audio.currentTime = 0;

        audio
          .play()
          .then(() => {
            setIsPlaying(
              true
            );
          })
          .catch((error) => {
            console.error(
              "Repeat-one error:",
              error
            );
          });

        return;
      }

      if (
        nextSongRef.current
      ) {
        nextSongRef.current();
      }
    };

    const handleError = (
      event
    ) => {
      console.error(
        "Audio error:",
        event
      );

      setIsPlaying(false);
    };

    audio.addEventListener(
      "loadedmetadata",
      handleLoadedMetadata
    );

    audio.addEventListener(
      "durationchange",
      handleDurationChange
    );

    audio.addEventListener(
      "timeupdate",
      handleTimeUpdate
    );

    audio.addEventListener(
      "play",
      handlePlay
    );

    audio.addEventListener(
      "pause",
      handlePause
    );

    audio.addEventListener(
      "ended",
      handleEnded
    );

    audio.addEventListener(
      "error",
      handleError
    );

    return () => {
      audio.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata
      );

      audio.removeEventListener(
        "durationchange",
        handleDurationChange
      );

      audio.removeEventListener(
        "timeupdate",
        handleTimeUpdate
      );

      audio.removeEventListener(
        "play",
        handlePlay
      );

      audio.removeEventListener(
        "pause",
        handlePause
      );

      audio.removeEventListener(
        "ended",
        handleEnded
      );

      audio.removeEventListener(
        "error",
        handleError
      );
    };
  }, []);

  /* =========================================================
     SHUFFLE
  ========================================================= */

  const toggleShuffle =
    useCallback(() => {
      setShuffle(
        (value) => !value
      );
    }, []);

  /* =========================================================
     REPEAT
     
     off -> all -> one -> off
  ========================================================= */

  const toggleRepeatMode =
    useCallback(() => {
      setRepeatMode(
        (mode) => {
          if (
            mode === "off"
          ) {
            return "all";
          }

          if (
            mode === "all"
          ) {
            return "one";
          }

          return "off";
        }
      );
    }, []);

  /* =========================================================
     SEEK
  ========================================================= */

  const seekTo =
    useCallback(
      (value) => {
        const audio =
          audioRef.current;

        if (!audio) {
          return;
        }

        const newTime =
          Number(value);

        if (
          !Number.isFinite(
            newTime
          )
        ) {
          return;
        }

        audio.currentTime =
          Math.max(
            0,
            Math.min(
              newTime,
              Number.isFinite(
                audio.duration
              )
                ? audio.duration
                : newTime
            )
          );

        setCurrentTime(
          audio.currentTime
        );
      },
      []
    );

  /* =========================================================
     VOLUME
  ========================================================= */

  const changeVolume =
    useCallback(
      (value) => {
        let newVolume =
          Number(value);

        if (
          newVolume > 1
        ) {
          newVolume =
            newVolume / 100;
        }

        newVolume =
          Math.max(
            0,
            Math.min(
              1,
              newVolume
            )
          );

        setVolume(
          newVolume
        );

        if (
          audioRef.current
        ) {
          audioRef.current.volume =
            newVolume;
        }

        try {
          localStorage.setItem(
            "dreamly-volume",
            String(
              newVolume
            )
          );
        } catch {
          // Ignore
        }
      },
      []
    );

  /* =========================================================
     VOLUME SYNC
  ========================================================= */

  useEffect(() => {
    if (
      audioRef.current
    ) {
      audioRef.current.volume =
        volume;
    }
  }, [volume]);

  /* =========================================================
     LYRICS
  ========================================================= */

  const fetchLyrics =
    useCallback(
      async (
        selectedSong
      ) => {
        const target =
          normalizeSong(
            selectedSong
          );

        if (!target) {
          setLyrics([]);
          setLyricsText("");
          setLyricsSynced(
            false
          );
          setLyricsError(
            ""
          );
          setActiveLyricIndex(
            -1
          );

          return;
        }

        /*
         * Prevent old song's
         * lyrics from replacing
         * current song lyrics.
         */

        const requestId =
          ++lyricsRequestRef.current;

        setLyricsLoading(
          true
        );

        setLyricsError("");

        setLyrics([]);

        setLyricsText("");

        setLyricsSynced(
          false
        );

        setActiveLyricIndex(
          -1
        );

        try {
          const result =
            await fetchSyncedLyrics(
              target.name,
              target.artist,
              target.duration
            );

          if (
            requestId !==
            lyricsRequestRef.current
          ) {
            return;
          }

          setLyrics(
            result.lines || []
          );

          setLyricsText(
            result.plain || ""
          );

          setLyricsSynced(
            Boolean(
              result.synced
            )
          );

          if (
            !result.lines?.length &&
            !result.plain
          ) {
            setLyricsError(
              "No lyrics available."
            );
          }
        } catch (error) {
          if (
            requestId !==
            lyricsRequestRef.current
          ) {
            return;
          }

          console.error(
            "Lyrics error:",
            error
          );

          setLyrics([]);

          setLyricsText(
            "Could not load lyrics."
          );

          setLyricsSynced(
            false
          );

          setLyricsError(
            "Could not load lyrics."
          );
        } finally {
          if (
            requestId ===
            lyricsRequestRef.current
          ) {
            setLyricsLoading(
              false
            );
          }
        }
      },
      []
    );

  /* =========================================================
     AUTO LOAD LYRICS
  ========================================================= */

  useEffect(() => {
    if (!currentSong) {
      return;
    }

    fetchLyrics(
      currentSong
    );
  }, [
    currentSong,
    fetchLyrics,
  ]);

  /* =========================================================
     ACTIVE LYRIC
  ========================================================= */

  useEffect(() => {
    if (
      !lyricsSynced ||
      !lyrics.length
    ) {
      setActiveLyricIndex(
        -1
      );

      return;
    }

    let index = -1;

    for (
      let i = 0;
      i < lyrics.length;
      i++
    ) {
      if (
        currentTime >=
        Number(
          lyrics[i].time
        )
      ) {
        index = i;
      } else {
        break;
      }
    }

    setActiveLyricIndex(
      index
    );
  }, [
    currentTime,
    lyrics,
    lyricsSynced,
  ]);

  /* =========================================================
     CURRENT LYRIC
  ========================================================= */

  const currentLyric =
    activeLyricIndex >= 0
      ? lyrics[
          activeLyricIndex
        ]
      : null;

  /* =========================================================
     COVER IMAGE
  ========================================================= */

  useEffect(() => {
    if (!currentSong) {
      setCoverImage("");
      return;
    }

    setCoverImage(
      getImage(currentSong)
    );
  }, [currentSong]);

  /* =========================================================
     LIKE
  ========================================================= */

  const isSongLiked =
    useCallback(
      (songId) => {
        return likedSongs.some(
          (item) =>
            String(
              item.id
            ) ===
            String(songId)
        );
      },
      [likedSongs]
    );

  const toggleLike =
    useCallback(
      (selectedSong) => {
        const target =
          normalizeSong(
            selectedSong ||
              currentSong
          );

        if (!target) {
          return;
        }

        setLikedSongs(
          (previous) => {
            const exists =
              previous.some(
                (item) =>
                  String(
                    item.id
                  ) ===
                  String(
                    target.id
                  )
              );

            const updated =
              exists
                ? previous.filter(
                    (item) =>
                      String(
                        item.id
                      ) !==
                      String(
                        target.id
                      )
                  )
                : [
                    ...previous,
                    target,
                  ];

            try {
              localStorage.setItem(
                "dreamly-liked-songs",
                JSON.stringify(
                  updated
                )
              );
            } catch {
              // Ignore
            }

            return updated;
          }
        );
      },
      [currentSong]
    );

  /* =========================================================
     DOWNLOAD
  ========================================================= */

  const downloadSong =
    useCallback(
      async (
        selectedSong
      ) => {
        const target =
          normalizeSong(
            selectedSong ||
              currentSong
          );

        if (!target) {
          return;
        }

        const url =
          target.audio;

        if (!url) {
          console.warn(
            "No download URL."
          );

          return;
        }

        try {
          const response =
            await fetch(url);

          if (!response.ok) {
            throw new Error(
              `Download failed: ${response.status}`
            );
          }

          const blob =
            await response.blob();

          const blobUrl =
            URL.createObjectURL(
              blob
            );

          const link =
            document.createElement(
              "a"
            );

          link.href =
            blobUrl;

          const safeName =
            String(
              target.name ||
                "song"
            )
              .replace(
                /[<>:"/\\|?*]/g,
                ""
              )
              .trim() ||
            "song";

          link.download =
            `${safeName}.mp3`;

          document.body.appendChild(
            link
          );

          link.click();

          document.body.removeChild(
            link
          );

          setTimeout(() => {
            URL.revokeObjectURL(
              blobUrl
            );
          }, 1000);
        } catch (error) {
          console.error(
            "Download error:",
            error
          );

          /*
           * Fallback to opening
           * the original URL.
           */

          try {
            const link =
              document.createElement(
                "a"
              );

            link.href = url;

            link.target =
              "_blank";

            link.rel =
              "noopener noreferrer";

            document.body.appendChild(
              link
            );

            link.click();

            document.body.removeChild(
              link
            );
          } catch {
            // Ignore
          }
        }
      },
      [currentSong]
    );

  /* =========================================================
     MEDIA SESSION
  ========================================================= */

  useEffect(() => {
    if (
      !currentSong ||
      typeof navigator ===
        "undefined" ||
      !("mediaSession" in
        navigator)
    ) {
      return;
    }

    try {
      navigator.mediaSession.metadata =
        new MediaMetadata({
          title:
            currentSong.name ||
            "Unknown Song",

          artist:
            currentSong.artist ||
            "Unknown Artist",

          album:
            currentSong.album?.name ||
            currentSong.albumName ||
            "",

          artwork: coverImage
            ? [
                {
                  src: coverImage,
                  sizes:
                    "512x512",
                  type:
                    "image/jpeg",
                },
              ]
            : [],
        });
    } catch (error) {
      console.warn(
        "MediaSession metadata error:",
        error
      );
    }
  }, [
    currentSong,
    coverImage,
  ]);

  /* =========================================================
     MEDIA SESSION ACTIONS
  ========================================================= */

  useEffect(() => {
    if (
      typeof navigator ===
        "undefined" ||
      !("mediaSession" in
        navigator)
    ) {
      return;
    }

    const actions = {
      play: () =>
        resumeMusic(),

      pause: () =>
        pauseMusic(),

      nexttrack: () =>
        nextSong(),

      previoustrack: () =>
        prevSong(),

      seekbackward: () => {
        const audio =
          audioRef.current;

        if (!audio) {
          return;
        }

        seekTo(
          audio.currentTime - 10
        );
      },

      seekforward: () => {
        const audio =
          audioRef.current;

        if (!audio) {
          return;
        }

        seekTo(
          audio.currentTime + 10
        );
      },
    };

    Object.entries(
      actions
    ).forEach(
      ([
        action,
        handler,
      ]) => {
        try {
          navigator.mediaSession.setActionHandler(
            action,
            handler
          );
        } catch {
          // Some browsers don't support all actions.
        }
      }
    );

    return () => {
      Object.keys(
        actions
      ).forEach(
        (action) => {
          try {
            navigator.mediaSession.setActionHandler(
              action,
              null
            );
          } catch {
            // Ignore
          }
        }
      );
    };
  }, [
    resumeMusic,
    pauseMusic,
    nextSong,
    prevSong,
    seekTo,
  ]);

  /* =========================================================
     MEDIA SESSION STATE
  ========================================================= */

  useEffect(() => {
    if (
      typeof navigator ===
        "undefined" ||
      !("mediaSession" in
        navigator)
    ) {
      return;
    }

    try {
      navigator.mediaSession.playbackState =
        isPlaying
          ? "playing"
          : "paused";
    } catch {
      // Ignore
    }
  }, [isPlaying]);

  /* =========================================================
     CONTEXT VALUE
  ========================================================= */

  const contextValue =
    useMemo(
      () => ({
        /*
         * PLAYER
         */

        currentSong,

        song,

        currentIndex,

        isPlaying,

        audio:
          audioRef.current,

        audioRef,

        /*
         * PROGRESS
         */

        currentTime,

        duration,

        /*
         * VOLUME
         */

        volume,

        /*
         * COVER
         */

        coverImage,

        /*
         * PLAYBACK
         */

        playMusic,

        pauseMusic,

        resumeMusic,

        nextSong,

        prevSong,

        seekTo,

        /*
         * SHUFFLE
         */

        shuffle,

        toggleShuffle,

        /*
         * REPEAT
         */

        repeatMode,

        toggleRepeatMode,

        /*
         * LYRICS
         */

        lyrics,

        lyricsText,

        lyricsSynced,

        lyricsLoading,

        lyricsError,

        activeLyricIndex,

        currentLyric,

        fetchLyrics,

        /*
         * DOWNLOAD
         */

        downloadSong,

        /*
         * LIKE
         */

        likedSongs,

        isSongLiked,

        toggleLike,

        /*
         * QUEUE CONTROL
         */

        setSong,

        setCurrentSong,

        setCurrentIndex,

        /*
         * COVER CONTROL
         */

        setCoverImage,

        /*
         * VOLUME CONTROL
         */

        setVolume:
          changeVolume,
      }),
      [
        currentSong,
        song,
        currentIndex,
        isPlaying,
        currentTime,
        duration,
        volume,
        coverImage,
        playMusic,
        pauseMusic,
        resumeMusic,
        nextSong,
        prevSong,
        seekTo,
        shuffle,
        toggleShuffle,
        repeatMode,
        toggleRepeatMode,
        lyrics,
        lyricsText,
        lyricsSynced,
        lyricsLoading,
        lyricsError,
        activeLyricIndex,
        currentLyric,
        fetchLyrics,
        downloadSong,
        likedSongs,
        isSongLiked,
        toggleLike,
        changeVolume,
      ]
    );

  return (
    <MusicContext.Provider
      value={contextValue}
    >
      {children}
    </MusicContext.Provider>
  );
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default MusicContext;
