import { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa6";
import { FaPlay } from "react-icons/fa";

import Navbar from "../components/Navbar";
import Footer from "../components/footer";
import SongsList from "../components/SongsList";
import Navigator from "../components/Navigator";

import MusicContext from "../context/MusicContext";
import { fetchplaylistsByID } from "../../fetch";

const PlaylistDetails = () => {
  const { id } = useParams();

  const { playMusic } = useContext(MusicContext);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /*
   * Get liked playlists from localStorage
   */
  const [likedPlaylists, setLikedPlaylists] = useState(() => {
    try {
      const savedPlaylists = localStorage.getItem("likedPlaylists");

      if (!savedPlaylists) {
        return [];
      }

      const parsedPlaylists = JSON.parse(savedPlaylists);

      return Array.isArray(parsedPlaylists)
        ? parsedPlaylists
        : [];
    } catch (err) {
      console.error(
        "Error reading likedPlaylists from localStorage:",
        err
      );

      return [];
    }
  });

  /*
   * Fetch playlist details
   */
  useEffect(() => {
    let isMounted = true;

    const loadPlaylist = async () => {
      if (!id) {
        setError("Playlist ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetchplaylistsByID(id);

        console.log("Playlist API Response:", response);

        if (!response) {
          throw new Error("Empty API response");
        }

        if (!response.data) {
          throw new Error("Playlist data not found");
        }

        if (isMounted) {
          setDetails(response);
        }
      } catch (err) {
        console.error("Playlist Details Error:", err);

        if (isMounted) {
          setError(
            "Failed to fetch playlist details. Please try again later."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPlaylist();

    return () => {
      isMounted = false;
    };
  }, [id]);

  /*
   * Save liked playlists to localStorage
   */
  useEffect(() => {
    try {
      localStorage.setItem(
        "likedPlaylists",
        JSON.stringify(likedPlaylists)
      );
    } catch (err) {
      console.error(
        "Error saving likedPlaylists:",
        err
      );
    }
  }, [likedPlaylists]);

  /*
   * Loading
   */
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <img
          src="/Loading.gif"
          alt="Loading..."
          className="w-16 h-16 object-contain"
        />
      </div>
    );
  }

  /*
   * Error
   */
  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center px-5">
        <div className="text-center">
          <p className="text-red-500 text-lg font-semibold">
            {error}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2 rounded-lg border border-gray-500 hover:bg-gray-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /*
   * Playlist data
   */
  const playlistData = details?.data || {};

  /*
   * Songs
   */
  const songs = Array.isArray(playlistData.songs)
    ? playlistData.songs
    : [];

  /*
   * Playlist image
   */
  const playlistImage =
    playlistData.image?.[2]?.url ||
    playlistData.image?.[1]?.url ||
    playlistData.image?.[0]?.url ||
    (typeof playlistData.image === "string"
      ? playlistData.image
      : "/default-image.png");

  /*
   * Check whether playlist is liked
   */
  const isLiked = likedPlaylists.some(
    (playlist) =>
      String(playlist?.id) === String(playlistData?.id)
  );

  /*
   * Like / Unlike playlist
   */
  const toggleLikePlaylist = () => {
    if (!playlistData?.id) {
      return;
    }

    setLikedPlaylists((previousPlaylists) => {
      const alreadyLiked = previousPlaylists.some(
        (playlist) =>
          String(playlist?.id) ===
          String(playlistData.id)
      );

      /*
       * Unlike
       */
      if (alreadyLiked) {
        return previousPlaylists.filter(
          (playlist) =>
            String(playlist?.id) !==
            String(playlistData.id)
        );
      }

      /*
       * Like
       */
      return [
        ...previousPlaylists,
        {
          id: playlistData.id,
          name:
            playlistData.name || "Unknown Playlist",
          image: playlistImage,
        },
      ];
    });
  };

  /*
   * Get song image
   */
  const getSongImage = (song) => {
    if (!song) {
      return [];
    }

    if (Array.isArray(song.image)) {
      return song.image;
    }

    if (typeof song.image === "string") {
      return song.image;
    }

    return [];
  };

  /*
   * Get audio URL
   */
  const getAudioUrl = (song) => {
    if (!song) {
      return null;
    }

    /*
     * downloadUrl can be an array
     */
    if (Array.isArray(song.downloadUrl)) {
      const validUrls = song.downloadUrl.filter(
        (item) => item?.url
      );

      if (validUrls.length > 0) {
        /*
         * Usually the last item is highest quality.
         */
        return validUrls[validUrls.length - 1].url;
      }
    }

    /*
     * downloadUrl can be a string
     */
    if (typeof song.downloadUrl === "string") {
      return song.downloadUrl;
    }

    /*
     * Fallback audio property
     */
    if (typeof song.audio === "string") {
      return song.audio;
    }

    /*
     * Other possible audio properties
     */
    if (typeof song.url === "string") {
      return song.url;
    }

    return null;
  };

  /*
   * Play first song
   */
  const playFirstSong = () => {
    if (!songs.length) {
      console.warn("Playlist has no songs.");
      return;
    }

    const firstSong = songs[0];

    const audioSource = getAudioUrl(firstSong);

    if (!audioSource) {
      console.error(
        "No playable audio URL found:",
        firstSong
      );

      return;
    }

    try {
      playMusic(
        audioSource,
        firstSong?.name || "Unknown Song",
        firstSong?.duration || 0,
        getSongImage(firstSong),
        firstSong?.id,
        firstSong?.artists || [],
        songs
      );
    } catch (err) {
      console.error(
        "Error playing first song:",
        err
      );
    }
  };

  /*
   * Calculate total duration
   */
  const totalDuration = useMemo(() => {
    if (!songs.length) {
      return 0;
    }

    return songs.reduce((total, song) => {
      const duration = Number(song?.duration) || 0;

      return total + duration;
    }, 0);
  }, [songs]);

  /*
   * Format duration
   */
  const formatDuration = (duration) => {
    const totalSeconds =
      Number(duration) || 0;

    if (totalSeconds <= 0) {
      return "0m";
    }

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = Math.floor(
      totalSeconds % 60
    );

    /*
     * Hours
     */
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    /*
     * Minutes
     */
    if (minutes > 0) {
      return `${minutes}m`;
    }

    /*
     * Seconds
     */
    return `${seconds}s`;
  };

  /*
   * Song count
   */
  const songCount =
    playlistData.songCount ??
    songs.length;

  return (
    <>
      <Navbar />

      <main className="flex flex-col mt-[11rem] lg:mt-[6rem] pb-10">

        {/* =========================================
            PLAYLIST HEADER
        ========================================== */}
        <section
          className="
            flex
            items-center
            lg:pl-[2rem]
            lg:flex-row
            flex-col
            gap-[1rem]
            lg:gap-[2rem]
          "
        >
          {/* Playlist Image */}
          <img
            src={playlistImage}
            alt={
              playlistData.name ||
              "Playlist"
            }
            className="
              w-[10rem]
              h-[10rem]
              lg:w-[15rem]
              lg:h-[15rem]
              rounded
              object-cover
              DetailImg
            "
            onError={(event) => {
              event.currentTarget.src =
                "/default-image.png";
            }}
          />

          {/* Playlist Information */}
          <div
            className="
              flex
              flex-col
              gap-1
              items-center
              text-center
            "
          >
            {/* Playlist Name */}
            <h1
              className="
                text-2xl
                lg:text-3xl
                font-bold
              "
            >
              {playlistData.name ||
                "Unknown Playlist"}
            </h1>

            {/* Song Count */}
            <p
              className="
                text-sm
                lg:text-lg
                font-semibold
              "
            >
              Total Songs : {songCount}
            </p>

            {/* Duration */}
            <p
              className="
                text-sm
                lg:text-lg
                font-semibold
              "
            >
              Total Duration :{" "}
              {formatDuration(
                totalDuration
              )}
            </p>

            {/* Desktop Controls */}
            <div
              className="
                hidden
                lg:flex
                mt-4
                gap-4
              "
            >
              {/* Play */}
              <button
                type="button"
                onClick={playFirstSong}
                disabled={!songs.length}
                title="Play Playlist"
                className="
                  flex
                  justify-center
                  items-center
                  h-[3rem]
                  w-[3rem]
                  border
                  border-[#8f8f8f6e]
                  rounded-full
                  cursor-pointer
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >
                <FaPlay
                  className="
                    text-xl
                    icon
                    active:scale-90
                  "
                />
              </button>

              {/* Like */}
              <button
                type="button"
                onClick={
                  toggleLikePlaylist
                }
                title={
                  isLiked
                    ? "Unlike Playlist"
                    : "Like Playlist"
                }
                className="
                  mb-[1.4rem]
                  border
                  border-[#8f8f8f6e]
                  h-[3rem]
                  w-[3rem]
                  flex
                  justify-center
                  items-center
                  rounded-full
                  cursor-pointer
                "
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
                    "
                  />
                )}
              </button>
            </div>
          </div>

          {/* =====================================
              MOBILE CONTROLS
          ====================================== */}
          <div
            className="
              flex
              gap-3
              lg:hidden
            "
          >
            {/* Like */}
            <button
              type="button"
              onClick={
                toggleLikePlaylist
              }
              title={
                isLiked
                  ? "Unlike Playlist"
                  : "Like Playlist"
              }
              className="
                mb-[1.4rem]
                border
                border-[#8f8f8f6e]
                h-[3rem]
                w-[3rem]
                flex
                justify-center
                items-center
                rounded-full
                cursor-pointer
              "
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
                  "
                />
              )}
            </button>

            {/* Play */}
            <button
              type="button"
              onClick={playFirstSong}
              disabled={!songs.length}
              title="Play Playlist"
              className="
                flex
                justify-center
                items-center
                h-[3rem]
                w-[3rem]
                border
                border-[#8f8f8f6e]
                rounded-full
                cursor-pointer
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              <FaPlay
                className="
                  text-xl
                  icon
                  active:scale-90
                "
              />
            </button>
          </div>
        </section>

        {/* =========================================
            SONG LIST
        ========================================== */}
        <section>
          <h2
            className="
              lg:mt-8
              mt-2
              mb-2
              ml-2
              text-2xl
              font-semibold
            "
          >
            Top Songs
          </h2>

          <div className="flex flex-col">
            {songs.length > 0 ? (
              songs.map((song, index) => (
                <SongsList
                  key={
                    song?.id ||
                    `song-${index}`
                  }
                  {...song}
                  song={songs}
                />
              ))
            ) : (
              <p
                className="
                  text-center
                  text-gray-500
                  w-full
                  py-8
                "
              >
                Playlist is Empty......
              </p>
            )}
          </div>
        </section>
      </main>

      {/* Navigation */}
      <Navigator />

      {/* Footer */}
      <Footer />
    </>
  );
};

export default PlaylistDetails;
