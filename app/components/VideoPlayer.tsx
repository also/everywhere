import sortedIndexBy from 'lodash/sortedIndexBy';
import React, { memo, useEffect, useRef, useState } from 'react';
import { Video } from '../videos';
import moment from 'moment';
import { Position } from 'geojson';

type ReactVideoEvent = React.SyntheticEvent<HTMLVideoElement>;

export default memo(function VideoPlayer({
  video,
  showChapterSelect = false,
  seek,
  onLocationChange,
}: {
  video: Video;
  showChapterSelect?: boolean;
  seek?: number;
  onLocationChange: (
    loc: [number, number] | undefined,
    time: moment.Moment | undefined
  ) => void;
}) {
  const [chapterIndex, setChapterIndex] = useState(-1);
  const [state, setState] = useState<{
    autoPlay?: boolean;
  }>({});
  const [seekingTo, setSeekingTo] = useState<number>();

  const videoNode = useRef<HTMLVideoElement>(null);

  function seekTo(time: number) {
    const newChapterIndex = video.chapters.findIndex(
      ({ start, end }) => time >= start.valueOf() && time < end.valueOf()
    );

    if (newChapterIndex === -1) {
      // TODO ?
      return;
    }
    const chapter = video.chapters[newChapterIndex];
    const offset = time - chapter.start.valueOf();
    const seekingTo = offset / 1000;
    if (chapterIndex === newChapterIndex) {
      videoNode.current!.currentTime = seekingTo;
    }
    setChapterIndex(newChapterIndex);
    setSeekingTo(seekingTo);
  }

  function advance(n = 1, play = false) {
    const newChapterIndex = (chapterIndex + n) % video.chapters.length;
    setChapterIndex(newChapterIndex);
    setState({ autoPlay: !!play });
    setSeekingTo(undefined);
  }

  useEffect(() => {
    if (seek) {
      seekTo(seek);
    } else {
      advance(1);
    }
  }, [seek]);

  function onLoadedMetadata(e: ReactVideoEvent) {
    if (seekingTo) {
      e.currentTarget.currentTime = seekingTo;
    }
  }

  function onSeeked() {
    setSeekingTo(undefined);
  }

  function onEnded() {
    advance(1, true);
  }

  const chapter = video.chapters[chapterIndex];

  function onTimeUpdate(e: ReactVideoEvent) {
    const time = chapter.start
      .clone()
      .add(e.currentTarget.currentTime, 'second');
    const coverage = video.coverage.find(
      ({ properties: { start, end } }) => time >= start && time < end
    );
    if (coverage) {
      const {
        geometry: { coordinates },
        properties: { start },
      } = coverage;
      const startSecs = start.unix();
      // TODO don't concat every time
      // FIXME does this need to handle multi-line strings?
      const coords = ([] as Position[]).concat(...coordinates);
      const coverageCoordIndex = sortedIndexBy(
        coords,
        [0, 0, 0, time.unix() - startSecs],
        ([, , , timeOffsetSecs]) => startSecs + timeOffsetSecs
      );
      const coverageCoord = coords[coverageCoordIndex];
      onLocationChange(coverageCoord as [number, number], time);
    }
  }

  const style: React.CSSProperties = {};
  if (seekingTo) {
    style.opacity = 0.2;
  }

  return (
    <>
      {showChapterSelect && (
        <div>
          {video.chapters.map((chapter, i) => (
            <span
              key={i}
              onClick={() => setChapterIndex(i)}
              style={{ cursor: 'pointer' }}
            >
              {chapterIndex === i ? <b>{i} </b> : `${i} `}
            </span>
          ))}
        </div>
      )}
      <video
        controls={true}
        width="640"
        height="360"
        style={style}
        src={chapter ? chapter.low : undefined}
        poster={chapter ? chapter.stills[0].large : undefined}
        autoPlay={state.autoPlay}
        ref={videoNode}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onSeeked={onSeeked}
      />
    </>
  );
});
