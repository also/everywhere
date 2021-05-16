import sortedIndex from 'lodash/array/sortedIndex';
import { memo, useEffect, useRef, useState } from 'react';
import { Video, VideoChapter } from '../videos';
import moment from 'moment';

export default memo(function VideoPlayer({
  video,
  seek,
  onLocationChange,
}: {
  video: Video;
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

  const videoNode = useRef<HTMLVideoElement>();

  function seekTo(time: number) {
    const newChapterIndex = video.chapters.findIndex(
      ({ start, end }) => time >= start.valueOf() && time < end.valueOf()
    );

    if (!newChapterIndex) {
      // TODO ?
      console.warn('seek to invalid time');
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
    const newChapterIndex = (chapterIndex + 1) % video.chapters.length;
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

  function onLoadedMetadata() {
    if (seekingTo) {
      videoNode.current!.currentTime = seekingTo;
    }
  }

  function onSeeked() {
    setSeekingTo(undefined);
  }

  function onEnded() {
    advance(1, true);
  }

  const chapter = video.chapters[chapterIndex];

  function onTimeUpdate() {
    const time = chapter.start
      .clone()
      .add(videoNode.current!.currentTime, 'second');
    const coverage = video.coverage.find(
      ({ properties: { start, end } }) => time >= start && time < end
    );
    if (coverage && onLocationChange) {
      const {
        geometry: { coordinates },
        properties: { start },
      } = coverage;
      const startSecs = start.unix();
      // TODO don't concat every time
      const coords = [].concat(...coordinates);
      const coverageCoordIndex = sortedIndex(
        coords,
        [0, 0, 0, time.unix() - startSecs],
        ([, , , timeOffsetSecs]) => startSecs + timeOffsetSecs
      );
      const coverageCoord = coords[coverageCoordIndex];
      onLocationChange(coverageCoord, time);
    }
  }

  const style = {};
  if (seekingTo) {
    style.opacity = 0.2;
  }

  console.log('vid');

  return (
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
  );
});