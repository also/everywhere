import * as React from 'react';
import {findDOMNode} from 'react-dom';

import sortedIndex from 'lodash/array/sortedIndex';
import find from 'lodash/collection/find';


export default React.createClass({
  getInitialState() {
    const {video} = this.props;
    return {chapterIndex: -1, coverageCoord: null, time: video.start};
  },

  advance(n=1, play) {
    const {video} = this.props;
    let {chapterIndex} = this.state;
    chapterIndex = (chapterIndex + 1) % video.chapters.length;
    const chapter = video.chapters[chapterIndex];
    this.setState({chapterIndex, chapter, autoPlay: !!play, time: chapter.start, seekingTo: null});
  },

  previous(e) {
    e.preventDefault();
    this.advance(-1);
  },

  next(e) {
    e.preventDefault();
    this.advance(1);
  },

  componentWillMount() {
    const {seek} = this.props;
    if (seek) {
      this.seek(seek);
    } else {
      this.advance(1);
    }
  },

  componentWillReceiveProps(nextProps) {
    const {seek} = nextProps;
    if (seek && seek !== this.props.seek) {
      this.seek(seek);
    }
  },

  onTimeUpdate() {
    const {video} = this.props;
    const {chapter} = this.state;
    const time = chapter.start.clone().add(this.videoNode.currentTime, 'second');
    const coverage = find(video.coverage, ({features: [{properties: {start, end}}]}) => time >= start && time < end);
    let coverageCoord;
    if (coverage) {
      const {features: [feat]} = coverage;
      const {geometry: {coordinates}, properties: {start}} = feat;
      const startSecs = start.unix();
      // TODO don't concat every time
      const coords = [].concat(...coordinates);
      const coverageCoordIndex = sortedIndex(coords, [0, 0, 0, time.unix() - startSecs], ([,,, timeOffsetSecs]) => startSecs + timeOffsetSecs);
      coverageCoord = coords[coverageCoordIndex];
      if (this.props.onLocationChange) {
        this.props.onLocationChange(coverageCoord);
      }
    }
    this.setState({time, coverageCoord});
  },

  seek(time) {
    const {video} = this.props;
    const chapter = find(video.chapters, ({start, end}) => time >= start && time < end);
    if (!chapter) {
      // TODO ?
      console.warn('seek to invalid time');
      return;
    }
    const offset = time - chapter.start;
    const seekingTo = offset / 1000;
    if (this.state.chapter === chapter) {
      this.videoNode.currentTime = seekingTo;
    }
    this.setState({chapter, chapterIndex: video.chapters.indexOf(chapter), seekingTo: seekingTo});
  },

  onLoadedMetadata() {
    const {seekingTo} = this.state;
    if (seekingTo) {
      this.videoNode.currentTime = seekingTo;
    }
  },

  onSeeked() {
    this.setState({seekingTo: null});
  },

  render() {
    const {chapter, autoPlay, time, seekingTo} = this.state;
    const style = {};
    if (seekingTo) {
      style.opacity = 0.2;
    }

    return (
      <div>
        <video controls="true" width="640" height="360" style={style} src={chapter.low} poster={chapter.stills[0].large} autoPlay={autoPlay} ref={component => this.videoNode = findDOMNode(component)}/>
        <p>{time.format('LTS')}</p>
      </div>
    );
  },

  onEnded() {
    this.advance(1, true);
  },

  componentDidMount() {
    this.videoNode.addEventListener('ended', this.onEnded);
    this.videoNode.addEventListener('timeupdate', this.onTimeUpdate);
    this.videoNode.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.videoNode.addEventListener('seeked', this.onSeeked);
  }
});
